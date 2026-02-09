import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { AzulSearchDto, SmilesSearchDto } from './search.dto';
import { CrawlerService } from './crawler.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly crawlerService: CrawlerService;

  async searchSmiles(dto: SmilesSearchDto) {
    this.logger.log('Procurando Voos na Smiles...');

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
      'bm_s=YAAQBckQAtfnEyqcAQAAv4NuQwSUoZ/6B1ADvXllhTXScZBeqjpMB3tN8uRjReUzvJPb3RF9D3vCZUdybwypBLSVQByG4w9Di1b69E5TLaWcQI/UU1oWRkQXOCMAJ+moUWUy7xl8e4CI5Tdz9lzQASDKyPkmwlTa9muxfD8bKrEpMPfSzfJkP7apVEInZ5YHOp8jp3tv9p9J/BobMMASEnloeKnJOis1n3lgL3jf1xDx5aLehQLFTkwGKSoQXy+DzGigaCV/rXyScPcTSVLh6ae1PGkJrioSnk4Xjel58dg5Vk/kUM67MdaXSwM7TGoEP7m/HYxyPGRA1CSPIjbClPJuq6sXCeowGOTBE6ZVXYCiY1qxphsWgqqpEH701Ge+JmxkwIxp8ao9CK2qB1RSgLV4iN64/Lhn4Db/VP+x2wFXV4gyUbjlGcWs6g2DQZNor4IUd4ZGb5K2sN4A1vT/Ik6voxNP85RrO7vWsVZbudKil4fuxYeGHvot3tjsGxgupd6fn8DHT9d1bJvjb4gaow0BM3M3AO8IgNEmCzum/ZGYYLAo71ztWjsIQZK3TLBxR5WImXG/Z7iK517TNHAc2LyF';

    try {
      const response = await request({
        url,
        method: 'GET',
        headers: {
          Host: 'api-air-flightsearch-green.smiles.com.br',
          // Cookie: akamaiCookie,
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

      this.logger.log(`Voos Smiles achados com sucesso! Status: ${response.status}`);
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
