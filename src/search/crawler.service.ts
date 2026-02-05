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

  /**
   * Mock: Em produção, isso usaria Puppeteer/Playwright via proxy (mitmproxy/Burp)
   * para capturar cookies e tokens dinâmicos do site da Smiles.
   */
  async getSmilesCredentials(): Promise<SmilesCredentials> {
    this.logger.log('Fetching Smiles credentials from crawler...');

    // MOCK: Dados capturados via proxy - em produção viriam do crawler real
    return {
      cookies: [
        '_gcl_au=1.1.688531189.1769696539',
        'OptanonAlertBoxClosed=2026-01-29T14:22:21.479Z',
        '_ga=GA1.1.1611048563.1769699344',
        'test_club_smiles=old',
        '_clck=1v0mj48%5E2%5Eg3a%5E0%5E2220',
        'bm_sz=A6E4D6732F8E4DC78E0BF88029C4C650',
        'ak_bmsc=52F3F0B709D94611F03C9DAFD68581B0',
      ].join('; '),
      apiKey: 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw',
    };
  }

  /**
   * Mock: Em produção, isso usaria Puppeteer/Playwright via proxy
   * para capturar cookies e o Bearer token da Azul.
   */
  async getAzulCredentials(): Promise<AzulCredentials> {
    this.logger.log('Fetching Azul credentials from crawler...');

    // MOCK: Dados capturados via proxy - em produção viriam do crawler real
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

  /**
   * Mock: Credenciais da LATAM (para uso futuro)
   */
  async getLatamCredentials(): Promise<{ cookies: string }> {
    this.logger.log('Fetching LATAM credentials from crawler...');
    return {
      cookies: 'mock_latam_cookies',
    };
  }
}
