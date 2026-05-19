import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class JobsSchedulerService {
  private readonly logger = new Logger(JobsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('JOBS_CLIENT') private readonly jobsClient: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async dispatchJobs() {
    this.logger.log('Iniciando ciclo de jobs por rotas favoritas...');

    // busca todas as rotas ativas
    const routes = await this.prisma.userRoutePreference.findMany({
      where: { isActive: true },
    });

    this.logger.log(`${routes.length} rotas ativas encontradas`);

    for (const route of routes) {
      try {
        const departureDate = (route.dateStart ?? new Date()).toISOString().split('T')[0];
        const finalDate = route.dateEnd
          ? route.dateEnd.toISOString().split('T')[0]
          : departureDate;

        // cria o UserSearch no banco com status pending
        const userSearch = await this.prisma.user_searches.create({
          data: {
            userId: route.userId,
            provider: route.provider,
            priority: false,
            params: {
              origin: route.originIata,
              destination: route.destinationIata,
              departureDate,
              finalDate,
              adults: 1,
              children: 0,
              infants: 0,
            },
          },
        });

        // publica na jobs-queue com o userSearchId embutido
        this.jobsClient.emit(
          { cmd: `crawl-${route.provider}` },
          {
            userSearchId: userSearch.id,
            origin: route.originIata,
            destination: route.destinationIata,
            departureDate,
            finalDate,
            adults: 1,
            children: 0,
            infants: 0,
          },
        );

        this.logger.log(`Job enfileirado: ${route.originIata} → ${route.destinationIata} (${route.provider}) userId=${route.userId}`);
      } catch (err: any) {
        this.logger.error(`Erro ao enfileirar rota ${route.id}: ${err.message}`);
      }
    }

    this.logger.log('Ciclo de jobs concluído');
  }
}
