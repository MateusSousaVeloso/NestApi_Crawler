import { Injectable, Logger } from '@nestjs/common';
import { SmilesSearchDto } from '../search.dto';
import { ParsedFlight } from '../search.interfaces';
import { FlightHistoryService } from '../../flight-history/flight-history.service';
import { filterAndSortFlights } from './crawlers.utils';
import { CrawlerClient } from './crawler.client';
import { parseSmilesResponse } from './parsers/smiles.parser';
import { FlightProvider } from '../search.enums';

@Injectable()
export class SmilesService {
  private readonly logger = new Logger(SmilesService.name);

  constructor(
    private readonly pythonClient: CrawlerClient,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  async search(userId: string, dto: SmilesSearchDto): Promise<{ id: string }> {
    return this.pythonClient.callCrawler(FlightProvider.Smiles, userId, dto);
  }
}
