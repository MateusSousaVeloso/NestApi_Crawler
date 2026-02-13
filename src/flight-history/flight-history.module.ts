import { Module } from '@nestjs/common';
import { FlightHistoryService } from './flight-history.service';
import { FlightHistoryController } from './flight-history.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  providers: [FlightHistoryService, PrismaService],
  controllers: [FlightHistoryController],
  exports: [FlightHistoryService],
})
export class FlightHistoryModule {}
