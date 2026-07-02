import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QUEUE_RESULTS, RabbitMQService } from './rabbitmq.service';
import { UserSearchesService } from '../user-searches/user-searches.service';
import { FlightHistoryService } from '../flight-history/flight-history.service';
import { PrismaService } from '../database/prisma.service';
import { isCrawlerProvider } from '../search/crawlers/provider';
import { PROVIDER_REGISTRY } from '../search/crawlers/provider.registry';

type ResultEvent =
  | { event: 'started'; userSearchId: string; startedAt: string }
  | {
      event: 'completed';
      userSearchId: string;
      provider: string;
      status: 'success' | 'error';
      completedAt: string;
      data?: Record<string, any> | null;
      error?: string | null;
    };

@Injectable()
export class ResultsConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ResultsConsumerService.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly userSearches: UserSearchesService,
    private readonly flightHistory: FlightHistoryService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.rabbitmq.consume(QUEUE_RESULTS, async (payload: ResultEvent) => {
      try {
        if (payload.event === 'started') {
          await this.handleStarted(payload);
        } else if (payload.event === 'completed') {
          await this.handleCompleted(payload);
        }
        return 'ack';
      } catch (err) {
        this.logger.error(`Falha ao processar result: ${(err as Error).message}`);
        return 'nack';
      }
    });
    this.logger.log('Subscribed to results_queue');
  }

  private async handleStarted(payload: { userSearchId: string; startedAt: string }) {
    await this.userSearches.markStarted(payload.userSearchId, new Date(payload.startedAt));
  }

  private async handleCompleted(payload: Extract<ResultEvent, { event: 'completed' }>) {
    const completedAt = new Date(payload.completedAt);

    if (payload.status === 'error') {
      await this.userSearches.markError(
        payload.userSearchId,
        payload.error ?? 'erro desconhecido',
        completedAt,
      );
      return;
    }

    const search = await this.prisma.userSearch.findUnique({
      where: { id: payload.userSearchId },
      select: { params: true, provider: true },
    });
    if (!search) {
      this.logger.warn(`UserSearch ${payload.userSearchId} não encontrada`);
      return;
    }

    const params = search.params as { origin: string; destination: string };
    const resultIds = await this.persistResults(
      payload.provider,
      params.origin,
      params.destination,
      payload.data ?? {},
    );

    await this.userSearches.markDone(payload.userSearchId, resultIds, completedAt);
  }

  private async persistResults(
    provider: string,
    origin: string,
    destination: string,
    raw: Record<string, any>,
  ): Promise<string[]> {
    if (!isCrawlerProvider(provider)) {
      this.logger.warn(`Provider desconhecido: ${provider}`);
      return [];
    }
    const { label: providerLabel, parse } = PROVIDER_REGISTRY[provider];
    const resultIds: string[] = [];

    for (const [date, rawData] of Object.entries(raw)) {
      if (!rawData || typeof rawData !== 'object' || 'error' in rawData) continue;

      const flights = parse(rawData);
      if (flights.length === 0) continue;

      try {
        const saved = await this.flightHistory.saveSearchResults(
          origin,
          destination,
          date,
          providerLabel,
          flights,
        );
        if (saved) resultIds.push(saved.id);
      } catch (err) {
        this.logger.error(
          `Erro ao persistir histórico ${providerLabel} ${date}: ${(err as Error).message}`,
        );
      }
    }

    return resultIds;
  }
}
