import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { WhatsAppService } from './whatsapp.service';
import { UserSearchesModule } from '../user-searches/user-searches.module';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [ScheduleModule.forRoot(), UserSearchesModule],
  providers: [NotificationSchedulerService, WhatsAppService, PrismaService],
})
export class NotificationsModule {}
