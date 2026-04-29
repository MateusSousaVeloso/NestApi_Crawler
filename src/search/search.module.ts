import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SmilesService } from './crawlers/smiles.service';
import { AzulService } from './crawlers/azul.service';
import { FlightHistoryModule } from '../flight-history/flight-history.module';

@Module({
  imports: [FlightHistoryModule],
  controllers: [SearchController],
  providers: [SmilesService, AzulService],
  exports: [SmilesService, AzulService],
})
export class SearchModule {}
