import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { SmilesSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { generateDateRange, runBatchWithFallback } from '../utils/dateUtils';
import { filterAndSortFlights, handleCuimpError } from './crawlers.utils';

@Injectable()
export class SmilesService {
  private readonly logger = new Logger(SmilesService.name);

  constructor(private readonly flightHistoryService: FlightHistoryService) {}

  async search(dto: SmilesSearchDto): Promise<Record<string, ParsedFlight[] | { error: string }>> {
    if (dto.finalDate) {
      const dates = generateDateRange(dto.departureDate, dto.finalDate);
      if (dates.length === 0)
        throw new HttpException(
          { message: 'finalDate deve ser igual ou posterior a departureDate' },
          HttpStatus.BAD_REQUEST,
        );
      if (dates.length > 16)
        throw new HttpException(
          { message: 'Range máximo de 15 dias entre departureDate e finalDate' },
          HttpStatus.BAD_REQUEST,
        );

      const grouped = await runBatchWithFallback<ParsedFlight[] | { error: string }>(
        dates,
        (date) => this.fetchFlights(dto, date),
        (date, error) => {
          this.logger.error(`Erro ao buscar voos para ${date}: ${error.message}`);
          return { error: `Falha ao buscar voos para ${date}: ${error.message}` };
        },
      );

      this.logger.log('Voos da Smiles encontrados com sucesso!');
      return grouped;
    }

    const flights = await this.fetchFlights(dto, dto.departureDate);
    this.logger.log('Voos da Smiles encontrados com sucesso!');
    return { [dto.departureDate]: flights };
  }

  private async fetchFlights(dto: SmilesSearchDto, date: string): Promise<ParsedFlight[]> {
    const params = new URLSearchParams({
      cabin: 'ALL',
      originAirportCode: dto.origin,
      destinationAirportCode: dto.destination,
      departureDate: date,
      adults: dto.adults.toString(),
      children: dto.children.toString(),
      infants: dto.infants.toString(),
      forceCongener: 'true',
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
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'X-Api-Key': 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw',
        },
        insecureTLS: false,
      });

      this.logger.log('Resposta recebida da Smiles:', JSON.stringify(response.data));
      const allFlights = this.parseResponse(response.data);

      if (allFlights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Smiles', allFlights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico Smiles: ${err.message}`));
      }

      return filterAndSortFlights(allFlights, dto.cabin, dto.orderBy, 'miles');
    } catch (error: any) {
      handleCuimpError('Smiles', error, this.logger);
    }
  }

  private parseResponse(data: any): ParsedFlight[] {
    const segments = data?.requestedFlightSegmentList;
    const rawFlightList = segments?.[0]?.flightList || [];

    return rawFlightList.map((flight: any) => {
      const firstLeg = flight.legList?.[0];
      const isDirect = flight.stops === 0;

      const parsed: ParsedFlight = {
        uid: flight.uid,
        airline: flight.airline?.name,
        cabin: flight.cabin,
        availableSeats: flight.availableSeats,
        stops: flight.stops,
        departure: {
          ...(isDirect && {
            flightCode: firstLeg
              ? (firstLeg.operationAirline?.code || firstLeg.marketingAirline?.code) +
                firstLeg.flightNumber
              : null,
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
      };

      if (!isDirect) {
        parsed.legs =
          flight.legList?.map((leg: any) => ({
            flightCode:
              (leg.operationAirline?.code || leg.marketingAirline?.code) + leg.flightNumber,
            cabin: leg.cabin,
            departure: {
              date: leg.departure.date,
              airport: leg.departure.airport.code,
            },
            arrival: {
              date: leg.arrival.date,
              airport: leg.arrival.airport.code,
            },
          })) || [];
      }

      return parsed;
    });
  }
}
