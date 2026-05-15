import { Injectable, Logger } from '@nestjs/common';
import { IberiaSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { CrawlerClient } from './crawler.client';
import { parseIberiaResponse } from './parsers/iberia.parser';

@Injectable()
export class IberiaService {
  private readonly logger = new Logger(IberiaService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(dto: IberiaSearchDto): Promise<Record<string, ParsedFlight[] | { error: string }>> {
    const raw = await this.pythonClient.callCrawler<IberiaSearchDto>('iberia', dto);

    const result: Record<string, ParsedFlight[] | { error: string }> = {};
    for (const [date, rawData] of Object.entries(raw)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        result[date] = { error: (rawData as { error: string }).error };
        continue;
      }

      const flights = parseIberiaResponse(rawData);
      if (flights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Iberia', flights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico Iberia ${date}: ${err.message}`));
      }
      result[date] = flights.slice(0, 3);
    }

    this.logger.log('Voos da Iberia encontrados com sucesso!');
    return result;
  }
}
