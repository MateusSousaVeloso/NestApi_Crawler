import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { WhatsAppService } from './whatsapp.service';
import { SearchModule } from '../search/search.module';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [ScheduleModule.forRoot(), SearchModule],
  providers: [NotificationSchedulerService, WhatsAppService, PrismaService],
})
export class NotificationsModule {}
