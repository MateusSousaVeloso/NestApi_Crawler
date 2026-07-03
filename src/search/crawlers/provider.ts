// Fonte única de verdade para os providers de crawler. Nunca usar strings
// soltas ('smiles', 'azul', ...) — sempre referenciar este enum.
export enum CrawlerProvider {
  SMILES = 'smiles',
  AZUL = 'azul',
  QATAR = 'qatar',
  IBERIA = 'iberia',
  TAP = 'tap',
  FINNAIR = 'finnair',
  AIREUROPA = 'aireuropa',
}

export const CRAWLER_PROVIDERS = Object.values(CrawlerProvider);

export function isCrawlerProvider(value: string): value is CrawlerProvider {
  return (CRAWLER_PROVIDERS as string[]).includes(value);
}
