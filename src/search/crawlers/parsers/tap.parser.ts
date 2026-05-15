import { Logger } from '@nestjs/common';
import { ParsedFlight } from '../../search.interfaces';

const logger = new Logger('TapParser');

/**
 * Stub do parser TAP. O Python apenas devolve o body bruto da API sem parsing
 * (não há `parse_response` no `tap_portugal_service.py`). A estrutura real
 * precisa ser mapeada na primeira execução real.
 *
 * Por ora: loga o shape do response para mapeamento futuro e retorna [].
 */
export function parseTapResponse(data: any): ParsedFlight[] {
  if (!data) return [];

  const keys = typeof data === 'object' ? Object.keys(data).slice(0, 20) : [];
  logger.debug(`TAP response top-level keys: ${keys.join(', ')}`);

  // TODO: implementar parsing real assim que a estrutura do response da TAP for confirmada.
  return [];
}
