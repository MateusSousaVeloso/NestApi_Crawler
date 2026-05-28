import { Injectable, Logger } from '@nestjs/common';
import { TapSearchDto } from '../search.dto';
import { CrawlerClient } from './crawler.client';
import { FlightProvider } from '../search.enums';

@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);

  constructor(private readonly pythonClient: CrawlerClient) {}

  async search(dto: TapSearchDto): Promise<unknown> {
    const raw = await this.pythonClient.callCrawler<TapSearchDto>(FlightProvider.Tap, dto);
    this.logger.log('Voos da TAP encontrados com sucesso!');
    return raw;
  }
}
