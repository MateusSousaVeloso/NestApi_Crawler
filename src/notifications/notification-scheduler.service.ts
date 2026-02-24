import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { SearchService } from '../search/search.service';
import { WhatsAppService } from './whatsapp.service';
import { formatFlightsForDate } from './flight-formatter';
import { AlertFrequency, SubscriptionStatus } from '../../prisma/generated/client';
import { CabinClass, OrderBy } from '../search/search.dto';
import type { ParsedFlight } from '../search/search.interfaces';
 
interface RouteWithUser {
  id: string;
  originCity: string;
  originIata: string;
  destinationCity: string;
  destinationIata: string;
  cabinType: string;
  dateStart: Date | null;
  dateEnd: Date | null;
  user: { phone_number: string; name: string };
}
 
const CABIN_MAP: Record<string, CabinClass> = {
  ANY: CabinClass.ALL,
  ECONOMY: CabinClass.ECONOMIC,
  BUSINESS: CabinClass.BUSINESS,
  FIRST: CabinClass.FIRST,
};
 
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);
 
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly whatsappService: WhatsAppService,
  ) {}
 
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleEvery6Hours() {
    this.logger.log('Executando alertas a cada 6 horas...');
    await this.processRoutes(AlertFrequency.EVERY_6_HOURS);
  }
 
  @Cron(CronExpression.EVERY_12_HOURS)
  async handleEvery12Hours() {
    this.logger.log('Executando alertas a cada 12 horas...');
    await this.processRoutes(AlertFrequency.EVERY_12_HOURS);
  }
 
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDaily() {
    this.logger.log('Executando alertas diários...');
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
      include: {
        user: {
          select: {
            phone_number: true,
            name: true,
          },
        },
      },
    });
 
    this.logger.log(`Encontradas ${routes.length} rota(s) ativa(s) para frequência ${frequency}`);
 
    const BATCH_SIZE = 15;
    for (let i = 0; i < routes.length; i += BATCH_SIZE) {
      const batch = routes.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((route) => this.processOneRoute(route)),
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
 
  private async processOneRoute(route: RouteWithUser) {
    const phone = route.user.phone_number;
    const dates = this.getDateRange(route.dateStart, route.dateEnd);
 
    if (dates.length === 0) {
      this.logger.warn(`Rota ${route.id}: nenhuma data válida no range`);
      return;
    }
 
    const firstDate = dates[0];
    const lastDate = dates.length > 1 ? dates[dates.length - 1] : undefined;
    const cabin = CABIN_MAP[route.cabinType] || CabinClass.ALL;
    const origin = `${route.originCity} (${route.originIata})`;
    const destination = `${route.destinationCity} (${route.destinationIata})`;
 
    try {
      const result = await this.searchService.searchSmiles({
        origin: route.originIata,
        destination: route.destinationIata,
        departureDate: firstDate,
        finalDate: lastDate,
        adults: 1,
        children: 0,
        infants: 0,
        cabin,
        orderBy: OrderBy.PRECO,
      });
 
      if (lastDate) {
        const grouped = result as Record<string, ParsedFlight[] | { error: string }>;
        for (const date of dates) {
          const flights = grouped[date];
          const flightsArray = Array.isArray(flights) ? flights : [];
          const message = formatFlightsForDate(date, flightsArray, origin, destination);
          await this.whatsappService.sendMessage(phone, message);
        }
      } else {
        const flights = Array.isArray(result) ? result : [];
        const message = formatFlightsForDate(firstDate, flights, origin, destination);
        await this.whatsappService.sendMessage(phone, message);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao buscar voos na rota ${route.id}: ${error.message}`);
 
      const errorMsg =
        `✈️ ${origin} → ${destination}\n\n` +
        `Não foi possível buscar voos. Tentaremos novamente no próximo ciclo.`;
 
      try {
        await this.whatsappService.sendMessage(phone, errorMsg);
      } catch {
        this.logger.error(`Falha ao enviar mensagem de erro para ${phone}`);
      }
    }
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