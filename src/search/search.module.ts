import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SearchController } from './search.controller';
import { SmilesService } from './crawlers/smiles.service';
import { AzulService } from './crawlers/azul.service';
import { QatarService } from './crawlers/qatar.service';
import { IberiaService } from './crawlers/iberia.service';
import { TapService } from './crawlers/tap.service';
import { CrawlerClient } from './crawlers/crawler.client';
import { FlightHistoryModule } from '../flight-history/flight-history.module';
import { JobsModule } from '../jobs/jobs.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [FlightHistoryModule, HttpModule, JobsModule, RabbitMQModule],
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
