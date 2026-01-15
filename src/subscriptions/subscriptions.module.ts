import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaService } from 'src/database/prisma.service';

@Module({
  providers: [SubscriptionsService, PrismaService],
  controllers: [SubscriptionsController]
})
export class SubscriptionsModule {}
