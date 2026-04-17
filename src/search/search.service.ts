import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { AzulSearchDto, SmilesSearchDto } from './search.dto';
import { FlightHistoryService } from '../flight-history/flight-history.service';
import { ParsedFlight } from './search.interfaces';
import { firefox } from 'playwright';

const AZUL_AKAMAI_SENSOR_URL = 'https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/tOu1cDzEhac1hS1pJ9/GRsXSw/LT9D/DGx5DAoC';
const AZUL_AKAMAI_SCRIPT_URL = 'https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/tOu1cDzEhac1hS1pJ9/GRsXSw/LT9D/DGx5DAoC'
const AZUL_SEC_CPR_PARAMS_URL = 'https://www.voeazul.com.br/_sec/cpr/params';
const AZUL_PAGE_URL = 'https://www.voeazul.com.br/br/pt/home/selecao-voo';
const AZUL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const AZUL_SEC_CH_UA = '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"';
const AZUL_SEC_CPT_BASE_URL = 'https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/cku1cDzEhac1/PiwcSw/Sx5j/JDlwSy4PAg';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  constructor(private readonly flightHistoryService: FlightHistoryService) {}

  async searchSmiles(dto: SmilesSearchDto) {
    if (dto.finalDate) {
      const start = new Date(dto.departureDate + 'T00:00:00');
      const end = new Date(dto.finalDate + 'T00:00:00');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        throw new HttpException({ message: 'finalDate deve ser igual ou posterior a departureDate' }, HttpStatus.BAD_REQUEST);
      }

      if (diffDays > 15) {
        throw new HttpException({ message: 'Range máximo de 15 dias entre departureDate e finalDate' }, HttpStatus.BAD_REQUEST);
      }

      const dates: string[] = [];
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }

      const results = await Promise.all(
        dates.map((date) =>
          this.fetchSmilesFlights(dto, date).catch((error) => {
            this.logger.error(`Erro ao buscar voos para ${date}: ${error.message}`);
            return { error: `Falha ao buscar voos para ${date}: ${error.message}` };
          }),
        ),
      );

      const grouped: Record<string, ParsedFlight[] | { error: string }> = {};
      dates.forEach((date, index) => {
        grouped[date] = results[index];
      });

      this.logger.log(`Voos da smile encontrados com sucesso!`);
      return grouped;
    }
    const flights = await this.fetchSmilesFlights(dto, dto.departureDate);
    this.logger.log(`Voos da smile encontrados com sucesso!`);
    return { [dto.departureDate]: flights };
  }

  private async fetchSmilesFlights(dto: SmilesSearchDto, date: string): Promise<ParsedFlight[]> {
    const params = new URLSearchParams({
      cabin: 'ALL',
      originAirportCode: dto.origin,
      destinationAirportCode: dto.destination,
      departureDate: date,
      adults: dto.adults.toString(),
      children: dto.children.toString(),
      infants: dto.infants.toString(),
      forceCongener: 'true',
      memberNumber: dto.memberNumber || '',
    });

    const url = `https://api-air-flightsearch-green.smiles.com.br/v1/airlines/search?${params.toString()}`;

    try {
      const response = await request({
        url,
        method: 'GET',
        headers: {
          Host: 'api-air-flightsearch-green.smiles.com.br',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Channel: 'WEB',
          Origin: 'https://www.smiles.com.br',
          Priority: 'u=1, i',
          Referer: 'https://www.smiles.com.br/',
          'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'X-Api-Key': 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw',
        },
        insecureTLS: false,
      });
      this.logger.log(`Resposta recebida da Smiles:`, JSON.stringify(response.data));
      const allFlights = this.parseSmilesResponse(response.data);

      if (allFlights.length > 0) {
        this.flightHistoryService
          .saveSearchResults(dto.origin, dto.destination, date, 'Smiles', allFlights)
          .catch((err) => this.logger.error(`Erro ao salvar histórico Smiles: ${err.message}`));
      }

      return this.filterAndSortFlights(allFlights, dto.cabin, dto.orderBy, 'miles');
    } catch (error: any) {
      this.handleCuimpError('Smiles', error);
    }
  }

  private parseSmilesResponse(data: any): ParsedFlight[] {
    const segments = data?.requestedFlightSegmentList;
    const rawFlightList = segments?.[0]?.flightList || [];

    return rawFlightList.map((flight: any) => {
      const firstLeg = flight.legList?.[0];
      const isDirect = flight.stops === 0;

      const parsed: ParsedFlight = {
        uid: flight.uid,
        airline: flight.airline?.name,
        cabin: flight.cabin,
        availableSeats: flight.availableSeats,
        stops: flight.stops,
        departure: {
          ...(isDirect && {
            flightCode: firstLeg ? (firstLeg.operationAirline?.code || firstLeg.marketingAirline?.code) + firstLeg.flightNumber : null,
          }),
          date: flight.departure.date,
          airport: flight.departure.airport.code,
          name: flight.departure.airport.name,
        },
        arrival: {
          date: flight.arrival.date,
          airport: flight.arrival.airport.code,
          name: flight.arrival.airport.name,
        },
        duration: flight.duration,
        miles: flight.fareList?.[0]?.miles || 0,
      };

      if (!isDirect) {
        parsed.legs =
          flight.legList?.map((leg: any) => ({
            flightCode: (leg.operationAirline?.code || leg.marketingAirline?.code) + leg.flightNumber,
            cabin: leg.cabin,
            departure: {
              date: leg.departure.date,
              airport: leg.departure.airport.code,
            },
            arrival: {
              date: leg.arrival.date,
              airport: leg.arrival.airport.code,
            },
          })) || [];
      }

      return parsed;
    });
  }

  // ===============================================
  //  AZUL - Fluxo completo via cuimp:
  //  1. GET pagina -> cookies iniciais
  //  2. GET /akam/13/4bc5f6ae -> _abck, bm_sz, bm_s, bm_so, bm_ss
  //  3. GET /_sec/cpr/params -> URL do SEC-CPT challenge
  //  4. GET {sec-cpt-url}?v=xxx -> script do puzzle
  //  5. POST {sec-cpt-url} -> solucao do puzzle
  //  6. POST xRJMA0B -> sensor_data -> valida _abck
  //  7. POST token -> Bearer
  //  8. Loop: POST sensor -> DELETE bookings -> POST availability
  // ===============================================

  async searchAzul(dto: AzulSearchDto) {
    const referer = this.buildAzulReferer(dto);
    let cookies = await this.fetchAzulPage(dto);
    const { cookies: cookiesWithAkam, secCptVersion } = await this.fetchAzulAkamScript(cookies, referer);
    cookies = await this.postAzulSensor(cookies, referer);
    const session = await this.fetchAzulToken(cookies, secCptVersion);

    if (dto.finalDate) {
      const start = new Date(dto.departureDate + 'T00:00:00');
      const end = new Date(dto.finalDate + 'T00:00:00');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) throw new HttpException({ message: 'finalDate deve ser igual ou posterior a departureDate' }, HttpStatus.BAD_REQUEST);
      if (diffDays > 15) throw new HttpException({ message: 'Range maximo de 15 dias' }, HttpStatus.BAD_REQUEST);
      const dates: string[] = [];
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const results = await Promise.all(
        dates.map((date) => this.fetchAzulFlights(dto, date, session, referer).catch((e) => ({ error: e.message }))),
      );
      const grouped: Record<string, any> = {};
      dates.forEach((date, i) => {
        grouped[date] = results[i];
      });
      this.logger.log('Busca na Azul em lote finalizada!');
      return grouped;
    }
    const flights = await this.fetchAzulFlights(dto, dto.departureDate, session, referer);
    this.logger.log('Busca na Azul finalizada!');
    return { [dto.departureDate]: flights };
  }

  // Step 1: GET pagina
  private async fetchAzulPage(dto: AzulSearchDto): Promise<string> {
    const pageUrl = `${AZUL_PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toAzulStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`;
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
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': AZUL_UA,
        },
        insecureTLS: false,
      });
      const c = this.extractCookies(r);
      this.logger.log(`[Azul] Step 1 OK. Cookies: ${this.listCookieNames(c)}`);
      return c;
    } catch (e: any) {
      return this.handlePartialCookies(e, '', 'Step 1 GET pagina');
    }
  }

  // Step 2: GET /akam/13/4bc5f6ae
  private async fetchAzulAkamScript(currentCookies: string, referer: string): Promise<{ cookies: string; secCptVersion: string }> {
    this.logger.log('[Azul] Step 2: GET akam script...');
    try {
      const r = await request({
        url: AZUL_AKAMAI_SCRIPT_URL,
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          Referer: referer,
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'script',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': AZUL_UA,
          Cookie: currentCookies,
        },
        insecureTLS: false,
      });
      const cookies = this.mergeCookies(currentCookies, r);

      const scriptBody: string = typeof r.data == 'string' ? r.data : JSON.stringify(r.data)
      const versionMatch = scriptBody.match(/[?&]v=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      const secCptVersion = versionMatch?.[1] ?? '88f7571c-854e-f5b7-3b10-e20ec2440215'; 
      this.logger.log(`[Azul] Step 2 OK. Cookies: ${this.listCookieNames(cookies)}`);
      return {cookies, secCptVersion};
    } catch (e: any) {
      const cookies = this.handlePartialCookies(e, currentCookies, 'Step 2 GET akam script');
      return { cookies, secCptVersion: '88f7571c-854e-f5b7-3b10-e20ec2440215' };
    }
  }

  // Steps 3-5: SEC-CPT Challenge
  //  3. GET /_sec/cpr/params -> {"url":"/AmCOO/.../QtbixnaEsRAg?v=xxx"}
  //  4. GET {url} (com ?v=) -> script do challenge
  //  5. POST {url} (sem ?v=) -> solucao proof-of-work
  private async resolveSecCpt(currentCookies: string, referer: string): Promise<string> {
    this.logger.log('[Azul] Step 3: GET /_sec/cpr/params...');
    let secCptPath: string | null = null;
    try {
      const r = await request({
        url: AZUL_SEC_CPR_PARAMS_URL,
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: referer,
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': AZUL_UA,
          Cookie: currentCookies,
        },
        insecureTLS: false,
      });
      currentCookies = this.mergeCookies(currentCookies, r);
      if (typeof r.data === 'object' && r.data !== null && 'url' in r.data) {
        secCptPath = (r.data as any).url;
        this.logger.log(`[Azul] Step 3 OK. SEC-CPT path: ${secCptPath!.substring(0, 80)}...`);
      } else {
        this.logger.warn('[Azul] Step 3: sem url. Pulando SEC-CPT.');
        return currentCookies;
      }
    } catch (e: any) {
      return this.handlePartialCookies(e, currentCookies, 'Step 3 GET sec-cpr params');
    }

    const secCptFullUrl = `https://www.voeazul.com.br${secCptPath}`;
    const secCptPostUrl = `https://www.voeazul.com.br${secCptPath!.split('?')[0]}`;

    // Step 4: GET SEC-CPT script
    this.logger.log('[Azul] Step 4: GET SEC-CPT script...');
    try {
      const r = await request({
        url: secCptFullUrl,
        method: 'GET',
        headers: {
          'Sec-Ch-Ua-Platform': '"Windows"',
          Referer: referer,
          'User-Agent': AZUL_UA,
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
        },
        insecureTLS: false,
      });
      currentCookies = this.mergeCookies(currentCookies, r);
      this.logger.log(`[Azul] Step 4 OK. Cookies: ${this.listCookieNames(currentCookies)}`);
    } catch (e: any) {
      currentCookies = this.handlePartialCookies(e, currentCookies, 'Step 4 GET SEC-CPT script');
    }

    // Step 5: POST SEC-CPT solution
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
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': AZUL_UA,
          Cookie: currentCookies,
        },
        data: JSON.stringify(body),
        insecureTLS: false,
      });
      currentCookies = this.mergeCookies(currentCookies, r);
      this.logger.log(`[Azul] Step 5 OK. Cookies: ${this.listCookieNames(currentCookies)}`);
    } catch (e: any) {
      currentCookies = this.handlePartialCookies(e, currentCookies, 'Step 5 POST SEC-CPT');
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
    throw new Error('SEC-CPT solver nao implementado. Precisa executar o JS do Akamai via vm2/isolated-vm ou hyper-sdk.');
  }

  // Step 6 / 8a: POST sensor_data (xRJMA0B)
  private async postAzulSensor(currentCookies: string, referer: string): Promise<string> {
    this.logger.log('[Azul] POST sensor_data...');
    const sensorData = await this.generateSensorData(referer);
    try {
      const r = await request({
        url: AZUL_AKAMAI_SENSOR_URL,
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Type': 'text/plain;charset=UTF-8',
          Origin: 'https://www.voeazul.com.br',
          Priority: 'u=1, i',
          Referer: referer,
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': AZUL_UA,
          Cookie: currentCookies,
        },
        data: JSON.stringify({ sensor_data: sensorData }),
        insecureTLS: false,
      });
      const c = this.mergeCookies(currentCookies, r);
      this.logger.log(`[Azul] Sensor POST OK. Cookies: ${this.listCookieNames(c)}`);
      this.logger.log(`[Azul] Sensor POST sucesso: ${JSON.stringify(r.data)}`);
      return c;
    } catch (e: any) {
      return this.handlePartialCookies(e, currentCookies, 'POST sensor');
    }
  }

  /** PLACEHOLDER - sensor_data generator. Opcoes: hyper-sdk, akamai-bmp-generator */
  private async generateSensorData(refererUrl: string): Promise<string> {
    this.logger.log('[Azul] Iniciando Firefox headless para resolver Akamai...');
    
    const browser = await firefox.launch({ 
      headless: true,
      firefoxUserPrefs: {
        'dom.webdriver.enabled': false,
        'useAutomationExtension': false,
        'media.navigator.enabled': true,
        'media.peerconnection.enabled': true,
        'datareporting.healthreport.uploadEnabled': false,
        'datareporting.policy.dataSubmissionEnabled': false,
        'toolkit.telemetry.enabled': false,
        'toolkit.telemetry.unified': false,
        'webgl.disabled': false,
        'webgl.enable-webgl2': true,
        'browser.safebrowsing.enabled': false,
        'browser.safebrowsing.malware.enabled': false,
        'media.navigator.hardware_video_decoding.force-enabled': true,
      },
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 1366, height: 768 },
        permissions: ['geolocation'],
        extraHTTPHeaders: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      await context.setGeolocation({ latitude: -23.5505, longitude: -46.6333 });

      const page = await context.newPage();

      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
              { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
            ];
            plugins['length'] = plugins.length;
            return plugins;
          },
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en-US', 'en'],
        });

        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
        });

        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });

        // @ts-ignore
        delete window.__playwright;
        // @ts-ignore
        delete window.__pw_manual;
        // @ts-ignore
        delete window._phantom;

        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: () => 0,
        });

        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32',
        });

        Object.defineProperty(navigator, 'vendor', {
          get: () => 'Google Inc.',
        });

        Object.defineProperty(screen, 'width', { get: () => 1366 });
        Object.defineProperty(screen, 'height', { get: () => 768 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1366 });
        Object.defineProperty(screen, 'availHeight', { get: () => 728 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
      });

      let capturedSensor: string | null = null;

      page.on('request', (request) => {
        if (request.method() === 'POST') {
          this.logger.log(`[Azul] POST interceptado: ${request.url()}`);
          try {
            const postData = request.postData();
            this.logger.log(`[Azul] POST body (primeiros 100 chars): ${postData?.substring(0, 100)}`);
            const body = JSON.parse(postData ?? '{}');
            if (body.sensor_data) {
              capturedSensor = body.sensor_data;
              this.logger.log('[Azul] sensor_data interceptado com sucesso.');
            }
          } catch (e: any) {
            this.logger.warn(`[Azul] Erro ao parsear POST body: ${e.message}`);
          }
        }
      });

      page.on('pageerror', (err) => {
        this.logger.error(`[Azul] Erro JS na página: ${err.message}`);
      });

      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('voeazul') || url.includes('1dTvmnOv4')) {
          this.logger.log(`[Azul] Response: ${response.status()} ${url.substring(0, 100)}`);
        }
      });

      this.logger.log(`[Azul] Navegando para: ${refererUrl}`);
      await page.goto(refererUrl, { waitUntil: 'networkidle', timeout: 45000 });
      this.logger.log('[Azul] networkidle atingido.');

      if (!capturedSensor) {
        this.logger.warn('[Azul] Sensor não capturado após networkidle. Aguardando 5s...');
        await page.waitForTimeout(10000);
      }

      this.logger.log(`[Azul] Estado final — sensor capturado: ${!!capturedSensor}`);

      if (!capturedSensor) {
        throw new Error('[Azul] Não foi possível interceptar o sensor_data.');
      }

      return capturedSensor;

    } finally {
      await browser.close();
      this.logger.log('[Azul] Firefox headless fechado.');
    }
  }

  // Step 7: POST token
  private async fetchAzulToken(currentCookies: string, secCptVersion: string): Promise<{ token: string; cookieString: string; secCptVersion: string}> {
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
          'Sec-Ch-Ua': AZUL_SEC_CH_UA,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': AZUL_UA,
          Cookie: currentCookies,
        },
        data: '',
        insecureTLS: false,
      });
      const token = (r.data as any)?.data || (r.data as any)?.access_token || '';
      const cookieString = this.mergeCookies(currentCookies, r);
      this.logger.log('[Azul] Step 7 OK. Token obtido.');
      return { token, cookieString, secCptVersion };
    } catch (e: any) {
      this.handleCuimpError('Azul Token', e);
    }
  }

  // Step 8: sensor -> DELETE bookings -> POST availability
  private async fetchAzulFlights(dto: AzulSearchDto, dateString: string, session: { token: string; cookieString: string, secCptVersion: string }, referer: string) {
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
        'Sec-Ch-Ua': AZUL_SEC_CH_UA,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': AZUL_UA,
      };

      this.logger.log(`[Azul] Step 8a: POST sensor para ${dateString}...`);
      currentCookies = await this.postAzulSensor(currentCookies, referer);

      this.logger.log(`[Azul] Step 8b: DELETE bookings para ${dateString}...`);
      try {
        const dr = await request({
          url: 'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v1/bookings',
          method: 'DELETE',
          headers: { ...bh, Cookie: currentCookies },
          insecureTLS: false,
        });
        currentCookies = this.mergeCookies(currentCookies, dr);
        this.logger.log('[Azul] Step 8b OK.');
      } catch (de: any) {
        this.logger.warn(`[Azul] DELETE bookings: ${de.status || 'erro'} (ignorando)`);
      }

          this.logger.log(`[Azul] Step 8c: POST SEC-CPT solution para ${dateString}...`);
      try {
        const secCptPostUrl = `https://www.voeazul.com.br/1dTvmnOv4/8SdY/S3bsA/cku1cDzEhac1/PiwcSw/Sx5j/JDlwSy4PAg`;
        const secCptBody = await this.generateSecCptSolution(session.secCptVersion, currentCookies);
        const sc = await request({
          url: secCptPostUrl,
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Content-Type': 'application/json',
            Origin: 'https://www.voeazul.com.br',
            Referer: referer,
            'Sec-Ch-Ua': AZUL_SEC_CH_UA,
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': AZUL_UA,
            Cookie: currentCookies,
          },
          data: JSON.stringify({ body: secCptBody }),
          insecureTLS: false,
        });
      currentCookies = this.mergeCookies(currentCookies, sc);
      this.logger.log(`[Azul] Step 8c OK. Status: ${sc.status}`);
    } catch (se: any) {
      this.logger.warn(`[Azul] SEC-CPT solution: ${se.status || 'erro'} (ignorando)`);
    }

      this.logger.log(`[Azul] Step 8c: POST availability para ${dateString}...`);
      const payload = {
        criteria: [{ departureStation: dto.origin, arrivalStation: dto.destination, std: stdFormat, departureDate: dateString }],
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
      this.handleCuimpError('Azul Flights', e);
    }
  }

  // ===============================================
  //  Utilidades
  // ===============================================

  private buildAzulReferer(dto: AzulSearchDto): string {
    return `${AZUL_PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toAzulStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`;
  }

  private toAzulStdDate(dateString: string): string {
    const [y, m, d] = dateString.split('-');
    return `${m}/${d}/${y}`;
  }

  private extractCookies(response: any): string {
    return this.updateCookieString('', response.headers?.['set-cookie']);
  }

  private mergeCookies(currentCookies: string, response: any): string {
    return this.updateCookieString(currentCookies, response.headers?.['set-cookie']);
  }

  private handlePartialCookies(error: any, currentCookies: string, stepName: string): string {
    if (error.headers?.['set-cookie']) {
      const c = this.updateCookieString(currentCookies, error.headers['set-cookie']);
      this.logger.warn(`[Azul] ${stepName} deu ${error.status}, mas pegou cookies: ${this.listCookieNames(c)}`);
      return c;
    }
    this.logger.warn(`[Azul] ${stepName} falhou: ${error.message}. Continuando com cookies atuais.`);
    return currentCookies;
  }

  private updateCookieString(old: string, input: string | string[] | null | undefined): string {
    if (!input) return old || '';
    const arr = Array.isArray(input) ? input : [input];
    if (!arr.length) return old || '';
    const map = new Map<string, string>();
    if (old)
      old.split(';').forEach((p) => {
        const [k, ...v] = p.split('=');
        if (k) map.set(k.trim(), v.join('='));
      });
    arr.forEach((sc) => {
      const main = sc.split(';')[0];
      const [k, ...v] = main.split('=');
      if (k) map.set(k.trim(), v.join('='));
    });
    return Array.from(map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private listCookieNames(cookieString: string): string {
    if (!cookieString) return '(nenhum)';
    return cookieString
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean)
      .join(', ');
  }

  private filterAndSortFlights(
    flights: ParsedFlight[],
    cabin?: string,
    orderBy?: string,
    costField: 'miles' | 'price' = 'miles',
  ): ParsedFlight[] {
    let filtered = flights;
    if (cabin != 'ALL') filtered = flights.filter((f) => f.cabin === cabin);
    if (orderBy === 'preco') filtered.sort((a, b) => (a[costField] || 0) - (b[costField] || 0));
    else if (orderBy === 'custo_beneficio') {
      filtered.sort((a, b) => {
        const dA = a.duration.hours * 60 + a.duration.minutes;
        const dB = b.duration.hours * 60 + b.duration.minutes;
        return (dA > 0 ? (a[costField] || 0) / dA : Infinity) - (dB > 0 ? (b[costField] || 0) / dB : Infinity);
      });
    }
    return filtered.slice(0, 3);
  }

  private handleCuimpError(provider: string, error: any): never {
    this.logger.error(`Erro ${provider} (Cuimp): ${error.message}`);
    let status = HttpStatus.BAD_GATEWAY;
    let details = error.message;
    if (error.code === 'ENOTFOUND') details = 'Erro de rede';
    else if (error.status) {
      status = error.status;
      details = error.data ? JSON.stringify(error.data) : `HTTP ${error.status}`;
    }
    throw new HttpException({ provider, error: `Falha ${provider}`, details }, status);
  }
}
