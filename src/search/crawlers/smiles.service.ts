import { Injectable, Logger } from '@nestjs/common';
import { SmilesSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { filterAndSortFlights } from './crawlers.utils';
import { CrawlerClient } from './crawler.client';
import { parseSmilesResponse } from './parsers/smiles.parser';

@Injectable()
export class SmilesService {
  private readonly logger = new Logger(SmilesService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(dto: SmilesSearchDto): Promise<Record<string, ParsedFlight[] | { error: string }>> {
    const raw = await this.pythonClient.callCrawler<SmilesSearchDto>('smiles', dto);

    const result: Record<string, ParsedFlight[] | { error: string }> = {};
    for (const [date, rawData] of Object.entries(raw)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        result[date] = { error: (rawData as { error: string }).error };
        continue;
      }

      const flights = parseSmilesResponse(rawData);
      if (flights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Smiles', flights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico Smiles ${date}: ${err.message}`));
      }
      result[date] = filterAndSortFlights(flights, dto.cabin, dto.orderBy, 'miles');
    }

    this.logger.log('Voos da Smiles encontrados com sucesso!');
    return result;
  }
}
