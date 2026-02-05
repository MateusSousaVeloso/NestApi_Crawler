import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { CrawlerService } from './crawler.service';

@Module({
  imports: [HttpModule],
  controllers: [SearchController],
  providers: [SearchService, CrawlerService],
  exports: [CrawlerService],
})
export class SearchModule {}
