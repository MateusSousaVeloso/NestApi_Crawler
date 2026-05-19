import { Injectable, Logger } from '@nestjs/common';
import { TapSearchDto } from '../search.dto';
import { CrawlerClient } from './crawler.client';
import { FlightProvider } from '../search.enums';

@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);

  constructor(private readonly pythonClient: CrawlerClient) {}

  async search(userId: string, dto: TapSearchDto): Promise<{ id: string }> {
    return this.pythonClient.callCrawler(FlightProvider.Tap, userId, dto);
  }
}
