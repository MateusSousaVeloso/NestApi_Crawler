import { Injectable, Logger } from '@nestjs/common';
import { TapSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { CrawlerClient } from './crawler.client';
import { parseTapResponse } from './parsers/tap.parser';

function tapDateToIso(depDate: string): string {
  // DD.MM.YYYY → YYYY-MM-DD
  const [day, month, year] = depDate.split('.');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(dto: TapSearchDto): Promise<Record<string, ParsedFlight[] | { error: string }>> {
    const raw = await this.pythonClient.callCrawler<TapSearchDto>('tap', dto);

    const result: Record<string, ParsedFlight[] | { error: string }> = {};
    for (const [date, rawData] of Object.entries(raw)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        result[date] = { error: (rawData as { error: string }).error };
        continue;
      }

      const flights = parseTapResponse(rawData);
      if (flights.length > 0) {
        const isoDate = tapDateToIso(date);
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, isoDate, 'TAP', flights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico TAP ${date}: ${err.message}`));
      }
      result[date] = flights.slice(0, 3);
    }

    this.logger.log('Voos da TAP encontrados com sucesso!');
    return result;
  }
}
