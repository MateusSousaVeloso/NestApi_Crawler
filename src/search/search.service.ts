import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { createCuimpHttp } from 'cuimp';
import { AzulSearchDto, SmilesSearchDto } from './search.dto';
import { CrawlerService } from './crawler.service';


@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly curlService: ReturnType<typeof createCuimpHttp>;
  private readonly crawlerService: CrawlerService
  
  constructor() {
    this.curlService = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '136' },
    })
  }

  async searchSmiles(dto: SmilesSearchDto) {
    this.logger.log('Executando requisição Smiles (Réplica Exata)...');

    const params = new URLSearchParams({
      cabin: dto.cabin || 'ALL',
      originAirportCode: dto.origin,
      destinationAirportCode: dto.destination,
      departureDate: dto.departureDate,
      adults: dto.adults.toString(),
      children: dto.children.toString(),
      infants: dto.infants.toString(),
      forceCongener: 'false',
      memberNumber: '',
    });

    const url = `https://api-air-flightsearch-green.smiles.com.br/v1/airlines/search?${params.toString()}`;

    const akamaiCookie =
      'bm_s=YAAQlQ8tFy2SnR2cAQAAwU2SKgQwVp8mozVgbzienuzgcSWN6Jb+WUnJdwiRus+nnhpy+FmDM38ziNtrvjCHOOn0qdjb9XvwbVor+1leZbnRBi9G/TwPia01GRgchXFby/TmXiId0LywnRBo1SK6nmr7L4Dq5H+GpszauQlQmpf75u83EAPO6mz/p1F9svW5WOej4ZcQRyVO0M/ezOWPoaewSficQCRI2X30A1a69Z9CGBq40Hh8LiqHBmRQkkNmdCLCwPG+9KupYK1W41kLj/a2Ah0jrBMbNtmo6KQN17F1hCxQrJUlCNLfiq9L2HeHIhAWcsu9Za8aMZAN4lfkYl6gJJVDVr6Dw58xdJBZpuJ2sZqOCtsR0MijGfKLrqLT3WrqmCXqJeGkHalz7aSUXu5BzzDAeTgOdav9wz4Jf5sQN2GGXLzA1kuplE6CWiH5p73Gq/sA+OZerZ3mq0G4l1hAuViLbSxYddAxYABmrTbQsSWDvpFLeKW8apHm5IZG82XElH/undKWHTkDHpiibdxOlJxE8MmS8tgiLbIVaawi8SX9hDcWQDB9xT0Djy7bkOhNKk1E0Gvj0lqlc2tj+94=';

    try {
      const response = await this.curlService.get(url, {
        headers: {
          Host: 'api-air-flightsearch-green.smiles.com.br',
          Cookie: akamaiCookie,
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
      });

      this.logger.log(`Sucesso! Status: ${response.status}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erro na requisição: ${error.message}`);
      if (error.data) {
        this.logger.error(`Detalhes do erro: ${JSON.stringify(error.data)}`);
      }

      throw new HttpException(
        {
          message: 'Falha na requisição Smiles',
          details: error.message,
          response: error.data,
        },
        HttpStatus.BAD_GATEWAY,
      );
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
      const response = await this.curlService.post(url, payload, {
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

      return {
        provider: 'azul',
        searchParams: {
          origin: dto.origin,
          destination: dto.destination,
          departureDate: dto.departureDate,
          passengers: { adults: dto.adults, children: dto.children, infants: dto.infants },
        },
        data: response.data,
      };
    } catch (error: any) {
      this.handleCuimpError('azul', error);
    }
  }

  private handleCuimpError(provider: string, error: any) {
    this.logger.error(`Erro ${provider} (Cuimp): ${error.message}`);

    // Tratamento de erros baseado na documentação do Cuimp
    let status = HttpStatus.BAD_GATEWAY;
    let details = error.message;

    if (error.code === 'ENOTFOUND') {
      details = 'Erro de rede: Não foi possível conectar ao host.';
    } else if (error.status) {
      status = error.status;
      details = `HTTP ${error.status}: ${error.statusText}`;
      // Tenta pegar o corpo da resposta de erro se disponível
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
