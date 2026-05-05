/**
 * Teste isolado do generateSensorData com Chromium + Stealth
 * Roda direto: node test-sensor.mjs
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const REFERER = 'https://www.voeazul.com.br/br/pt/home/selecao-voo?c%5B0%5D.ds=VCP&c%5B0%5D.std=06/10/2026&c%5B0%5D.as=GRU&p%5B0%5D.t=ADT&p%5B0%5D.c=1&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL';

// Detecta dinamicamente o path do sensor no HTML (igual ao extractAkamaiUrls do service)
function extractSensorPath(html) {
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  const sensorSrc = scripts.find(s => !/[?&]v=[0-9a-f-]{36}/i.test(s) && s.startsWith('/') && !s.includes('akamai.com') && !s.includes('akam/'));
  return sensorSrc ?? null;
}

async function run() {
  console.log('[test] Iniciando Chromium com stealth...');

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

    // Evasões extras em cima do stealth
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      delete window.__playwright;
      delete window.__pw_manual;
      (window).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (p) =>
        p.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(p);
    });

    let capturedSensor = null;
    let capturedSecCpt = null;
    let sensorPath = null; // será preenchido após o HTML chegar

    // Intercepta todas as requests POST
    page.on('request', req => {
      if (req.method() !== 'POST') return;
      const url = req.url();
      console.log(`[test] POST → ${url.substring(0, 120)}`);
      try {
        const raw = req.postData() ?? '{}';
        // sensor_data é text/plain com JSON
        let body;
        try { body = JSON.parse(raw); } catch { body = {}; }

        if (body.sensor_data) {
          capturedSensor = body.sensor_data;
          console.log(`[test] ✅ sensor_data capturado! (${capturedSensor.length} chars)`);
          console.log(`[test]    primeiros 80: ${capturedSensor.substring(0, 80)}`);
        }
        if (body.body) {
          capturedSecCpt = body.body;
          console.log(`[test] ✅ SEC-CPT body capturado! (${capturedSecCpt.length} chars)`);
        }
      } catch (e) {
        console.warn(`[test] Erro ao parsear POST body: ${e.message}`);
      }
    });

    // Loga todas as responses da Azul/Akamai para entender o fluxo
    page.on('response', async res => {
      const url = res.url();
      if (!url.includes('voeazul') && !url.includes('SwPv7g') && !url.includes('1dTvmnOv4') && !url.includes('_sec')) return;
      console.log(`[test] Response ${res.status()} ${url.substring(0, 120)}`);

      // Quando recebe o HTML inicial, extrai o sensorPath
      if (url.includes('selecao-voo') && res.headers()['content-type']?.includes('text/html')) {
        try {
          const html = await res.text();
          sensorPath = extractSensorPath(html);
          console.log(`[test]    → sensorPath extraído: ${sensorPath}`);
        } catch {}
      }
    });

    page.on('pageerror', err => console.error(`[test] Erro JS: ${err.message}`));

    console.log(`[test] Navegando para ${REFERER}`);
    const t0 = Date.now();
    await page.goto(REFERER, { waitUntil: 'networkidle', timeout: 60000 });
    console.log(`[test] networkidle em ${Date.now() - t0}ms`);

    if (!capturedSensor) {
      console.warn('[test] Sensor não capturado após networkidle. Aguardando 15s...');
      await page.waitForTimeout(15000);
    }

    // Estado final dos cookies Akamai (abck válido = sem "-1" nos campos internos)
    const cookies = await context.cookies('https://www.voeazul.com.br');
    const abck = cookies.find(c => c.name === '_abck');
    console.log('\n[test] === RESULTADO ===');
    console.log(`[test] sensor_data capturado: ${!!capturedSensor}`);
    console.log(`[test] SEC-CPT capturado:     ${!!capturedSecCpt}`);
    console.log(`[test] _abck válido:          ${abck ? !abck.value.includes('~-1~') : 'cookie não encontrado'}`);
    console.log(`[test] _abck (primeiros 80):  ${abck?.value?.substring(0, 80) ?? 'N/A'}`);

    if (capturedSensor) {
      console.log('\n[test] sensor_data (primeiros 200 chars):');
      console.log(capturedSensor.substring(0, 200));
    }

  } finally {
    await browser.close();
    console.log('[test] Browser fechado.');
  }
}

run().catch(err => {
  console.error('[test] ERRO FATAL:', err.message);
  process.exit(1);
});
