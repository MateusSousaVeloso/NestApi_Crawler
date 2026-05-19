import { HttpException, HttpStatus, Injectable, Logger,  Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class CrawlerClient {
  private readonly logger = new Logger(CrawlerClient.name);
  
  constructor(@Inject('RABBITMQ_CLIENT') private readonly client: ClientProxy) {} 

  async callCrawler<TDto, TRaw = unknown>(
    provider: 'smiles' | 'azul' | 'qatar' | 'iberia' | 'tap',
    dto: TDto,
  ): Promise<Record<string, TRaw | { error: string }>> {
    // tenta chamar o crawler e aguarda a resposta, com timeout de 200 segundos
    try {
      return await firstValueFrom(
        this.client.send<Record<string, TRaw | { error: string }>>(
          { cmd: `crawl-${provider}` },
          dto,
        ).pipe(timeout(200000)),
      );
    } catch (err) {
      this.logger.error(`Falha ao chamar crawler (${provider}): ${err.message}`);
      throw new HttpException(
        { message: `Falha ao comunicar com o crawler (${provider})`, detail: err.message },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}