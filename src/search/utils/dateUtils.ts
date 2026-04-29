/**
 * Gera um array de datas no formato YYYY-MM-DD entre start e end (inclusive).
 * Retorna array vazio se end < start.
 */
export function generateDateRange(start: string, end: string): string[] {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return [];
  const dates: string[] = [];
  for (let i = 0; i <= diffDays; i++) {
    const d = new Date(s);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Executa fn para cada item em paralelo, coletando erros individualmente.
 * Retorna um Record data → resultado ou erro.
 */
export async function runBatchWithFallback<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
  onError: (item: string, err: Error) => T,
): Promise<Record<string, T>> {
  const results = await Promise.all(items.map((item) => fn(item).catch((e) => onError(item, e))));
  return Object.fromEntries(items.map((item, i) => [item, results[i]]));
}
