import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { CrawlerService } from './crawler.service';
import { FlightHistoryModule } from '../flight-history/flight-history.module';

@Module({
  imports: [HttpModule, FlightHistoryModule],
  controllers: [SearchController],
  providers: [SearchService, CrawlerService],
  exports: [SearchService, CrawlerService],
})
export class SearchModule {}
