import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { AzulSearchDto, CabinClass, SmilesSearchDto } from './search.dto';
import { CrawlerService } from './crawler.service';
import { FlightHistoryService } from '../flight-history/flight-history.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly crawlerService: CrawlerService;

  constructor(private readonly flightHistoryService: FlightHistoryService) {}

  async searchSmiles(dto: SmilesSearchDto) {
    this.logger.log('Procurando Voos na Smiles...');

    if (dto.finalDate) {
      const start = new Date(dto.departureDate + 'T00:00:00');
      const end = new Date(dto.finalDate + 'T00:00:00');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        throw new HttpException({ message: 'finalDate deve ser igual ou posterior a departureDate' }, HttpStatus.BAD_REQUEST);
      }

      const dates: string[] = [];
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }

      const results = await Promise.all(
        dates.map((date) =>
          this.fetchSmilesFlights(dto, date).catch((error) => {
            this.logger.error(`Erro ao buscar voos para ${date}: ${error.message}`);
            return { error: `Falha ao buscar voos para ${date}: ${error.message}` };
          }),
        ),
      );

      const grouped: Record<string, any> = {};
      dates.forEach((date, index) => {
        grouped[date] = results[index];
      });

      return grouped;
    }
    const flights = await this.fetchSmilesFlights(dto, dto.departureDate);
    this.logger.log(`Voos da smile encontrados com sucesso!`);
    return flights;
  }

  private async fetchSmilesFlights(dto: SmilesSearchDto, date: string) {
    const params = new URLSearchParams({
      cabin: 'ALL',
      originAirportCode: dto.origin,
      destinationAirportCode: dto.destination,
      departureDate: date,
      adults: dto.adults.toString(),
      children: dto.children.toString(),
      infants: dto.infants.toString(),
      forceCongener: 'false',
      memberNumber: dto.memberNumber || '',
    });

    const url = `https://api-air-flightsearch-green.smiles.com.br/v1/airlines/search?${params.toString()}`;

    try {
      const response = await request({
        url,
        method: 'GET',
        headers: {
          Host: 'api-air-flightsearch-green.smiles.com.br',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Channel: 'WEB',
          Origin: 'https://www.smiles.com.br',
          Priority: 'u=1, i',
          Referer: 'https://www.smiles.com.br/',
          'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'X-Api-Key': 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw',
        },
        insecureTLS: false,
      });

      const segments = (response.data as any)?.requestedFlightSegmentList;
      const rawFlightList = segments?.[0]?.flightList || [];
      const allFlights = rawFlightList.map((flight: any) => {
        const firstLeg = flight.legList?.[0];
        const isDirect = flight.stops === 0;

        return {
          uid: flight.uid,
          airline: flight.airline?.name,
          cabin: flight.cabin,
          availableSeats: flight.availableSeats,
          stops: flight.stops,
          departure: {
            ...(isDirect && {
              flightCode: firstLeg ? (firstLeg.operationAirline?.code || firstLeg.marketingAirline?.code) + firstLeg.flightNumber : null,
            }),
            date: flight.departure.date,
            airport: flight.departure.airport.code,
            name: flight.departure.airport.name,
          },
          arrival: {
            date: flight.arrival.date,
            airport: flight.arrival.airport.code,
            name: flight.arrival.airport.name,
          },
          duration: flight.duration,
          miles: flight.fareList?.[0]?.miles || 0,
          ...(!isDirect && {
            legs:
              flight.legList?.map((leg: any) => ({
                flightCode: (leg.operationAirline?.code || leg.marketingAirline?.code) + leg.flightNumber,
                cabin: leg.cabin,
                departure: {
                  date: leg.departure.date,
                  airport: leg.departure.airport.code,
                },
                arrival: {
                  date: leg.arrival.date,
                  airport: leg.arrival.airport.code,
                },
              })) || [],
          }),
        };
      });

      if (allFlights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Smiles', allFlights)
          .catch(() => {});
      }

      let flights = allFlights;
      if (dto.cabin && dto.cabin !== 'ALL') {
        flights = flights.filter((flight) => flight.cabin === dto.cabin);
      }

      if (dto.orderBy === 'preco') {
        flights.sort((a: any, b: any) => a.miles - b.miles);
      } else if (dto.orderBy === 'custo_beneficio') {
        flights.sort((a: any, b: any) => {
          const durationA = a.duration.hours * 60 + a.duration.minutes;
          const durationB = b.duration.hours * 60 + b.duration.minutes;

          const ratioA = durationA > 0 ? a.miles / durationA : Number.MAX_VALUE;
          const ratioB = durationB > 0 ? b.miles / durationB : Number.MAX_VALUE;

          return ratioA - ratioB;
        });
      }

      return flights.slice(0, 3);
    } catch (error: any) {
      this.handleCuimpError('Smiles', error);
    }
  }

  async searchAzul(dto: AzulSearchDto) {
    this.logger.log(`Azul search (via Cuimp): ${dto.origin} -> ${dto.destination} on ${dto.departureDate}`);

    const credentials = await this.crawlerService.getAzulCredentials();
    const [year, month, day] = dto.departureDate.split('-');
    const formattedDate = `${month}/${day}/${year}`;

    const payload = {
      criteria: [
        {
          departureStation: dto.origin,
          arrivalStation: dto.destination,
          std: formattedDate,
          departureDate: dto.departureDate,
        },
      ],
      passengers: [
        { type: 'ADT', count: dto.adults.toString(), companionPass: false },
        ...(dto.children > 0 ? [{ type: 'CHD', count: dto.children.toString(), companionPass: false }] : []),
        ...(dto.infants > 0 ? [{ type: 'INF', count: dto.infants.toString(), companionPass: false }] : []),
      ],
      flexibleDays: {
        daysToLeft: (dto.flexDaysLeft ?? 3).toString(),
        daysToRight: (dto.flexDaysRight ?? 3).toString(),
      },
      currencyCode: 'BRL',
    };

    const url = 'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v5/availability';

    try {
      const response = await request({
        url,
        data: payload,
        headers: {
          accept: 'application/json, text/plain, */*',
          authorization: `Bearer ${credentials.bearerToken}`,
          'content-type': 'application/json',
          culture: 'pt-BR',
          device: 'novosite',
          'ocp-apim-subscription-key': credentials.subscriptionKey,
          origin: 'https://www.voeazul.com.br',
          referer: 'https://www.voeazul.com.br/',
          Cookie: credentials.cookies,
        },
      });

      this.logger.log(`Voo da Azul buscado com sucesso via Cuimp`);

      const allFlights = this.parseAzulFlights(response.data);

      if (allFlights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, dto.departureDate, 'Azul', allFlights)
          .catch(() => {});
      }

      let filteredFlights = allFlights;
      if (dto.cabin && dto.cabin !== 'ALL') {
        const cabinMap: Record<string, string> = {
          ECONOMY: 'Economy',
          BUSINESS: 'Business',
          FIRST: 'First',
        };
        const targetCabin = cabinMap[dto.cabin] || dto.cabin;
        filteredFlights = allFlights.filter((f) => f.cabin === targetCabin);
      }

      if (dto.orderBy === 'preco') {
        filteredFlights.sort((a, b) => a.price - b.price);
      } else if (dto.orderBy === 'custo_beneficio') {
        filteredFlights.sort((a, b) => {
          const durationA = a.duration.hours * 60 + a.duration.minutes;
          const durationB = b.duration.hours * 60 + b.duration.minutes;
          const ratioA = durationA > 0 ? a.price / durationA : Number.MAX_VALUE;
          const ratioB = durationB > 0 ? b.price / durationB : Number.MAX_VALUE;
          return ratioA - ratioB;
        });
      }

      return filteredFlights.slice(0, 3);
    } catch (error: any) {
      this.handleCuimpError('azul', error);
    }
  }

  private parseAzulFlights(data: any): any[] {
    const flights: any[] = [];

    for (const dayData of data || []) {
      const journeys = dayData.journeys || [];

      for (const journey of journeys) {
        if (!journey.status?.available) continue;

        const availableFare = journey.fares?.find((f: any) => f.paxFares?.length > 0);
        if (!availableFare) continue;

        const identifier = journey.identifier;
        const segments = journey.segments || [];
        const isDirect = (identifier.connections?.count || 0) === 0;

        const cabin = availableFare.productClass?.category || 'Economy';

        const flight: any = {
          uid: journey.journeyKey,
          airline: 'Azul',
          cabin,
          availableSeats: this.getMinRemainingSeats(segments),
          stops: identifier.connections?.count || 0,
          departure: {
            ...(isDirect && {
              flightCode: `${identifier.carrierCode}${identifier.flightNumber}`,
            }),
            date: identifier.std,
            airport: identifier.departureStation,
            name: identifier.departureStation,
          },
          arrival: {
            date: identifier.sta,
            airport: identifier.arrivalStation,
            name: identifier.arrivalStation,
          },
          duration: {
            hours: Math.floor(identifier.duration?.hours || 0),
            minutes: Math.floor(identifier.duration?.minutes || 0),
          },
          price: availableFare.paxFares?.[0]?.totalAmount || 0,
          currency: availableFare.paxFares?.[0]?.currencyCode || 'BRL',
          productClass: availableFare.productClass?.name,
        };

        if (!isDirect && segments.length > 0) {
          flight.legs = segments.map((segment: any) => ({
            flightCode: `${segment.identifier.carrierCode}${segment.identifier.flightNumber}`,
            cabin,
            aircraft: segment.equipment?.name,
            departure: {
              date: segment.identifier.std,
              airport: segment.identifier.departureStation,
            },
            arrival: {
              date: segment.identifier.sta,
              airport: segment.identifier.arrivalStation,
            },
          }));
        }

        flights.push(flight);
      }
    }

    return flights;
  }

  private getMinRemainingSeats(segments: any[]): number {
    let minSeats = Number.MAX_VALUE;

    for (const segment of segments) {
      for (const leg of segment.legs || []) {
        const remaining = leg.legInfo?.remainingSeats ?? Number.MAX_VALUE;
        if (remaining < minSeats) {
          minSeats = remaining;
        }
      }
    }

    return minSeats === Number.MAX_VALUE ? 0 : minSeats;
  }

  private handleCuimpError(provider: string, error: any) {
    this.logger.error(`Erro ${provider} (Cuimp): ${error.message}`);

    let status = HttpStatus.BAD_GATEWAY;
    let details = error.message;

    if (error.code === 'ENOTFOUND') {
      details = 'Erro de rede: Não foi possível conectar ao host.';
    } else if (error.status) {
      status = error.status;
      details = `HTTP ${error.status}: ${error.statusText}`;
      if (error.data) {
        details = JSON.stringify(error.data);
      }
    }

    throw new HttpException(
      {
        provider,
        error: `Falha ao buscar voos na ${provider}`,
        details,
      },
      status,
    );
  }
}
