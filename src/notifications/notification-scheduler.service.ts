import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { RabbitMQService, JOBS_QUEUE } from '../rabbitmq/rabbitmq.service';
import { AlertFrequency, SubscriptionStatus } from '../../prisma/generated/client';
import { CabinClass, OrderBy } from '../search/search.dto';

interface RouteToEnqueue {
  id: string;
  userId: string;
  originIata: string;
  destinationIata: string;
  cabinType: string;
  dateStart: Date | null;
  dateEnd: Date | null;
}

const CABIN_MAP: Record<string, CabinClass> = {
  ANY: CabinClass.ALL,
  ECONOMIC: CabinClass.ECONOMIC,
  BUSINESS: CabinClass.BUSINESS,
  FIRST: CabinClass.FIRST,
};

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly rabbitMQ: RabbitMQService,
  ) { }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleEvery6Hours() {
    this.logger.log('Enfileirando alertas a cada 6 horas...');
    await this.processRoutes(AlertFrequency.EVERY_6_HOURS);
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleEvery12Hours() {
    this.logger.log('Enfileirando alertas a cada 12 horas...');
    await this.processRoutes(AlertFrequency.EVERY_12_HOURS);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDaily() {
    this.logger.log('Enfileirando alertas diários...');
    await this.processRoutes(AlertFrequency.DAILY);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deactivateExpiredRoutes() {
    this.logger.log('Verificando rotas expiradas...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = await this.prisma.userRoutePreference.updateMany({
      where: {
        isActive: true,
        dateEnd: { lt: today },
      },
      data: { isActive: false },
    });

    if (expired.count > 0) {
      this.logger.log(`${expired.count} rota(s) desativada(s) por expiração de data`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireSubscriptions() {
    this.logger.log('Verificando assinaturas expiradas...');

    const expired = await this.prisma.userSubscription.updateMany({
      where: {
        status: SubscriptionStatus.active,
        end_date: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.expired },
    });

    if (expired.count > 0) {
      this.logger.log(`${expired.count} assinatura(s) marcada(s) como expirada(s)`);
    }
  }

  private async processRoutes(frequency: AlertFrequency) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const routes = await this.prisma.userRoutePreference.findMany({
      where: {
        isActive: true,
        alertFrequency: frequency,
        OR: [
          { dateEnd: null },
          { dateEnd: { gte: today } },
        ],
      },
    });

    this.logger.log(`Encontradas ${routes.length} rota(s) ativa(s) para frequência ${frequency}`);

    const BATCH_SIZE = 15;
    for (let i = 0; i < routes.length; i += BATCH_SIZE) {
      const batch = routes.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((route) => this.enqueueRoute(route)),
      );

      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
          const route = batch[index];
          this.logger.error(
            `Erro ao processar rota ${route.id} (${route.originIata}->${route.destinationIata}): ${result.reason?.message || result.reason}`,
          );
        }
      }
    }
  }

  private async enqueueRoute(route: RouteToEnqueue) {
    const dates = this.getDateRange(route.dateStart, route.dateEnd);

    if (dates.length === 0) {
      this.logger.warn(`Rota ${route.id}: nenhuma data válida no range`);
      return;
    }

    const cabin = CABIN_MAP[route.cabinType] || CabinClass.ALL;
    const firstDate = dates[0];
    const lastDate = dates.length > 1 ? dates.at(-1) : undefined;

    const payload: Record<string, unknown> = {
      origin: route.originIata,
      destination: route.destinationIata,
      departureDate: firstDate,
      ...(lastDate && { finalDate: lastDate }),
      adults: 1,
      children: 0,
      infants: 0,
      cabin,
      orderBy: OrderBy.PRECO,
      routePreferenceId: route.id,
    };

    const job = await this.jobsService.create('smiles', payload, route.userId);
    this.rabbitMQ.publish(JOBS_QUEUE, { jobId: job.id, provider: 'smiles', payload });
    this.logger.log(`Job ${job.id} enfileirado para rota ${route.id} (${route.originIata}->${route.destinationIata})`);
  }

  private getDateRange(dateStart: Date | null, dateEnd: Date | null): string[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = dateStart && new Date(dateStart) >= today ? new Date(dateStart) : today;
    const end = dateEnd ? new Date(dateEnd) : start;

    if (end < today) return [];

    const dates: string[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }
}