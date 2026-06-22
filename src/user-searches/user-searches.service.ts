import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QUEUE_JOBS, QUEUE_PRIORITY, RabbitMQService } from '../rabbitmq/rabbitmq.service';
import type { CrawlerProvider, ListUserSearchesDto } from './user-searches.dto';

interface CreateInput {
  userId: string;
  provider: CrawlerProvider;
  params: Record<string, unknown>;
  priority: boolean;
}

@Injectable()
export class UserSearchesService {
  private readonly logger = new Logger(UserSearchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  async create({ userId, provider, params, priority }: CreateInput) {
    const userSearch = await this.prisma.userSearch.create({
      data: {
        userId,
        provider,
        priority,
        params: params as object,
        status: 'pending',
      },
      select: { id: true, status: true, searchTimestamp: true, createdAt: true },
    });

    const queue = priority ? QUEUE_PRIORITY : QUEUE_JOBS;
    await this.rabbitmq.publish(queue, {
      userSearchId: userSearch.id,
      userId,
      provider,
      searchTimestamp: userSearch.searchTimestamp.toISOString(),
      data: params,
    });

    this.logger.log(`UserSearch ${userSearch.id} publicado em ${queue}`);
    return userSearch;
  }

  async findByUser(userId: string, filter: ListUserSearchesDto) {
    const take = Math.min(filter.take ? Number.parseInt(filter.take, 10) : 20, 100);
    const where: any = { userId };
    if (filter.status) where.status = filter.status;
    if (filter.provider) where.provider = filter.provider;

    const rows = await this.prisma.userSearch.findMany({
      where,
      take: take + 1,
      skip: filter.cursor ? 1 : 0,
      cursor: filter.cursor ? { id: filter.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        provider: true,
        status: true,
        priority: true,
        params: true,
        searchTimestamp: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdAt: true,
        results: {
          select: { resultId: true },
        },
      },
    });

    const hasMore = rows.length > take;
    return {
      data: hasMore ? rows.slice(0, take) : rows,
      nextCursor: hasMore ? (rows[take]?.id ?? null) : null,
      hasMore,
    };
  }

  async findOne(userId: string, id: string) {
    const row = await this.prisma.userSearch.findFirst({
      where: { id, userId },
      include: {
        results: {
          select: { resultId: true },
        },
      },
    });
    if (!row) throw new NotFoundException('UserSearch não encontrada.');
    return row;
  }

  // Guards forward-only via updateMany — silenciosamente ignora se status atual já
  // passou do ponto (ex: completed chegou antes de started por reordenação).
  /**
   * Retorna os resultados que esta UserSearch produziu, "congelados" no momento
   * em que ela rodou. Se houve update posterior no FlightSearchResult, o snapshot
   * pré-update (em FlightSearchResultHistory) é o estado que esta busca produziu.
   * Se não houve update posterior, o estado atual é o que esta busca produziu.
   */
  async getResultsAtTime(userSearchId: string, userId: string) {
    const userSearch = await this.prisma.userSearch.findFirst({
      where: { id: userSearchId, userId },
      select: {
        id: true,
        provider: true,
        status: true,
        completedAt: true,
        searchTimestamp: true,
        results: { select: { resultId: true } },
      },
    });
    if (!userSearch) throw new NotFoundException('UserSearch não encontrada.');

    const cutoff = userSearch.completedAt ?? userSearch.searchTimestamp;

    const resolved = await Promise.all(
      userSearch.results.map((r) => this.resolveResultAt(r.resultId, cutoff)),
    );

    return {
      userSearchId: userSearch.id,
      status: userSearch.status,
      completedAt: userSearch.completedAt,
      results: resolved.filter((r) => r !== null),
    };
  }

  private async resolveResultAt(resultId: string, cutoff: Date) {
    // Primeiro snapshot criado APÓS o cutoff preserva o estado pré-cutoff
    // (que é o estado que a UserSearch produziu).
    const snapshot = await this.prisma.flightSearchResultHistory.findFirst({
      where: { originalResultId: resultId, snapshotAt: { gt: cutoff } },
      orderBy: { snapshotAt: 'asc' },
      include: { details: true },
    });

    if (snapshot) {
      return {
        sourceType: 'snapshot' as const,
        id: snapshot.id,
        flightDate: snapshot.flightDate,
        searchedAt: snapshot.searchedAt,
        snapshotAt: snapshot.snapshotAt,
        origin: snapshot.origin,
        destination: snapshot.destination,
        provider: snapshot.provider,
        economyMinMiles: snapshot.economyMinMiles,
        premiumMinMiles: snapshot.premiumMinMiles,
        businessMinMiles: snapshot.businessMinMiles,
        firstMinMiles: snapshot.firstMinMiles,
        economyMinJson: snapshot.economyMinJson,
        premiumMinJson: snapshot.premiumMinJson,
        businessMinJson: snapshot.businessMinJson,
        firstMinJson: snapshot.firstMinJson,
        details: snapshot.details.map((d) => ({
          id: d.id,
          searchResultId: snapshot.id,
          uid: d.uid,
          flightCode: d.flightCode,
          airline: d.airline,
          cabin: d.cabin,
          cabinClass: d.cabinClass,
          availableSeats: d.availableSeats,
          stops: d.stops,
          departureTime: d.departureTime,
          departureAirport: d.departureAirport,
          arrivalTime: d.arrivalTime,
          arrivalAirport: d.arrivalAirport,
          departureDate: d.departureDate,
          arrivalDate: d.arrivalDate,
          durationHours: d.durationHours,
          durationMinutes: d.durationMinutes,
          miles: d.miles,
          price: d.price,
          currency: d.currency,
          route: d.route,
          legsJson: d.legsJson,
        })),
      };
    }

    const current = await this.prisma.flightSearchResult.findUnique({
      where: { id: resultId },
      include: {
        details: { orderBy: [{ cabin: 'asc' }, { miles: 'asc' }] },
      },
    });

    if (!current) return null;

    return {
      sourceType: 'current' as const,
      id: current.id,
      flightDate: current.flightDate,
      searchedAt: current.searchedAt,
      snapshotAt: null,
      origin: current.origin,
      destination: current.destination,
      provider: current.provider,
      economyMinMiles: current.economyMinMiles,
      premiumMinMiles: current.premiumMinMiles,
      businessMinMiles: current.businessMinMiles,
      firstMinMiles: current.firstMinMiles,
      economyMinJson: current.economyMinJson,
      premiumMinJson: current.premiumMinJson,
      businessMinJson: current.businessMinJson,
      firstMinJson: current.firstMinJson,
      details: current.details,
    };
  }

  async markStarted(id: string, startedAt: Date) {
    const res = await this.prisma.userSearch.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'doing', startedAt },
    });
    if (res.count === 0) {
      this.logger.warn(`markStarted ignorado para ${id} (status atual já avançou)`);
    }
    return res;
  }

  async markDone(id: string, resultIds: string[], completedAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.userSearch.updateMany({
        where: { id, status: { in: ['pending', 'doing'] } },
        data: { status: 'done', completedAt },
      });
      if (res.count === 0) {
        this.logger.warn(`markDone ignorado para ${id} (status atual já final)`);
        return res;
      }
      if (resultIds.length > 0) {
        await tx.userSearchResult.createMany({
          data: resultIds.map((resultId) => ({ userSearchId: id, resultId })),
          skipDuplicates: true,
        });
      }
      return res;
    });
  }

  async markError(id: string, errorMessage: string, completedAt: Date) {
    const res = await this.prisma.userSearch.updateMany({
      where: { id, status: { in: ['pending', 'doing'] } },
      data: { status: 'error', errorMessage, completedAt },
    });
    if (res.count === 0) {
      this.logger.warn(`markError ignorado para ${id} (status atual já final)`);
    }
    return res;
  }
}
