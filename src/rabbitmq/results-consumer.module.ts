import { Module } from '@nestjs/common';
import { ResultsConsumerService } from './results-consumer.service';
import { UserSearchesModule } from '../user-searches/user-searches.module';
import { FlightHistoryModule } from '../flight-history/flight-history.module';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [UserSearchesModule, FlightHistoryModule],
  providers: [ResultsConsumerService, PrismaService],
})
export class ResultsConsumerModule {}
