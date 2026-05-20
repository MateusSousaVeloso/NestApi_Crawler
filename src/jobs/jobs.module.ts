import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ResultsConsumer } from './results.consumer';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { FlightHistoryModule } from '../flight-history/flight-history.module';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [RabbitMQModule, FlightHistoryModule],
  controllers: [JobsController],
  providers: [JobsService, ResultsConsumer, PrismaService],
  exports: [JobsService],
})
export class JobsModule {}
