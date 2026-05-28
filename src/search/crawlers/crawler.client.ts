import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { FlightProvider } from '../search.enums';

@Injectable()
export class CrawlerClient {
  private readonly logger = new Logger(CrawlerClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('PYTHON_CRAWLER_URL') ?? 'http://localhost:8000';
  }

  async callCrawler<TDto, TRaw = unknown>(
    provider: FlightProvider,
    dto: TDto,
  ): Promise<Record<string, TRaw | { error: string }>> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<Record<string, TRaw | { error: string }>>(
          `${this.baseUrl}/search/${provider.toLowerCase()}`,
          dto,
          { timeout: 200000 },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`Falha ao chamar crawler (${provider.toLowerCase()}): ${err.message}`);
      throw new HttpException(
        { message: `Falha ao comunicar com o crawler (${provider})`, detail: err.message },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
