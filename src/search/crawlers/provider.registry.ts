import { Type } from '@nestjs/common';
import { CrawlerProvider } from './provider';
import { ParsedFlight } from '../search.interfaces';
import { AzulSearchDto, IberiaSearchDto, QatarSearchDto, SmilesSearchDto, TapSearchDto } from '../search.dto';
import { parseSmilesResponse } from './parsers/smiles.parser';
import { parseAzulResponse } from './parsers/azul.parser';
import { parseQatarResponse } from './parsers/qatar.parser';
import { parseIberiaResponse } from './parsers/iberia.parser';
import { parseTapResponse } from './parsers/tap.parser';

export interface ProviderConfig {
  label: string;
  dto: Type<object>;
  parse: (rawData: unknown) => ParsedFlight[];
}

export const PROVIDER_REGISTRY: Record<CrawlerProvider, ProviderConfig> = {
  [CrawlerProvider.SMILES]: {
    label: 'Smiles',
    dto: SmilesSearchDto,
    parse: parseSmilesResponse,
  },
  [CrawlerProvider.AZUL]: {
    label: 'Azul',
    dto: AzulSearchDto,
    parse: parseAzulResponse,
  },
  [CrawlerProvider.QATAR]: {
    label: 'Qatar',
    dto: QatarSearchDto,
    parse: parseQatarResponse,
  },
  [CrawlerProvider.IBERIA]: {
    label: 'Iberia',
    dto: IberiaSearchDto,
    parse: parseIberiaResponse,
  },
  [CrawlerProvider.TAP]: {
    label: 'Tap',
    dto: TapSearchDto,
    parse: parseTapResponse,
  },
};
