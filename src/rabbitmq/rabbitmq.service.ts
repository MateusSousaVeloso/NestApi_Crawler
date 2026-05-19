import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export const JOBS_QUEUE = 'jobs_queue';
export const RESULTS_QUEUE = 'results_queue';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(JOBS_QUEUE,    { durable: true });
    await this.channel.assertQueue(RESULTS_QUEUE, { durable: true });

    this.logger.log('RabbitMQ conectado');
  }

  publish(queue: string, message: object): void {
    const content = Buffer.from(JSON.stringify(message));
    this.channel.sendToQueue(queue, content, { persistent: true });
  }

  getChannel(): amqp.Channel {
    return this.channel;
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
