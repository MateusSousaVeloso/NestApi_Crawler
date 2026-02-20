import { Injectable, Logger } from '@nestjs/common';

export interface SmilesCredentials {
  cookies: string;
  apiKey: string;
}

export interface AzulCredentials {
  cookies: string;
  bearerToken: string;
  subscriptionKey: string;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  async getAzulCredentials(): Promise<AzulCredentials> {
    this.logger.log('Fetching Azul credentials from crawler...');

    return {
      cookies: [
        'at_check=true',
        'AMCVS_04EA1613539237590A490D4D%40AdobeOrg=1',
        '_ga=GA1.1.1048311589.1770225662',
        '_clck=1aumvfg%5E2%5Eg3a%5E0%5E2226',
        'bm_sz=B5FF9C9A2FD47CE6FB23D49C6C2486CA',
      ].join('; '),
      bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NzAyMjg3NTUsImV4cCI6MTc3MDMxNTE1NSwiaXNzIjoiQXp1bCBMaW5oYXMgQWVyZWFzIiwiYXVkIjoiQXJxdWl0ZXR1cmFBenVsIiwidW5pcXVlSWRlbnRpZmllciI6ImY3ZDUzNTFjLTRlYTktNGZhOS1iZjk0LWQzYTFjNzA5MmY1NyJ9.pTgOuKirx_2exMO5UEHpNk4DwiXXvBc-FRyk6Hs6VYk',
      subscriptionKey: 'fb38e642c899485e893eb8d0a373cc17',
    };
  }

  async getLatamCredentials(): Promise<{ cookies: string }> {
    this.logger.log('Fetching LATAM credentials from crawler...');
    return {
      cookies: 'mock_latam_cookies',
    };
  }
}
