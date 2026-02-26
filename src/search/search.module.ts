import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { FlightHistoryModule } from '../flight-history/flight-history.module';

@Module({
  imports: [FlightHistoryModule],
  controllers: [SearchController],
  providers: [
    SearchService
  ],
  exports: [SearchService],
})
export class SearchModule {}