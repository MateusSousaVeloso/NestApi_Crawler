import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { JobsModule } from '../jobs/jobs.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [ScheduleModule.forRoot(), JobsModule, RabbitMQModule],
  providers: [NotificationSchedulerService, PrismaService],
})
export class NotificationsModule {}
