import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CrawlerService } from './crawler.service';
import { SmilesSearchDto, AzulSearchDto, DispatchSearchDto } from './search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly crawlerService: CrawlerService,
  ) {}

  async dispatchSearch(data: DispatchSearchDto) {
    const crawlerPayload = {
      job_id: crypto.randomUUID(),
      origin: data.search_params.origin,
      destination: data.search_params.destination,
      date: data.search_params.dates.departure_date,
      targets: data.search_params.preferences.programs,
    };

    return {
      status: 'success',
      execution_id: crawlerPayload.job_id,
      results: {
        cheapest_option: {
          airline: 'TAP',
          miles: 60000,
          tax: 200.0,
          stops: 1,
          duration_minutes: 800,
          departure: `${data.search_params.dates.departure_date}T08:00:00`,
          booking_link: 'https://...',
        },
        smart_option: {
          airline: 'LATAM',
          miles: 65000,
          tax: 210.0,
          stops: 0,
          duration_minutes: 600,
          departure: `${data.search_params.dates.departure_date}T22:00:00`,
          booking_link: 'https://...',
        },
      },
    };
  }

  /**
   * Busca voos na API da Smiles
   */
  async searchSmiles(dto: SmilesSearchDto) {
    this.logger.log(`Smiles search: ${dto.origin} -> ${dto.destination} on ${dto.departureDate}`);

    const credentials = await this.crawlerService.getSmilesCredentials();

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
            accept: 'application/json, text/plain, */*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            channel: 'WEB',
            origin: 'https://www.smiles.com.br',
            referer: 'https://www.smiles.com.br/',
            'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            'x-api-key': credentials.apiKey,
            Cookie: credentials.cookies,
          },
          timeout: 30000,
        }),
      );

      this.logger.log(`Smiles search completed successfully`);
      return {
        provider: 'smiles',
        searchParams: {
          origin: dto.origin,
          destination: dto.destination,
          departureDate: dto.departureDate,
          returnDate: dto.returnDate,
          passengers: { adults: dto.adults, children: dto.children, infants: dto.infants },
        },
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Smiles search failed: ${error.message}`);
      throw new HttpException(
        {
          provider: 'smiles',
          error: 'Falha ao buscar voos na Smiles',
          details: error.response?.data || error.message,
        },
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Busca voos na API da Azul
   */
  async searchAzul(dto: AzulSearchDto) {
    this.logger.log(`Azul search: ${dto.origin} -> ${dto.destination} on ${dto.departureDate}`);

    const credentials = await this.crawlerService.getAzulCredentials();

    // Formatar data para o padrão esperado pela Azul (MM/DD/YYYY)
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
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            Cookie: credentials.cookies,
          },
          timeout: 30000,
        }),
      );

      this.logger.log(`Azul search completed successfully`);
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
