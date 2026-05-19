import { Injectable, Logger } from '@nestjs/common';
import { AzulSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { filterAndSortFlights } from './crawlers.utils';
import { CrawlerClient } from './crawler.client';
import { parseAzulResponse } from './parsers/azul.parser';
import { FlightProvider } from '../search.enums';

@Injectable()
export class AzulService {
  private readonly logger = new Logger(AzulService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(userId: string, dto: AzulSearchDto): Promise<{ id: string }> {
    return this.pythonClient.callCrawler(FlightProvider.Azul, userId, dto);
  }
}
