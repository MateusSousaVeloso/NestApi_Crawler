import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SmilesService } from './crawlers/smiles.service';
import { AzulService } from './crawlers/azul.service';
import { QatarService } from './crawlers/qatar.service';
import { IberiaService } from './crawlers/iberia.service';
import { TapService } from './crawlers/tap.service';
import { CrawlerClient } from './crawlers/crawler.client';
import { FlightHistoryModule } from '../flight-history/flight-history.module';

@Module({
  imports: [FlightHistoryModule],
  controllers: [SearchController],
  providers: [
    CrawlerClient,
    SmilesService,
    AzulService,
    QatarService,
    IberiaService,
    TapService,
  ],
  exports: [SmilesService, AzulService, QatarService, IberiaService, TapService],
})
export class SearchModule {}
