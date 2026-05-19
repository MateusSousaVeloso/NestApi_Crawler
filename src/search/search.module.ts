import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SmilesService } from './crawlers/smiles.service';
import { AzulService } from './crawlers/azul.service';
import { QatarService } from './crawlers/qatar.service';
import { IberiaService } from './crawlers/iberia.service';
import { TapService } from './crawlers/tap.service';
import { CrawlerClient } from './crawlers/crawler.client';
import { SearchResultsConsumer } from './search-result.consumer';
import { FlightHistoryModule } from '../flight-history/flight-history.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [FlightHistoryModule,
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'priority-queue',
          queueOptions: { durable: true },
        },
      }])
  ],
  controllers: [SearchController, SearchResultsConsumer],
  providers: [
    PrismaService,
    CrawlerClient,
    SearchResultsConsumer,
    SmilesService,
    AzulService,
    QatarService,
    IberiaService,
    TapService,
  ],
  exports: [SmilesService, AzulService, QatarService, IberiaService, TapService],
})

export class SearchModule {}
