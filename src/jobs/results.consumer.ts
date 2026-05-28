import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService, RESULTS_QUEUE } from '../rabbitmq/rabbitmq.service';
import { JobsService } from './jobs.service';
import { FlightHistoryService } from '../flight-history/flight-history.service';
import { parseSmilesResponse } from '../search/crawlers/parsers/smiles.parser';
import { parseQatarResponse } from '../search/crawlers/parsers/qatar.parser';
import { parseAzulResponse } from '../search/crawlers/parsers/azul.parser';
import { parseIberiaResponse } from '../search/crawlers/parsers/iberia.parser';
import { parseTapResponse } from '../search/crawlers/parsers/tap.parser';
import { ParsedFlight } from '../search/search.interfaces';
import { FlightProvider } from '../search/search.enums';

interface ResultMessage {
  jobId: string;
  status?: 'started';
  rawData?: Record<string, unknown>;
  error?: string;
}


@Injectable()
export class ResultsConsumer implements OnModuleInit {
  private readonly logger = new Logger(ResultsConsumer.name);

  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly jobsService: JobsService,
    private readonly flightHistory: FlightHistoryService,
  ) {}

  async onModuleInit() {
    const channel = this.rabbitMQ.getChannel();
    channel.prefetch(1);

    channel.consume(RESULTS_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const message: ResultMessage = JSON.parse(msg.content.toString());
        await this.process(message);
        channel.ack(msg);
      } catch (err) {
        this.logger.error(`Erro ao processar resultado: ${(err as Error).message}`);
        channel.nack(msg, false, false);
      }
    });

    this.logger.log('ResultsConsumer escutando results_queue');
  }

  private async process(message: ResultMessage) {
    const search = await this.jobsService.findById(message.jobId);

    if (message.status === 'started') {
      if (search.status === 'pending') {
        await this.jobsService.markDoing(search.id);
        this.logger.log(`UserSearch ${search.id} iniciado pelo worker`);
      }
      return;
    }

    if (message.error) {
      if (search.status !== 'done') {
        await this.jobsService.markError(search.id, message.error);
        this.logger.warn(`UserSearch ${search.id} falhou: ${message.error}`);
      }
      return;
    }

    const dto = search.params as Record<string, unknown>;
    const raw = message.rawData!;
    const provider = search.provider;
    let totalFlights = 0;

    for (const [date, rawData] of Object.entries(raw)) {
      if (!rawData || (typeof rawData === 'object' && 'error' in rawData)) continue;
      let flightDate = date;
      if (isNaN(new Date(date).getTime())) {
        const fallback = this.extractDepartureDate(dto);
        if (!fallback) {
          this.logger.warn(`Chave de data inválida sem fallback: "${date}" — ignorado`);
          continue;
        }
        flightDate = fallback;
      }

      const flights = this.parse(provider, rawData);
      totalFlights += flights.length;

      if (flights.length > 0) {
        const flightResult = await this.flightHistory
          .saveSearchResults(
            dto.origin as string,
            dto.destination as string,
            flightDate,
            provider,
            flights,
          )
          .catch((err: Error) => {
            this.logger.error(`Erro ao salvar voos [${search.provider}/${flightDate}]: ${err.message}`);
            return null;
          });

        if (flightResult) {
          await this.jobsService
            .addResult(search.id, flightResult.id)
            .catch((err: Error) =>
              this.logger.error(`Erro ao criar UserSearchResult: ${err.message}`),
            );
        }
      }
    }

    if (search.status !== 'done' && search.status !== 'error') {
      await this.jobsService.markDone(search.id);
    }
    this.logger.log(`UserSearch ${search.id} (${search.provider}) concluído — ${totalFlights} voo(s)`);
  }

  private extractDepartureDate(dto: Record<string, unknown>): string | null {
    const raw = (dto.departureDate ?? dto.dep_date) as string | undefined;
    if (!raw) return null;
    // DD.MM.YYYY → YYYY-MM-DD
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('.');
      return `${y}-${m}-${d}`;
    }
    return raw;
  }

  private parse(provider: string, rawData: unknown): ParsedFlight[] {
    switch (provider) {
      case FlightProvider.Smiles:
        return parseSmilesResponse(rawData);
      case FlightProvider.Qatar:
        return parseQatarResponse(rawData, null);
      case FlightProvider.Azul:
        return parseAzulResponse(rawData, null);
      case FlightProvider.Iberia:
        return parseIberiaResponse(rawData);
      case FlightProvider.Tap:
        return parseTapResponse(rawData);
      default:
        this.logger.warn(`Provider desconhecido: ${provider}`);
        return [];
    }
  }
}
