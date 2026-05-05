import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { firefox } from 'playwright';
import { AzulSearchDto } from '../search.dto';
import { generateDateRange, runBatchWithFallback } from '../utils/dateUtils';
import {
  extractCookies,
  mergeCookies,
  handlePartialCookies,
  listCookieNames,
  handleCuimpError,
} from './crawlers.utils';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Adiciona o plugin stealth
chromium.use(StealthPlugin());

const AKAMAI_SENSOR_URL =
  'https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/tOu1cDzEhac1hS1pJ9/GRsXSw/LT9D/DGx5DAoC';
const AKAMAI_SCRIPT_URL =
  'https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/tOu1cDzEhac1hS1pJ9/GRsXSw/LT9D/DGx5DAoC';
const SEC_CPR_PARAMS_URL = 'https://www.voeazul.com.br/_sec/cpr/params';
const PAGE_URL = 'https://www.voeazul.com.br/br/pt/home/selecao-voo';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const SEC_CH_UA = '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"';
const SEC_CPT_POST_URL =
  'https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/cku1cDzEhac1/PiwcSw/Sx5j/JDlwSy4PAg';

type AzulSession = { token: string; cookieString: string; secCptVersion: string };

@Injectable()
export class AzulService {
  private readonly logger = new Logger(AzulService.name);

  async search(dto: AzulSearchDto): Promise<Record<string, any>> {
    const referer = this.buildReferer(dto);
    let cookies = await this.fetchPage(dto);
    const { cookies: cookiesWithAkam, secCptVersion } = await this.fetchAkamScript(
      cookies,
      referer,
    );
    cookies = await this.postSensor(cookiesWithAkam, referer);
    const session = await this.fetchToken(cookies, secCptVersion);

    if (dto.finalDate) {
      const dates = generateDateRange(dto.departureDate, dto.finalDate);
      if (dates.length === 0)
        throw new HttpException(
          { message: 'finalDate deve ser igual ou posterior a departureDate' },
          HttpStatus.BAD_REQUEST,
        );
      if (dates.length > 16)
        throw new HttpException(
          { message: 'Range maximo de 15 dias' },
          HttpStatus.BAD_REQUEST,
        );

      const grouped = await runBatchWithFallback(
        dates,
        (date) => this.fetchFlights(dto, date, session, referer),
        (_, err) => ({ error: err.message }),
      );
      this.logger.log('Busca na Azul em lote finalizada!');
      return grouped;
    }

    const flights = await this.fetchFlights(dto, dto.departureDate, session, referer);
    this.logger.log('Busca na Azul finalizada!');
    return { [dto.departureDate]: flights };
  }

