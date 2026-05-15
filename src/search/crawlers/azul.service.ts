import { Injectable, Logger } from '@nestjs/common';
import { AzulSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { filterAndSortFlights } from './crawlers.utils';
import { CrawlerClient } from './crawler.client';
import { parseAzulResponse } from './parsers/azul.parser';

@Injectable()
export class AzulService {
  private readonly logger = new Logger(AzulService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(dto: AzulSearchDto): Promise<Record<string, ParsedFlight[] | { error: string }>> {
    const raw = await this.pythonClient.callCrawler<AzulSearchDto, { miles: any; cash: any }>(
      'azul',
      dto,
    );

    const result: Record<string, ParsedFlight[] | { error: string }> = {};
    for (const [date, rawData] of Object.entries(raw)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        const errPayload = rawData;
        result[date] = { error: errPayload.error };
        continue;
      }

      const { miles, cash } = rawData;
      const flights = parseAzulResponse(miles, cash);
      if (flights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Azul', flights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico Azul ${date}:`, err));
      }
      result[date] = filterAndSortFlights(flights, dto.cabin, dto.orderBy, 'miles');
    }

    this.logger.log('Voos da Azul encontrados com sucesso!');
    return result;
  }
}
