import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { UserSearchesService } from '../user-searches/user-searches.service';
import {
  CRAWLER_PROVIDERS,
  type CrawlerProvider,
} from '../route-preferences/route-preferences.dto';
import { AlertFrequency, SubscriptionStatus } from '../../prisma/generated/client';
import { CabinClass, OrderBy } from '../search/search.dto';

interface RouteRow {
  id: string;
  originIata: string;
  destinationIata: string;
  provider: string;
  cabinType: string;
  dateStart: Date | null;
  dateEnd: Date | null;
  userId: string;
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
    private readonly userSearches: UserSearchesService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleEvery6Hours() {
    this.logger.log('Enfileirando alertas a cada 6 horas...');
    await this.enqueueRoutes(AlertFrequency.EVERY_6_HOURS);
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleEvery12Hours() {
    this.logger.log('Enfileirando alertas a cada 12 horas...');
    await this.enqueueRoutes(AlertFrequency.EVERY_12_HOURS);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDaily() {
    this.logger.log('Enfileirando alertas diários...');
    await this.enqueueRoutes(AlertFrequency.DAILY);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deactivateExpiredRoutes() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = await this.prisma.userRoutePreference.updateMany({
      where: { isActive: true, dateEnd: { lt: today } },
      data: { isActive: false },
    });

    if (expired.count > 0) {
      this.logger.log(`${expired.count} rota(s) desativada(s) por expiração de data`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireSubscriptions() {
    const expired = await this.prisma.userSubscription.updateMany({
      where: { status: SubscriptionStatus.active, end_date: { lt: new Date() } },
      data: { status: SubscriptionStatus.expired },
    });

    if (expired.count > 0) {
      this.logger.log(`${expired.count} assinatura(s) marcada(s) como expirada(s)`);
    }
  }

  private async enqueueRoutes(frequency: AlertFrequency) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const routes = await this.prisma.userRoutePreference.findMany({
      where: {
        isActive: true,
        alertFrequency: frequency,
        OR: [{ dateEnd: null }, { dateEnd: { gte: today } }],
      },
      select: {
        id: true,
        originIata: true,
        destinationIata: true,
        provider: true,
        cabinType: true,
        dateStart: true,
        dateEnd: true,
        userId: true,
      },
    });

    this.logger.log(`Frequência ${frequency}: ${routes.length} rota(s) ativa(s) para enfileirar`);

    for (const route of routes) {
      try {
        await this.enqueueOne(route);
      } catch (err) {
        this.logger.error(
          `Erro ao enfileirar rota ${route.id} (${route.originIata}->${route.destinationIata}): ${(err as Error).message}`,
        );
      }
    }
  }

  private async enqueueOne(route: RouteRow) {
    const dates = this.getDateRange(route.dateStart, route.dateEnd);
    if (dates.length === 0) {
      this.logger.warn(`Rota ${route.id}: nenhuma data válida no range, ignorando`);
      return;
    }

    const provider = this.resolveProvider(route.provider);
    const params = this.buildParams(provider, route, dates);

    const job = await this.userSearches.create({
      userId: route.userId,
      provider,
      params,
      priority: false, // jobs_queue (não bloqueia priority_queue do usuário)
    });

    this.logger.log(
      `Rota ${route.id} → UserSearch ${job.id} (provider=${provider}, jobs_queue)`,
    );
  }

  private resolveProvider(raw: string): CrawlerProvider {
    return (CRAWLER_PROVIDERS as readonly string[]).includes(raw)
      ? (raw as CrawlerProvider)
      : 'smiles';
  }

  private buildParams(
    provider: CrawlerProvider,
    route: RouteRow,
    dates: string[],
  ): Record<string, unknown> {
    const firstDate = dates[0];
    const lastDate = dates.length > 1 ? dates.at(-1) : undefined;
    const cabin = CABIN_MAP[route.cabinType] || CabinClass.ALL;

    if (provider === 'tap') {
      // crawler TAP (milhas2) usa departureDate/finalDate (YYYY-MM-DD) e faz date-range one-way
      const tap: Record<string, unknown> = {
        origin: route.originIata,
        destination: route.destinationIata,
        departureDate: firstDate,
        adults: 1,
        children: 0,
        infants: 0,
        youth: 0,
        cabin,
      };
      if (lastDate) tap.finalDate = lastDate;
      return tap;
    }

    if (provider === 'iberia') {
      // crawler Iberia (milhas2) suporta date-range via finalDate
      const iberia: Record<string, unknown> = {
        origin: route.originIata,
        destination: route.destinationIata,
        departureDate: firstDate,
        adults: 1,
        children: 0,
        infants: 0,
      };
      if (lastDate) iberia.finalDate = lastDate;
      return iberia;
    }

    // smiles, azul, qatar — FlightSearchDto base
    const params: Record<string, unknown> = {
      origin: route.originIata,
      destination: route.destinationIata,
      departureDate: firstDate,
      adults: 1,
      children: 0,
      infants: 0,
      cabin,
      orderBy: OrderBy.PRECO,
    };
    if (lastDate) params.finalDate = lastDate;
    return params;
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
