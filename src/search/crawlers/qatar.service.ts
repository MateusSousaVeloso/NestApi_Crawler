import { Injectable } from '@nestjs/common';
import { QatarSearchDto } from '../search.dto';
import { CrawlerClient } from './crawler.client';
import { FlightProvider } from '../search.enums';

@Injectable()
export class QatarService {
  constructor(private readonly pythonClient: CrawlerClient) {}

  async search(userId: string, dto: QatarSearchDto): Promise<{ id: string }> {
    return this.pythonClient.callCrawler(FlightProvider.Qatar, userId, dto);
  }
}
