import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JobsSchedulerService } from './jobs-scheduler.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'JOBS_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'jobs-queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [JobsSchedulerService, PrismaService],
})
export class JobsModule {}
