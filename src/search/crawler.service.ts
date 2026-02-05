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
   *
   * IMPORTANTE: Esses cookies expiram rapidamente e precisam ser renovados
   * frequentemente. Os cookies Akamai (_abck, bm_sz, ak_bmsc) são essenciais
   * para evitar o bloqueio de bot (406 Not Acceptable).
   */
  async getSmilesCredentials(): Promise<SmilesCredentials> {
    this.logger.log('Fetching Smiles credentials from crawler...');

    // MOCK: Cookies completos capturados via proxy - em produção viriam do crawler real
    // ATENÇÃO: Esses cookies expiram! Atualize com cookies frescos do navegador.
    const cookies = [
      '_gcl_au=1.1.688531189.1769696539',
      'OptanonAlertBoxClosed=2026-01-29T14:22:21.479Z',
      '_ga=GA1.1.1611048563.1769699344',
      'test_club_smiles=old',
      '_clck=1v0mj48%5E2%5Eg3a%5E0%5E2220',
      // Akamai Bot Manager cookies - ESSENCIAIS para evitar 406
      'ak_bmsc=52F3F0B709D94611F03C9DAFD68581B0~000000000000000000000000000000~YAAQlQ8tF2GMnR2cAQAAwgySKh6FoZRxXblAzK/QUKFFnUa/qCOlSPOmTYsjq5MxC3hs5tZzTNJ/lVF9ayh4Q0/WLn5tmrHCU/MUuBJD4k2yxdhzvPj0ZVMten1ZaYxCX6Kz7WrBFBEcJMFHArFw5Efs4uWKrMWjAyA+xP+akhCDjAE73sj0OBdK0NY3p38lZZ5KVqxfzcmulXmQL84xu62cnAcbX7eApQi0ex2uWeVwC0NhRRHoS9u1rQwxxT5pD/lnH9bOyR1LP4buIxM1x6dKDICNie6KT3wKH2AxS2sETOlgO23pJ1+UgjFUVVOox1x3IB+aJwbBCJMjbDepCTrWbv9c7j2FH0GcXBn709fqFzCzKHxDJgKIvlBHvvY9U15x0pGIDyPw5oV+AFTEp50=',
      'bm_sz=A6E4D6732F8E4DC78E0BF88029C4C650~YAAQlQ8tFy+SnR2cAQAAwU2SKh6LLl/HK7m6GtgdiwEwKRpMuQt/HvFvphZNsKaQkP7XwX7T1pIErjPwOYnD8SffsaeK447RsbKqq0crbKhMDjWF19+REThEGCnPfB6WGj21STRoo6SbntJEDxsiEgONcpmgV3w8+uvJsEyPLXTJTwjrEP8NwgkPPHDnIpOBbqEegQdXJgaua3U++ocGwrX3TV9R0QlKzx+N12wxSKMZnDmk1KCRcLxwo6/Gw71ufdLUjrBTzPNBZLF6RsVeFqe5uhfE2M51Cj2LEb56xcIj5hu0+p6iFLAkch1+Ie+SRqhfaM08Nsf6NEC2LPXls3CW4jdeTlLo+m6kN7mG2rGHcXW0xTDLY5LntqGtB2tBkCKxigfrYHocw4eVAktzzsiKdN+gdjamMsQ=~3491396~3360049',
      '_abck=B8CD8FE46C9434892CC69915F2B73967~0~YAAQlQ8tF3eMnR2cAQAAcQ2SKg+B61aZVl11d6OalXmLa0uD0PZ3aDMmBkwZA8rWTBAK381rWcLQe+U6TIW+Q1GnEvHWNN+NDyHHqYF4xdAm1ch8w+6WfCf/AR49YaRzfawf/bZWEK1ZS5a3AiFJ2TZM1M09hwDyrO5t5hdmPJ4edlfHo93h5BDUgeM/aMi7+GDjh+3SuaZ0DDUWDEr1OZUOfzKTVH2wDNxIXA0xprimHBLkSiVBxK2TrxYo3eRDgHH51eAVYWtwUB1lOO5yXwW2I2Ogbp3bQrGtzAE3ypYkjz5VEjh1bKNxmGpkPgpnXwlfwLelrIbhnAL0/wRuOUh1Q3F+tyZCGzETeGu00vf8oTzg6N0WTPMo73aFrsSnVM/Z8xYik8JkzrqwzNSBGcNnUgTTB9LaNqz5ns2tVO8juuOVnSZRxkr6AAwOmIjoI9ySNpaaEsW0xlmxhVPo0RfN2fiHMRFsgjrLkHNytlhZHoNXObmF9T2hqr+TDMpyXwI7VHxrMLovqVMU9gPd/Pmz9ECVWa94uoJ7OlmJUAUykngV12hNs1D+C3Jm7/MQd6ToWjLvOhNQQS+puEEGPV+bwJeoFI99AQGoQZM/jVoCFWZ2xIJx4TUNqqKpXgcdPN34HL7IQi1jL7L2FbvgQUWN3tmuMVKBWXYhWZALsQsa+hhDipM05TB31G8hNVroY7jMcDLjZJNpQ8jDsmiRe8KYQruOd1AhWGJQ15EPYYx6NIwGdx3BOSmeTFb6tHVGZjkHsktDRjmb37dEuP/E1GAsAO/O46YphLHrozuZYRZbOwt7+8zg3t+5ycBXkXHSgk5BXdV1NP4EGwRLTIl20DB/L1O1qb316Uh5ftDbrxEOnWfiDBwG/u2shX/OVBOMnEXX+jyixRfJy6diMJbxriKhYd5Giagfz/vnql9wj1M+Meplcn+mDN/kurIv4Xw2fL2/6qgAJIFQxYotb4Q8p6PdUQ8OYckXWf3M7l+LUtE1sqajhAunXA==~-1~-1~-1',
      'bm_sv=23BBE454ECCFC85B4B373112EC561940~YAAQlQ8tF52UnR2cAQAA8muSKh7ZsXmuo91v3GygKKrBvBfuCUTrE2DAgopSszJhuDPHPS2qN0KGL/i+O1ilP4NXvvCIVYgRcUyOkLUJmPomPHIy5t/C+7pqqm2C6kMngCNRGS7Yx8jH74g2JEjN1K4BPR9Wr/OIGHLlIWkTsoLh/mRatCUYPcYW6dmgNOUsbXaMLxT3FvjZIXLsBJnhdPILIsXU7XEGJ5mAinYsqQ9mEI8J920PRlZI4U+uhVJv7CGctw==~1',
    ];

    return {
      cookies: cookies.join('; '),
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
