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

interface ResultMessage {
  jobId: string;
  rawData?: Record<string, unknown>;
  error?: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  smiles: 'Smiles',
  qatar: 'Qatar',
  azul: 'Azul',
  iberia: 'Iberia',
  tap: 'TAP',
};

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

    // prefetch(1) → processa 1 mensagem por vez, evita sobrecarregar o NestJS
    channel.prefetch(1);

    channel.consume(RESULTS_QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const message: ResultMessage = JSON.parse(msg.content.toString());
        await this.process(message);
        channel.ack(msg); // confirma que processou → RabbitMQ remove da fila
      } catch (err) {
        this.logger.error(`Erro ao processar resultado: ${(err as Error).message}`);
        channel.nack(msg, false, false); // nack sem requeue → vai para DLQ (se configurada)
      }
    });

    this.logger.log('ResultsConsumer escutando results_queue');
  }

  private async process(message: ResultMessage) {
    const job = await this.jobsService.findById(message.jobId);

    if (message.error) {
      await this.jobsService.markFailed(job.id, message.error);
      this.logger.warn(`Job ${job.id} falhou: ${message.error}`);
      return;
    }

    const dto = job.payload as Record<string, unknown>;
    const raw = message.rawData!;

    for (const [date, rawData] of Object.entries(raw)) {
      if (!rawData || (typeof rawData === 'object' && 'error' in rawData)) continue;

      const flights = this.parse(job.provider, rawData);

      if (flights.length > 0) {
        await this.flightHistory
          .saveSearchResults(
            dto.origin as string,
            dto.destination as string,
            date,
            PROVIDER_LABEL[job.provider] ?? job.provider,
            flights,
          )
          .catch((err: Error) =>
            this.logger.error(`Erro ao salvar voos [${job.provider}/${date}]: ${err.message}`),
          );
      }
    }

    await this.jobsService.markCompleted(job.id);
    this.logger.log(`Job ${job.id} (${job.provider}) concluído`);
  }

  private parse(provider: string, rawData: unknown): ParsedFlight[] {
    switch (provider) {
      case 'smiles':
        return parseSmilesResponse(rawData);
      case 'qatar': {
        const { award, cash } = rawData as { award: unknown; cash: unknown };
        return parseQatarResponse(award, cash);
      }
      case 'azul': {
        const { miles, cash } = rawData as { miles: unknown; cash: unknown };
        return parseAzulResponse(miles, cash);
      }
      case 'iberia':
        return parseIberiaResponse(rawData);
      case 'tap':
        return parseTapResponse(rawData);
      default:
        this.logger.warn(`Provider desconhecido: ${provider}`);
        return [];
    }
  }
}
