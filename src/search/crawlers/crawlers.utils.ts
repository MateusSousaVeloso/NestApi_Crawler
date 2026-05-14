import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ParsedFlight } from '../search.interfaces';

export function extractCookies(response: any): string {
  return updateCookieString('', response.headers?.['set-cookie']);
}

export function mergeCookies(currentCookies: string, response: any): string {
  return updateCookieString(currentCookies, response.headers?.['set-cookie']);
}

export function handlePartialCookies(
  error: any,
  currentCookies: string,
  stepName: string,
  logger: Logger,
): string {
  if (error.headers?.['set-cookie']) {
    const c = updateCookieString(currentCookies, error.headers['set-cookie']);
    logger.warn(`[Azul] ${stepName} deu ${error.status}, mas pegou cookies: ${listCookieNames(c)}`);
    return c;
  }
  logger.warn(`[Azul] ${stepName} falhou: ${error.message}. Continuando com cookies atuais.`);
  return currentCookies;
}

export function updateCookieString(
  old: string,
  input: string | string[] | null | undefined,
): string {
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

export function listCookieNames(cookieString: string): string {
  if (!cookieString) return '(nenhum)';
  return cookieString
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter(Boolean)
    .join(', ');
}

export function filterAndSortFlights(
  flights: ParsedFlight[],
  cabin?: string,
  orderBy?: string,
  costField: 'miles' | 'price' = 'miles',
): ParsedFlight[] {
  let filtered = flights;
  if (cabin !== 'ALL') filtered = flights.filter((f) => f.cabin === cabin);
  if (orderBy === 'preco') {
    filtered.sort((a, b) => (a[costField] || 0) - (b[costField] || 0));
  } else if (orderBy === 'custo_beneficio') {
    filtered.sort((a, b) => {
      const dA = a.duration.hours * 60 + a.duration.minutes;
      const dB = b.duration.hours * 60 + b.duration.minutes;
      return (
        (dA > 0 ? (a[costField] || 0) / dA : Infinity) -
        (dB > 0 ? (b[costField] || 0) / dB : Infinity)
      );
    });
  }
  return filtered.slice(0, 3);
}

export function handleCuimpError(provider: string, error: any, logger: Logger): never {
  logger.error(`Erro ${provider} (Cuimp): ${error.message}`);
  let status = HttpStatus.BAD_GATEWAY;
  let details = error.message;
  if (error.code === 'ENOTFOUND') details = 'Erro de rede';
  else if (error.status) {
    status = error.status;
    details = error.data ? JSON.stringify(error.data) : `HTTP ${error.status}`;
  }
  throw new HttpException({ provider, error: `Falha ${provider}`, details }, status);
}
