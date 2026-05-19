import { Injectable, Logger,  Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../../database/prisma.service'
import { FlightProvider } from '../search.enums';

@Injectable()
export class CrawlerClient {
  private readonly logger = new Logger(CrawlerClient.name);
  
  constructor(@Inject('RABBITMQ_CLIENT') private readonly client: ClientProxy,
      private readonly prisma: PrismaService, 
    ) {} 

  async callCrawler<TDto>(
    provider: FlightProvider,
    userId: string,
    dto: TDto,
  ): Promise<{id: string}> {
    // salva no banco
    const { id } = await this.prisma.user_searches.create({
      data: {
        userId,
        provider,
        params: dto as any,
        priority: true, // buscas disparadas pelo usuário têm prioridade
      },
    });
    this.client.emit({ cmd: `crawl-${provider}` }, {userSearchId: id, ...dto as any});

    this.logger.log(`Busca ${id} enfileirada (${provider})`)
    return { id };  
  }
}
