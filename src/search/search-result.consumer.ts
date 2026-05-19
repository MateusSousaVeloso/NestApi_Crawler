import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PrismaService } from '../database/prisma.service';
import { FlightHistoryService } from '../flight-history/flight-history.service';
import { FlightProvider } from './search.enums';
import { parseSmilesResponse } from './crawlers/parsers/smiles.parser';
import { parseAzulResponse } from './crawlers/parsers/azul.parser';
import { parseQatarResponse } from './crawlers/parsers/qatar.parser';
import { parseIberiaResponse } from './crawlers/parsers/iberia.parser';
import { parseTapResponse } from './crawlers/parsers/tap.parser';

// mapa de pattern para parser — todos recebem raw e retornam ParsedFlight[]
const PARSER_MAP: Record<string, (raw: any) => any[]> = {
  [`crawl-${FlightProvider.Smiles}`]: parseSmilesResponse,
  [`crawl-${FlightProvider.Azul}`]:   parseAzulResponse,
  [`crawl-${FlightProvider.Qatar}`]:  parseQatarResponse,
  [`crawl-${FlightProvider.Iberia}`]: parseIberiaResponse,
  [`crawl-${FlightProvider.Tap}`]:    parseTapResponse,
};

@Controller()
export class SearchResultsConsumer {
  private readonly logger = new Logger(SearchResultsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flightHistoryService: FlightHistoryService,
  ) {}

  @EventPattern('search_status')
  async handleStatus(@Payload() data: any) {
    const { userSearchId, status } = data;
    await this.prisma.user_searches.update({
      where: { id: userSearchId },
      data: {
        status,
        ...(status === 'doing' ? { startedAt: new Date() } : {}),
      },
    });
    this.logger.log(`Status de ${userSearchId} atualizado para '${status}'`);
  }

  @EventPattern('search_result')
  async handle(@Payload() data: any) {
    const { userSearchId, pattern, result } = data;

    this.logger.log(`[${pattern}] Resultado recebido para busca ${userSearchId}`);

    try {
      // determina se todas as datas falharam ou se pelo menos uma teve sucesso
      const entries = Object.entries(result) as [string, any][];
      const allErrors = entries.every(([, v]) => v?.error);
      const firstError = allErrors ? (entries[0]?.[1]?.error ?? 'Erro desconhecido') : null;

      // atualiza o status da busca no banco
      await this.prisma.user_searches.update({
        where: { id: userSearchId },
        data: {
          status: allErrors ? 'error' : 'done',
          completedAt: new Date(),
          ...(firstError ? { errorMessage: firstError } : {}),
        },
      });

      if (allErrors) {
        this.logger.warn(`[${pattern}] Busca ${userSearchId} concluída com erro: ${firstError}`);
        return;
      }

      // pega a busca para extrair origin, destination e userId
      const userSearch = await this.prisma.user_searches.findUnique({
        where: { id: userSearchId },
        select: { userId: true, params: true },
      });

      const params = userSearch?.params as any;
      const origin = params?.origin;
      const destination = params?.destination;
      const parser = PARSER_MAP[pattern];

      if (!parser) {
        this.logger.error(`[${pattern}] Parser não encontrado para pattern: ${pattern}`);
        return;
      }

      // processa cada data individualmente
      for (const [date, rawData] of entries) {
        if (rawData?.error) {
          this.logger.warn(`[${pattern}] Data ${date} com erro: ${rawData.error}`);
          continue;
        }

        try {
          const flights = parser(rawData);

          if (flights.length === 0) {
            this.logger.log(`[${pattern}] Nenhum voo encontrado em ${date}`);
            continue;
          }

          // salva no flight_search_results e flight_search_details
          const flightResult = await this.flightHistoryService.saveSearchResults(
            origin,
            destination,
            date,
            pattern.replace('crawl-', ''), // ex: 'crawl-Smiles' → 'Smiles'
            flights,
          );

          if (!flightResult) continue;

          // linka o resultado à busca do usuário
          await this.prisma.user_search_results.create({
            data: {
              userSearchId,
              resultId: flightResult.id,
            },
          });

          this.logger.log(`[${pattern}] ${flights.length} voos salvos para ${date}`);
        } catch (err: any) {
          this.logger.error(`[${pattern}] Erro ao salvar data ${date}: ${err.message}`);
        }
      }

      this.logger.log(`[${pattern}] Busca ${userSearchId} processada com sucesso`);
    } catch (err: any) {
      this.logger.error(`[${pattern}] Erro ao processar resultado: ${err.message}`);

      // tenta marcar como erro no banco mesmo se o processamento falhou
      await this.prisma.user_searches.update({
        where: { id: userSearchId },
        data: { status: 'error', completedAt: new Date(), errorMessage: err.message },
      }).catch(() => {});
    }
  }
}
