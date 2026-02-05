import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CrawlerService } from './crawler.service';
import { SmilesSearchDto, AzulSearchDto } from './search.dto';
import * as tunnel from 'tunnel';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  private readonly tunnelingAgent = tunnel.httpsOverHttp({
    proxy: {
      host: '127.0.0.1',
      port: 8080,
    },
    rejectUnauthorized: false,
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly crawlerService: CrawlerService,
  ) {}

  async searchSmiles(dto: SmilesSearchDto) {
    this.logger.log(`Pesquisa na Smile: ${dto.origin} -> ${dto.destination} saindo em ${dto.departureDate}`);

    const credentials = { apiKey: 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw', cookies: 'test_club_smiles=old' };

    const params = new URLSearchParams({
      cabin: dto.cabin || 'ALL',
      originAirportCode: dto.origin,
      destinationAirportCode: dto.destination,
      departureDate: dto.departureDate,
      adults: dto.adults.toString(),
      children: dto.children.toString(),
      infants: dto.infants.toString(),
      forceCongener: 'false',
      memberNumber: dto.memberNumber || '',
      cookies: '_gid=undefined;',
    });

    if (dto.returnDate) {
      params.append('returnDate', dto.returnDate);
    }

    const url = `https://api-air-flightsearch-green.smiles.com.br/v1/airlines/search?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Host: 'api-air-flightsearch-green.smiles.com.br',
            Cookie: credentials.cookies,
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144"',
            'X-Api-Key': credentials.apiKey,
            'Sec-Ch-Ua-Mobile': '?0',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Channel: 'WEB',
            Origin: 'https://www.smiles.com.br',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            Referer: 'https://www.smiles.com.br/',
            'Accept-Encoding': 'gzip, deflate, br',
            Priority: 'u=1, i',
          },
          httpsAgent: this.tunnelingAgent,
          proxy: false,
          timeout: 30000,
        }),
      );
      this.logger.log(`Voo das Smiles buscado com sucesso`);

      const flights = response.data.requestedFlightSegmentList.flatMap((segment) =>
        segment.flightList.map((flight) => ({
          uid: flight.uid,
          departure: {
            date: flight.departure.date,
            airport: flight.departure.airport.code,
            city: flight.departure.airport.city,
          },
          arrival: {
            date: flight.arrival.date,
            airport: flight.arrival.airport.code,
            city: flight.arrival.airport.city,
          },
          airline: {
            code: flight.airline.code,
            name: flight.airline.name,
          },
          cabin: flight.cabin,
          stops: flight.stops,
          legs: flight.legList.map((leg) => ({
            cabin: leg.cabin,
            departure: {
              date: leg.departure.date,
              airport: leg.departure.airport.code,
            },
            arrival: {
              date: leg.arrival.date,
              airport: leg.arrival.airport.code,
            },
            flightCode: leg.operationAirline.code + leg.flightNumber,
            duration: leg.duration,
          })),
          miles: flight.fareList[0]?.miles || 0,
          segment: flight.type,
        })),
      );
      return flights;
    } catch (error) {
      console.log('Error details:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('ERRO: Não foi possível conectar ao Proxy em 127.0.0.1:8080. Verifique se o Mitmproxy está rodando.');
      }
      throw new HttpException({ provider: 'smiles', error: 'Falha', details: error.message }, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Busca voos na API da Azul
   */
  async searchAzul(dto: AzulSearchDto) {
    this.logger.log(`Azul search: ${dto.origin} -> ${dto.destination} on ${dto.departureDate}`);

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
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            authorization: `Bearer ${credentials.bearerToken}`,
            'content-type': 'application/json',
            culture: 'pt-BR',
            device: 'novosite',
            'ocp-apim-subscription-key': credentials.subscriptionKey,
            origin: 'https://www.voeazul.com.br',
            referer: 'https://www.voeazul.com.br/',
            'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            Cookie: credentials.cookies,
          },
          timeout: 30000,
        }),
      );

      this.logger.log(`Voo da Azul buscado com sucesso`);
      return {
        provider: 'azul',
        searchParams: {
          origin: dto.origin,
          destination: dto.destination,
          departureDate: dto.departureDate,
          passengers: { adults: dto.adults, children: dto.children, infants: dto.infants },
          flexibleDays: { left: dto.flexDaysLeft, right: dto.flexDaysRight },
        },
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Azul search failed: ${error.message}`);
      throw new HttpException(
        {
          provider: 'azul',
          error: 'Falha ao buscar voos na Azul',
          details: error.response?.data || error.message,
        },
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Busca voos na API da LATAM (comentado - implementação futura)
   */
  // async searchLatam(dto: FlightSearchDto) {
  //   this.logger.log(`LATAM search: ${dto.origin} -> ${dto.destination} on ${dto.departureDate}`);
  //
  //   const credentials = await this.crawlerService.getLatamCredentials();
  //
  //   // TODO: Implementar chamada à API da LATAM
  //   // A LATAM possui uma API mais complexa que requer:
  //   // 1. Autenticação OAuth
  //   // 2. Headers específicos
  //   // 3. Payload diferente
  //
  //   return {
  //     provider: 'latam',
  //     message: 'LATAM search not implemented yet',
  //   };
  // }
}
