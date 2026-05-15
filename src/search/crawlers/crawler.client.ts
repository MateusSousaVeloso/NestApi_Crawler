import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

@Injectable()
export class CrawlerClient {
  private readonly logger = new Logger(CrawlerClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>('PYTHON_CRAWLER_URL') ?? 'http://localhost:8000';
    const timeout = Number(this.config.get<string>('PYTHON_CRAWLER_TIMEOUT_MS') ?? 300000);
    this.http = axios.create({ baseURL, timeout, headers: { 'Content-Type': 'application/json' } });
  }

  async callCrawler<TDto, TRaw = unknown>(
    provider: 'smiles' | 'azul' | 'qatar' | 'iberia' | 'tap',
    dto: TDto,
  ): Promise<Record<string, TRaw | { error: string }>> {
    try {
      const response = await this.http.post(`/search/${provider}`, dto);
      return response.data;
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      const detail = error.response?.data?.detail ?? error.message;
      this.logger.error(`Falha ao chamar crawler (${provider}): ${detail}`);
      throw new HttpException(
        { message: `Falha ao comunicar com o crawler (${provider})`, detail },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