  // Step 1: GET pagina
  private async fetchPage(dto: AzulSearchDto): Promise<string> {
    const pageUrl = `${PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`;
    this.logger.log('[Azul] Step 1: GET pagina...');
    try {
      const r = await request({
        url: pageUrl,
        method: 'GET',
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'max-age=0',
          Priority: 'u=0, i',
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': UA,
        },
        insecureTLS: false,
      });
      const c = extractCookies(r);
      this.logger.log(`[Azul] Step 1 OK. Cookies: ${listCookieNames(c)}`);
      return c;
    } catch (e: any) {
      return handlePartialCookies(e, '', 'Step 1 GET pagina', this.logger);
    }
  }

  // Step 2: GET akam script
  private async fetchAkamScript(
    currentCookies: string,
    referer: string,
  ): Promise<{ cookies: string; secCptVersion: string }> {
    this.logger.log('[Azul] Step 2: GET akam script...');
    try {
      const r = await request({
        url: AKAMAI_SCRIPT_URL,
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          Referer: referer,
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'script',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': UA,
          Cookie: currentCookies,
        },
        insecureTLS: false,
      });
      const cookies = mergeCookies(currentCookies, r);
      const scriptBody: string =
        typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
      const versionMatch = scriptBody.match(
        /[?&]v=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
      const secCptVersion = versionMatch?.[1] ?? '88f7571c-854e-f5b7-3b10-e20ec2440215';
      this.logger.log(`[Azul] Step 2 OK. Cookies: ${listCookieNames(cookies)}`);
      return { cookies, secCptVersion };
    } catch (e: any) {
      const cookies = handlePartialCookies(e, currentCookies, 'Step 2 GET akam script', this.logger);
      return { cookies, secCptVersion: '88f7571c-854e-f5b7-3b10-e20ec2440215' };
    }
  }

  // Steps 3-5: SEC-CPT Challenge
  private async resolveSecCpt(currentCookies: string, referer: string): Promise<string> {
    this.logger.log('[Azul] Step 3: GET /_sec/cpr/params...');
    let secCptPath: string | null = null;
    try {
      const r = await request({
        url: SEC_CPR_PARAMS_URL,
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: referer,
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': UA,
          Cookie: currentCookies,
        },
        insecureTLS: false,
      });
      currentCookies = mergeCookies(currentCookies, r);
      if (typeof r.data === 'object' && r.data !== null && 'url' in r.data) {
        secCptPath = (r.data as any).url;
        this.logger.log(`[Azul] Step 3 OK. SEC-CPT path: ${secCptPath!.substring(0, 80)}...`);
      } else {
        this.logger.warn('[Azul] Step 3: sem url. Pulando SEC-CPT.');
        return currentCookies;
      }
    } catch (e: any) {
      return handlePartialCookies(e, currentCookies, 'Step 3 GET sec-cpr params', this.logger);
    }

    const secCptFullUrl = `https://www.voeazul.com.br${secCptPath}`;
    const secCptPostUrl = `https://www.voeazul.com.br${secCptPath!.split('?')[0]}`;

    this.logger.log('[Azul] Step 4: GET SEC-CPT script...');
    try {
      const r = await request({
        url: secCptFullUrl,
        method: 'GET',
        headers: {
          'Sec-Ch-Ua-Platform': '"Windows"',
          Referer: referer,
          'User-Agent': UA,
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
        },
        insecureTLS: false,
      });
      currentCookies = mergeCookies(currentCookies, r);
      this.logger.log(`[Azul] Step 4 OK. Cookies: ${listCookieNames(currentCookies)}`);
    } catch (e: any) {
      currentCookies = handlePartialCookies(e, currentCookies, 'Step 4 GET SEC-CPT script', this.logger);
    }

    this.logger.log('[Azul] Step 5: POST SEC-CPT solution...');
    try {
      const body = this.generateSecCptSolution('88f7571c-854e-f5b7-3b10-e20ec2440215', currentCookies);
      const r = await request({
        url: secCptPostUrl,
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Type': 'application/json',
          Origin: 'https://www.voeazul.com.br',
          Priority: 'u=1, i',
          Referer: referer,
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': UA,
          Cookie: currentCookies,
        },
        data: JSON.stringify(body),
        insecureTLS: false,
      });
      currentCookies = mergeCookies(currentCookies, r);
      this.logger.log(`[Azul] Step 5 OK. Cookies: ${listCookieNames(currentCookies)}`);
    } catch (e: any) {
      currentCookies = handlePartialCookies(e, currentCookies, 'Step 5 POST SEC-CPT', this.logger);
    }
    return currentCookies;
  }

  /**
   * PLACEHOLDER - Gera a solucao do SEC-CPT challenge.
   * O script do Step 4 contem um puzzle proof-of-work.
   * Body do POST: {"body":"<encrypted_solution>"}
   * Opcoes pra implementar: vm2/isolated-vm, hyper-sdk
   */
  private generateSecCptSolution(version: string, currentCookies: string): any {
    throw new Error(
      'SEC-CPT solver nao implementado. Precisa executar o JS do Akamai via vm2/isolated-vm ou hyper-sdk.',
    );
  }

  // Step 6 / 8a: POST sensor_data
  private async postSensor(currentCookies: string, referer: string): Promise<string> {
    this.logger.log('[Azul] POST sensor_data...');
    const sensorData = await this.generateSensorData(referer);
    try {
      const r = await request({
        url: AKAMAI_SENSOR_URL,
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Type': 'text/plain;charset=UTF-8',
          Origin: 'https://www.voeazul.com.br',
          Priority: 'u=1, i',
          Referer: referer,
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': UA,
          Cookie: currentCookies,
        },
        data: JSON.stringify({ sensor_data: sensorData }),
        insecureTLS: false,
      });
      const c = mergeCookies(currentCookies, r);
      this.logger.log(`[Azul] Sensor POST OK. Cookies: ${listCookieNames(c)}`);
      this.logger.log(`[Azul] Sensor POST sucesso: ${JSON.stringify(r.data)}`);
      return c;
    } catch (e: any) {
      return handlePartialCookies(e, currentCookies, 'POST sensor', this.logger);
    }
  }

  /** PLACEHOLDER - sensor_data via Chromium headless com stealth para resolver Akamai */
  private async generateSensorData(refererUrl: string): Promise<string> {
    this.logger.log('[Azul] Iniciando Chromium com stealth para resolver Akamai...');

    const browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent: UA,
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 1920, height: 1080 },
        geolocation: { latitude: -23.5505, longitude: -46.6333 },
        permissions: ['geolocation'],
        extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' },
      });

      const page = await context.newPage();

      // script de evasão adicional (além do stealth)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // sobrescreve plugins para parecer um navegador real
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ];
            return Object.assign(plugins, { length: plugins.length,});
          },
        });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        // sobrescreve hardware
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        // @ts-ignore
        delete window.__playwright;
        // @ts-ignore
        delete window.__pw_manual;
        // @ts-ignore
        delete window._phantom;
        
        // Sobrescreve permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
            : originalQuery(parameters);

        // Sobrescreve chrome
        (window as any).chrome = {
          runtime: {},
          loadTimes: () => {},
          csi: () => {},
          app: {},
        };

        // Sobrescreve conexão
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false,
          }),
        });
      });

      let capturedSensor: string | null = null;
      let capturedSecCptSolution: string | null = null;

      // intercepta requisição POST para o endpoint do sensor da Akamai e captura o body (sensor_data)
      page.on('request', (req) => {
        if (req.method() === 'POST') {
          this.logger.log(`[Azul] POST interceptado: ${req.url()}`);
          try {
            const postData = req.postData();
            this.logger.log(`[Azul] POST body (primeiros 100 chars): ${postData?.substring(0, 100)}`);
            const body = JSON.parse(postData ?? '{}');
            // tenta capturar a solução sec-cpt
            if (body.body && body.body.includes('cpr/solution')) {
              capturedSecCptSolution = body.body;
              this.logger.log('[Azul] sec-cpt solution interceptada com sucesso.');
            }
            if (body.sensor_data) {
              capturedSensor = body.sensor_data;
              this.logger.log('[Azul] sensor_data interceptado com sucesso.');
            }
          } catch (e: any) {
            this.logger.warn(`[Azul] Erro ao parsear POST body: ${e.message}`);
          }
        }
      });

      page.on('pageerror', (err) => this.logger.error(`[Azul] Erro JS na página: ${err.message}`));
      page.on('response', (res) => {
        const url = res.url();
        if (url.includes('voeazul') || url.includes('1dTvmnOv4'))
          this.logger.log(`[Azul] Response: ${res.status()} ${url.substring(0, 100)}`);
      });

      this.logger.log(`[Azul] Navegando para: ${refererUrl}`);
      await page.goto(refererUrl, { waitUntil: 'networkidle', timeout: 45000 });
      this.logger.log('[Azul] networkidle atingido.');

      if (!capturedSensor) {
        this.logger.warn('[Azul] Sensor não capturado após networkidle. Aguardando 10s...');
        await page.waitForTimeout(10000);
      }

      this.logger.log(`[Azul] Estado final — sensor capturado: ${!!capturedSensor}, SEC-CPT: ${!!capturedSecCptSolution}`);

      if (!capturedSensor) throw new Error('[Azul] Não foi possível interceptar o sensor_data.');

      return capturedSensor;
    } finally {
      await browser.close();
      this.logger.log('[Azul] Chromium fechado.');
    }
  }

  // Step 7: POST token
  private async fetchToken(
    currentCookies: string,
    secCptVersion: string,
  ): Promise<AzulSession> {
    this.logger.log('[Azul] Step 7: POST token...');
    try {
      const r = await request({
        url: 'https://b2c-api.voeazul.com.br/authentication/api/authentication/v1/token',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Length': '0',
          Culture: 'pt-BR',
          Device: 'novosite',
          'Ocp-Apim-Subscription-Key': 'fb38e642c899485e893eb8d0a373cc17',
          Origin: 'https://www.voeazul.com.br',
          Priority: 'u=1, i',
          Referer: 'https://www.voeazul.com.br/',
          'Sec-Ch-Ua': SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': UA,
          Cookie: currentCookies,
        },
        data: '',
        insecureTLS: false,
      });
      const token = (r.data as any)?.data || (r.data as any)?.access_token || '';
      const cookieString = mergeCookies(currentCookies, r);
      this.logger.log('[Azul] Step 7 OK. Token obtido.');
      return { token, cookieString, secCptVersion };
    } catch (e: any) {
      handleCuimpError('Azul Token', e, this.logger);
    }
  }

  // Step 8: sensor -> DELETE bookings -> POST SEC-CPT -> POST availability
  private async fetchFlights(
    dto: AzulSearchDto,
    dateString: string,
    session: AzulSession,
    referer: string,
  ): Promise<any> {
    try {
      const [year, month, day] = dateString.split('-');
      const stdFormat = `${month}/${day}/${year}`;

      const passengers: any[] = [];
      if (dto.adults > 0) passengers.push({ type: 'ADT', count: dto.adults.toString(), companionPass: false });
      if (dto.children > 0) passengers.push({ type: 'CHD', count: dto.children.toString(), companionPass: false });
      if (dto.infants > 0) passengers.push({ type: 'INF', count: dto.infants.toString(), companionPass: false });

      let currentCookies = session.cookieString;

      const bh: Record<string, string> = {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        Authorization: `Bearer ${session.token}`,
        Culture: 'pt-BR',
        Device: 'novosite',
        'Ocp-Apim-Subscription-Key': 'fb38e642c899485e893eb8d0a373cc17',
        Origin: 'https://www.voeazul.com.br',
        Priority: 'u=1, i',
        Referer: 'https://www.voeazul.com.br/',
        'Sec-Ch-Ua': SEC_CH_UA,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': UA,
      };

      this.logger.log(`[Azul] Step 8a: POST sensor para ${dateString}...`);
      currentCookies = await this.postSensor(currentCookies, referer);

      this.logger.log(`[Azul] Step 8b: DELETE bookings para ${dateString}...`);
      try {
        const dr = await request({
          url: 'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v1/bookings',
          method: 'DELETE',
          headers: { ...bh, Cookie: currentCookies },
          insecureTLS: false,
        });
        currentCookies = mergeCookies(currentCookies, dr);
        this.logger.log('[Azul] Step 8b OK.');
      } catch (de: any) {
        this.logger.warn(`[Azul] DELETE bookings: ${de.status || 'erro'} (ignorando)`);
      }

      this.logger.log(`[Azul] Step 8c: POST SEC-CPT solution para ${dateString}...`);
      try {
        const secCptBody = await this.generateSecCptSolution(session.secCptVersion, currentCookies);
        const sc = await request({
          url: SEC_CPT_POST_URL,
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Content-Type': 'application/json',
            Origin: 'https://www.voeazul.com.br',
            Referer: referer,
            'Sec-Ch-Ua': SEC_CH_UA,
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': UA,
            Cookie: currentCookies,
          },
          data: JSON.stringify({ body: secCptBody }),
          insecureTLS: false,
        });
        currentCookies = mergeCookies(currentCookies, sc);
        this.logger.log(`[Azul] Step 8c OK. Status: ${sc.status}`);
      } catch (se: any) {
        this.logger.warn(`[Azul] SEC-CPT solution: ${se.status || 'erro'} (ignorando)`);
      }

      this.logger.log(`[Azul] Step 8d: POST availability para ${dateString}...`);
      const payload = {
        criteria: [
          {
            departureStation: dto.origin,
            arrivalStation: dto.destination,
            std: stdFormat,
            departureDate: dateString,
          },
        ],
        passengers,
        flexibleDays: { daysToLeft: '0', daysToRight: '0' },
        currencyCode: 'BRL',
      };
      const r = await request({
        url: 'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v5/availability',
        method: 'POST',
        headers: { ...bh, 'Content-Type': 'application/json', Cookie: currentCookies },
        data: JSON.stringify(payload),
        insecureTLS: false,
      });
      return r.data;
    } catch (e: any) {
      handleCuimpError('Azul Flights', e, this.logger);
    }
  }

  private buildReferer(dto: AzulSearchDto): string {
    return `${PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`;
  }

  private toStdDate(dateString: string): string {
    const [y, m, d] = dateString.split('-');
    return `${m}/${d}/${y}`;
  }
}
