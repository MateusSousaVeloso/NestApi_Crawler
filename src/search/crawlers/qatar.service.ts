import { Injectable, Logger } from '@nestjs/common';
import { QatarSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { filterAndSortFlights } from './crawlers.utils';
import { CrawlerClient } from './crawler.client';
import { parseQatarResponse } from './parsers/qatar.parser';

@Injectable()
export class QatarService {
  private readonly logger = new Logger(QatarService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(dto: QatarSearchDto): Promise<Record<string, ParsedFlight[] | { error: string }>> {
    const raw = await this.pythonClient.callCrawler<QatarSearchDto, { award: any; cash: any }>(
      'qatar',
      dto,
    );
  
    const result: Record<string, ParsedFlight[] | { error: string }> = {};
    for (const [date, rawData] of Object.entries(raw)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        const errPayload = rawData;
        result[date] = { error: errPayload.error };
        continue;
      }

      const { award, cash } = rawData as { award: any; cash: any };
      const flights = parseQatarResponse(award, cash);
      if (flights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Qatar', flights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico Qatar ${date}:`, err));
      }
      result[date] = filterAndSortFlights(flights, dto.cabin, dto.orderBy, 'miles');
    }

    this.logger.log('Voos da Qatar encontrados com sucesso!');
    return result;
  }
}
