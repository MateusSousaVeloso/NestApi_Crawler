import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';

export const QUEUE_PRIORITY = 'priority_queue';
export const QUEUE_JOBS = 'jobs_queue';
export const QUEUE_RESULTS = 'results_queue';

const QUEUES = [QUEUE_PRIORITY, QUEUE_JOBS, QUEUE_RESULTS];

export type RabbitMessageHandler = (
  payload: any,
  raw: ConsumeMessage,
) => Promise<'ack' | 'nack'>;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection!: AmqpConnectionManager;
  private publishChannel!: ChannelWrapper;

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    this.connection = amqp.connect([url]);
    this.connection.on('connect', () => this.logger.log('RabbitMQ conectado'));
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn(`RabbitMQ desconectado: ${err?.message ?? 'sem motivo'}`),
    );

    this.publishChannel = this.connection.createChannel({
      json: true,
      setup: async (channel: any) => {
        for (const q of QUEUES) {
          await channel.assertQueue(q, { durable: true });
        }
      },
    });

    await this.publishChannel.waitForConnect();
  }

  async publish(queue: string, payload: object): Promise<void> {
    // `persistent` não consta nos tipos do amqplib 0.10.x, mas é honrado em runtime.
    await this.publishChannel.sendToQueue(queue, payload, { persistent: true } as never);
  }

  consume(queue: string, handler: RabbitMessageHandler): ChannelWrapper {
    return this.connection.createChannel({
      setup: async (channel: any) => {
        await channel.assertQueue(queue, { durable: true });
        await channel.prefetch(10);
        await channel.consume(queue, async (msg: ConsumeMessage | null) => {
          if (!msg) return;
          let payload: any;
          try {
            payload = JSON.parse(msg.content.toString());
          } catch (err) {
            this.logger.error(`Payload inválido em ${queue}: ${(err as Error).message}`);
            channel.nack(msg, false, false);
            return;
          }
          try {
            const decision = await handler(payload, msg);
            if (decision === 'ack') channel.ack(msg);
            else channel.nack(msg, false, false);
          } catch (err) {
            this.logger.error(`Handler de ${queue} falhou: ${(err as Error).message}`);
            channel.nack(msg, false, false);
          }
        });
      },
    });
  }

  async onModuleDestroy() {
    await this.publishChannel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
