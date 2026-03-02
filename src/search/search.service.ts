import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { AzulSearchDto, SmilesSearchDto } from './search.dto';
import { FlightHistoryService } from '../flight-history/flight-history.service';
import { ParsedFlight } from './search.interfaces';

const AZUL_AKAMAI_SENSOR_URL = 'https://www.voeazul.com.br/AmCOO/zVAfI/6E/OpRm/AzMl/9cJutziGic5iV4/NncmY3J3Bw/Wy/gZcWIkc2gB';
const AZUL_AKAMAI_SCRIPT_URL = 'https://www.voeazul.com.br/akam/13/4bc5f6ae';
const AZUL_PAGE_URL = 'https://www.voeazul.com.br/br/pt/home/selecao-voo';

const AZUL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const AZUL_SEC_CH_UA = '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"';

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

  // ═══════════════════════════════════════════════
  //  AZUL
  //
  //  Fluxo real (capturado do site):
  //    1. GET página selecao-voo → cookies iniciais
  //    2. GET /akam/13/4bc5f6ae → script Akamai → _abck, bm_sz, bm_s, bm_so, bm_ss
  //    3. POST xRJMA0B → sensor_data → valida _abck
  //    4. POST token → Bearer
  //    5. Para cada busca:
  //       a. POST xRJMA0B → sensor_data → re-valida _abck
  //       b. DELETE bookings → limpa sessão
  //       c. POST availability → busca voos
  // ═══════════════════════════════════════════════

  async searchAzul(dto: AzulSearchDto) {
    // Step 1: GET página
    let cookies = await this.fetchAzulPage(dto);

    // Step 2: GET akam script → cookies Akamai (_abck, bm_sz, bm_s, bm_so, bm_ss)
    cookies = await this.fetchAzulAkamScript(cookies, dto);

    // Step 3: POST sensor_data (valida _abck)
    cookies = await this.postAzulSensor(cookies, dto);

    // Step 4: POST token
    const session = await this.fetchAzulToken(cookies);

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
          this.fetchAzulFlights(dto, date, session).catch((error) => {
            this.logger.error(`Erro ao buscar voos para ${date}: ${error.message}`);
            return { error: `Falha ao buscar voos para ${date}: ${error.message}` };
          }),
        ),
      );

      const grouped: Record<string, any> = {};
      dates.forEach((date, index) => {
        grouped[date] = results[index];
      });

      this.logger.log(`Busca na Azul em lote finalizada!`);
      return grouped;
    }

    const flights = await this.fetchAzulFlights(dto, dto.departureDate, session);
    this.logger.log(`Busca na Azul finalizada!`);
    return { [dto.departureDate]: flights };
  }

  // ────────────────────────────────────────────
  //  Step 1: GET página selecao-voo
  // ────────────────────────────────────────────

  private async fetchAzulPage(dto: AzulSearchDto): Promise<string> {
    const pageUrl = `${AZUL_PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toAzulStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`;

    this.logger.log('[Azul] Step 1: GET página...');

    try {
      const response = await request({
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

      const cookies = this.extractCookies(response);
      this.logger.log(`[Azul] Step 1 OK. Cookies: ${this.listCookieNames(cookies)}`);
      return cookies;
    } catch (error: any) {
      return this.handlePartialCookies(error, '', 'Step 1 GET página');
    }
  }

  // ────────────────────────────────────────────
  //  Step 2: GET /akam/13/4bc5f6ae (script Akamai)
  //  Seta: _abck, bm_sz, bm_s, bm_so, bm_ss, affinity
  // ────────────────────────────────────────────

  private async fetchAzulAkamScript(currentCookies: string, dto: AzulSearchDto): Promise<string> {
    const referer = `${AZUL_PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toAzulStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`;

    this.logger.log('[Azul] Step 2: GET akam script...');

    try {
      const response = await request({
        url: AZUL_AKAMAI_SCRIPT_URL,
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
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

      const updatedCookies = this.mergeCookies(currentCookies, response);
      this.logger.log(`[Azul] Step 2 OK. Cookies: ${this.listCookieNames(updatedCookies)}`);
      return updatedCookies;
    } catch (error: any) {
      return this.handlePartialCookies(error, currentCookies, 'Step 2 GET akam script');
    }
  }

  // ────────────────────────────────────────────
  //  Step 3 / 5a: POST sensor_data (xRJMA0B)
  // ────────────────────────────────────────────
  private async postAzulSensor(currentCookies: string, dto?: AzulSearchDto): Promise<string> {
    this.logger.log('[Azul] POST sensor_data...');

    const sensorDataB64 =
      'MzswOzE7MDs0NTM4Njc5O0xpUWVBMWxMUDUzcjFjUlZmaFFDV3JSRi9Pd25OV09kQjdLVkdJNEhuZ2M9OzMwLDUyLDAsMSwxNCwxODY1O3JyTFgiXlE5IkQicH5nY2h5YCZ7Z2hOTz02bCJLIj0sRyJPIlt+dlVnK2k/SU04OkE0VyxOUEY4UCNfR1RDMC06X3Y5KU10Tj5oRmB6UUdtbjg5LitKL3FPTyJ5Ijo7fSIxIjUlY2JDOWJEYCYre0EiTiIgbSoiXSJJPytFc3NxNVAvb3FPUTQiWiI+dW4ibSIhIlhmaCJ0e3wiKyJRZlQufCJOeGZmSU46dyIxInpCentXfHQiaHJyY1BZTX10KVAiXzM+ImN2OSJXNlZwbSJKIiZOXiIgIjhfY2MibyIlYjgydnh2JnkgXVkzcyYoa0JNSVNiOEd0ez0/OXRRYnxQKihuIXs3LEIpI2M9TGRRNjI5XW4xWXswIk8ifmorIksiP0plX34vNCJRIlYtSTYiNSI7c0giJiJOeSZyIn0iPEA/PU9QMVtELV0+KWdWQihDZSJXIkAsTyAiRSR0QWQ+OiwiTFdsImtYYFU0Im9UXSJKInNXRDdtIno3KyJCXlQifnIyTmQiPjNSIl57REM3UmY9IjlyNm8iI3ArIkJ9XWJnIn4iXyI9Ij9bSCUiYCJ8L21AIkRHXyJHZ3gidUQ5Ij5Icj8iS3YuRkg1bjoiM2QiL1YyJGYiWXxeIjEiNkpLImhMWyJHIytgUCJ1Rk1VfjguWSJ2bV85ImYiKy1tbncya3NaNy1SdWEuSnBiLVRgJGwmJjUvZVJ7c0YlY2lvfXFSQVZVOSItcWUiWjJaInExL0NgNDNFIiAhNEg4eE59dEc1W0oiKiJzcDUlZSNIIiN2X3BJIiVAclsiPS95PksqOzBfInRZIkQiaFkicCJSV1ZDIlBUOSJjPCJWRylOZSJkZ04iPHRQd0ZtbSIwUTV5JXQvITc4KnZuKk1ERiUzb1FGMiRwWEczQ2hvakVaUkhPOFFdb2x0WlAqXVRgI0E4anBnUkQ6JWkvYWVbNnBkWGptfixJQExAOm9GTkh2SkEgI3Z2aW9OVHVBRlU2aGBgZnQ7PWVyJHNvRzo6OXRPPSEwKCwrNHxtRiQ4PSNkWE9oI0NOdS1CNkh9XngxWzM6MzEkPjxEPDNqRmV0XUJHQ2htPF8tMk9XXUUxQFZEdnR4Kig6PFVYSCVtIzspayp+UGs1Vio/aGckalJqI3pIYVJwbDc9VlhRRCFAYWJHT1stRXtBdCxiaSlxbiZQMXo8M0BVI3pGQ1I4Mk51cm12LFUhYiBYe1ppe3R1L19XPltdfjJMbDYvRy4zSnp0ei1JIUsyUkJnQlogaWY1ZFtPb20+Wyo7a3MvJSFIMX1yP187ZVB8bjR5Kl5nWDFtbFR0Llt4RmU5QV5hXT19fSVGaE9yYj0zV0RkPT5Hd1hhWHclbS5bKWB0LTtBflhbaTdbRnxvVUgmZihoaXBjMEpCZyxhMWk5dSZXaG5KKjxII0s1cG1bUDd+Wys0SUIieyI/WD4idyIxKEtaa0g2bEw1b1AsPDs4fSJiIjNyUzsibjtefFBKSSJ1VGhvcml8IjYiSURfTSI9ImBIYCNyZnw2aDx6VE8mIjYidkw+OSJ+VyUsdCJwbmRfIksiT1Y6eWciV1B7IkI8cEMkIk81Zi5zS01AIkE4Imx0Ij50eS9tIj0iVEgiMiI/N3dbXiJgIlFJIjMhIns+RS0iWiJ+KyJbTnciT1o/PXAiZSIvJWIieiJifTRCImkiX1AuW2ZsOGJdPTMvNiklYlEhWGZpSXR8ZiQgRVF0dDUwLCI6Ii9ePiI4IiI/InZpTSIuYSJmPl1xOiJCIl9wIkAiYEx4UTAiMSJtZiJrQyJ1ZVRrIl5AOCRCPUUiIjEiMEEhIk1UPHNjaWgiJWsuIk0iellzWj1JVHsiIyJfWjM7RzcgIiMlMSJ4LkUiKWQrImU7aX4iMCJoVXRjMVpsR0AiOyA/aUQ/TSI1IiJdImBhSyI2IjB3SG1WIjEiJF0zOSJYInQ4KnR9LFtrJT9UZHNwIikiMEdrdyJ9IiJoIk8jQzUiciIibyJwPSJSIjQ3VyIqQkEiKmV5XyJ6RjAiI1UgfCJefn5oLjYibT1hMyIkZCI5JS4tIioqcyIjJUo4VSJPWClxZVQrLyJuQCJ4IklLRSxZbiI6Ii0tIVgiMSJnQzxWQj94KUJnSCZeZEZsImAifmJ9IjEiPHciVSJvJFB3Ik0iImp+OyIxXUgiJExoIGcxMUIiUCJfMjgoI2hSIjBGYEJ2NjQieXRDIigiQzpSbVo5bXIiSCJ9aGVoRkwlIkYiUUplbkpsZkQwXk56Xm4iYF9zImxONzk/InEiIiVxLyIwNEIiZiIobFsyMVtHXnhvXjJPRiJ1QSQidSw6ciIoIk5Mey8iPiJMVEYiNCJDQEY2XyEhbCIgIiUrOUcodUAiPCJ7ZzomWTVwNjdhQVE/cWRBbmhERVYwfSV1SVtIWjcyTGZ7emtdTklPak49QiJsIn5hYSI0Wz4iVl9uIi4iIkQibzw1IkRZKyJra0wzViJJIltgImhyKyJXWGx5IiNkbChheSNhIl9jbnoiLyJoKEBRKSIqIksyRW4iUlRKPV1fKVAiYiJRPFhgY2JkIk9maWAyIkZgdEkiWiIiKEp+In4pJCImInV5UWlBIngiKGd9cyIhIkgvcGNlVCEkOSR9c2NHZDxuWXQ2Qi1gZUw9aSlKbncuaCosLGdXXmwqcGs1ZU9oU1NFL05mfFE5YVZ1SEdbUj8ifkksMEh1P0siflROIjsiYCwtYHRGTGIiRSRKIixUZ0ZqImAiIkUibVdtIj4iJiJHdSoidT1aIjIhXXxKWX15WTYmVjpyemA4w6E9aENYM190X8OjUiQ3WDlTJk5Iw61EcjA/InkiMyplNyJwImpYTmAocFo3Pm85ZUhEdXlmZnZnVyNSJVhObiV8OFVuRS1CXzRWe2BSeVl7WmFjSSlWL3E6Knk4PX1qTnFHSERUbWxxQlVuay9eLHtBYWdOLSJxIm52ZmQiYyJJbVtwMSFrLkIiOyRbInlXLCI/JCI9NSJeNTN8IltxVWIicFQiY28zSyJjIi0iR0xjIl5+ZSJfdm5DRT9OPV5LUjB+Q2tdK30iVzU6Ijgic0IjRmlyZCJjInkhciJaImZlWVF5RFAiaiJdOygiUSI9RCtRIXI2Nyh6LC4udD5WTFtmIj8iWHlYfSJZTDAwY112ZywiU3ZOKCJyIjAkbVhld2U2MGdAKUROIigicHd1Iip8OSJxc1ciYE1lbTBGWWt9Im1BIyJxIix5IlpnbCJeWkAhWiJdIi1GS2Z7InFGVSJhb0kieCIzJiVqJE1oWXhKMX1PIlciaWh8Pk14PSJSInV0Z0VjS0U2KyxSVnZHbzBGI3Q1VzROdSN0NmZwSiZBRVBYKkJhSno5ODdiM1l5IC1sXiM3Lz9UeTtTcDxkdkxVMUdYflhFUFh4XXdLU21DTEU8WSUgdjNMcmhYNGZHdElqYW0uXlIiTyJpOnMsImwiKzlyTSUlaC9sOyFWSnJRXjYqPFkvZSpSUCQpJE4qZDEgI1B7Kk89V8OheFo3OTgoSi/DozV9NzlTN3lAb8OtXTdHJiIxIjZTYzMiRyIgfXtLNEw4bDcsaF9aImEiTiNbMURydyIwPlRhMHUiKUd+fiJYcztQWyJ7ejUiR3RGeVg1XyI1Ry94IioifCx6cCJlIi8iKEVUInQqQiJkIjQ8ek11T1M3em4pMGx2KG9xY21aVmZRKFdSNll1LjkzZiRRRWU4X3pjRit3Yzotaip7Y3l5dFt7RjgwTEw1KnVlVTJkKU1hLHszd11KLThEUWo7Njx6YFN+fGs5UzRxV0E7RlApbEJWd3hDdWA/VCJQIldre10iIUU8IlppbSJpcHJkcDlIIilDRHYiQCIsNiJIZ1kiUztoRSJ+WWZvJmxpZiJ7Ij5XNTo7KFQiZXh0JTlJIk9DViAiMGRgImtfYyIkfiBjVzFVamcibndxe0wiNCJ0T0d5IkVyPl89MHFIRlZSUUt3XkNFbFEvP2cyakRaIT5mTyB1az5WOl5ZX29wITh8dGtGID9XKzFFWDBDdCRdcn4qZD09UmgsY1JFYWxAaEU/QjUtSio0LzhCZUwgTHwxaWp+YVpoYFlGVFdwOml1MSg4JCItIjQ3W2YiXSJjbChvaSNsNilUWDQ5RygmUiJHIkBARF8iNSJFSX5BIXp1RmkrXk5aVSlAQGNaMUhnVjA9fm5udU1jWXcufHRkOnYtey4/WWlPLzIqNVB9eVlCbik9Omg1XmJle2RnVEd3bWExdnBwdVF8U011K1VsRHU7X2w6UDFofHxzN3xYRyh2IjwieDJDISJsIiI/InldNCJMb2VyQyI5KiJiIjVYQyV1TT4zbXN6W28zLk4kWE05TVNDaX48eC07blZwfXIob1pwa0pIdG4iZCZMIkt4VSI+IjBHTTcjTCI5Ik1YY0giQGU2JkNNYSJOI15+IlAiemN4WHEwd2giNjZTIi5GMDslIi12LiIzP1h7IiN3Tz18aEQlNkRRMiJxYj85Imkie0JCIHIzbjFDezxuQyI8ImxTPHk0ZFYiTSJ2KTZ8Mi04aXNST188a3ZDXlBCKytSPmtZR2Q6PSEzdmsgLjYyNmRfbEthaTQ/Ll8meUhrXiNpcFg+bj01SkRre2NsVHNbd343SGBeLENZSW93MTgxOn1YQjVtOkxZLW5oWENRJSxpbUNATClidioicihlIl5rYSIjIiMpb046fXd3MkNxMVZWJChWZ0RweTE4NiE5Z1V3L2FWXXJYTiJhUH0iNTQiJSJSIk9EICJGKXoiPkk9NE8lfWxVNSJjTiJ0fEljPUckPCJZbVRMIlQiJCspSyJvInByJCIkP2BSS0pmfiJ5RiQiOSJVOjJeI21mInciKXB+TiJsSCNldyJTaDtkIjAqbD97JmciOSVVSiJkW30iSXpCVSJaIiBUUCJhfE8iQC9hPm0iIyJzQyJzImE0X3YibSJFaGddLltsaDxKNGFMMiIyTkUiUn5WLSI5IndpN3RhSHJCWmIkdXV9TGhQOC4iVTBwOiJeIj8sPkciISJBQGBgckBxezoifiJLd18ieVRKIlJvTDhQNCUqK0hfWHlfR2EwTSBaVlNDaVZrYV4xJnhhdSVfbyZlTW03WnpSW28tSz9AJlRbWHo9Q1FJaDNQOiNyJUtwL3BpIDVrMiZEcEphWGpJIzAzUV8wW0FYOFVMZFtKPCg4dDorb34qdD0oT25qe2k2WHVBamE1SipTKz1lYzFfSElacTM/ZzRtSVg8IkIiLkhVIjgiRzE8Z05JaSRlSWU0LmBbMHg6QDVQJGZgPF1PfiB+VilsMWtsKVhMSCpxODpsQ3JrdDF0NlAzT0diJkNITF9iWiJlLiQiMk5eIjMiVTFFImR4QiJ1JSksInciLGhwKWU2NjAiPG1uIitVRSJHX24qayhHIjBDWFEiTyJwUGZwUjY/Ll0iJEBYIiZ2KCJ1IlpPNFJCRy09aCJna0gqIlgiajA3UiJILmh4PGUiOUddeiJMIjNSXXV8NzQybVd9MSFrImhBWSJJYSsiLzgrcDFVPX4vMkhObCMoNCkiS3FJIk8ibDV6Yi5seF5tfXI8YENHZ21RcH1icTw5JjFnVl55Oyl2b3dxJHove3VTIjZ2JCJvenYiJCJ4cHkme2VSSmp1LU51IkkiXXVVcjEsMCJWSkk6UndfLktvaz57Ild9ciJrUiI+VCJMb1pxIig4YzgiJW4iRyldeCJyIikiUjU5ImVtUSJNInJSP1MmKj8lYl5mJkV9InI7YyI0S0MwWSJHc0w1a1A/KyJFZkAiM1oiOThxIjAiIlgiSyxDRyJyJj95IjkiVVQ8InNBbSJpIiItTWsiZzIkImUiVmV+Z010eFczLHh2V1lOSHVgfTgiZSJuS3QiVj9vW34iVnlkIkUiQTUofH1MUF8yZEdkQC1GK017U2JoMWUkTC8hYnxiQ1Q9ezQpPEc8RkYkcElzXl11fjMkK1pLRlNBcjdJNDhPR11yZldrWkdeQ3trVWokaTlFIm8iQV9LQSJsIl5zc0FlQS5eezgsVml3MEp+O0lpW1pCW0xAfjhTJSxPJHgycUtYKllaJSlPVmdWS2psO1Z3RERSaUJVNDR2WFZdPjdnNipVOHArNCN1OiUjWSI7ViJKNiQiV2JXIj45aCIpIiI1fkQiZyUyIjRTUV8ydzI6KE4ifTI6InciW0wiJiJBRTM5ImIiIlgiez9HImEicWI6fCFvSWlTSyh9eiw1V2FeXSJ7IkQ6ZTIicyI/NXtKZiF2OmF8eUZyJERwYD1lSGYpOnVBVnJeZmpMU3NfYzleXy1SUH5+XXAoJTBsJW9CNCZUK299YXZWcTR3XihwO2lFYUwpSlQ9Qn1qJGwiNyJSazVFIkopIjJkMSJkTWYiNSUpOSI+aDN4SyJhIk44dG0iPSJPSzdjSXF7ZU48dUR9QmcvMl85IkEibUFSUSJfImVDWD8kciIrIjJjfiJqQX53Z0VFIjtoLiJVdHVaTHRZVDAieExWIlIpayJbYXMi';
    const sensorData = Buffer.from(sensorDataB64, 'base64').toString('utf-8');

    const referer = dto
      ? `${AZUL_PAGE_URL}?c%5B0%5D.ds=${dto.origin}&c%5B0%5D.std=${this.toAzulStdDate(dto.departureDate)}&c%5B0%5D.as=${dto.destination}&p%5B0%5D.t=ADT&p%5B0%5D.c=${dto.adults}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL`
      : AZUL_PAGE_URL;

    try {
      const response = await request({
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

      const updatedCookies = this.mergeCookies(currentCookies, response);
      this.logger.log(`[Azul] Sensor POST. ${JSON.stringify(response.data)}`);
      return updatedCookies;
    } catch (error: any) {
      return this.handlePartialCookies(error, currentCookies, 'POST sensor');
    }
  }

  // ────────────────────────────────────────────
  //  Step 4: POST token
  // ────────────────────────────────────────────

  private async fetchAzulToken(currentCookies: string): Promise<{ token: string; cookieString: string }> {
    this.logger.log('[Azul] Step 4: POST token...');

    try {
      const response = await request({
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

      const responseData = response.data as any;
      const token = responseData?.data || responseData?.access_token || '';
      const cookieString = this.mergeCookies(currentCookies, response);

      this.logger.log(`[Azul] Step 4 OK. Token obtido.`);
      return { token, cookieString };
    } catch (error: any) {
      this.handleCuimpError('Azul Token', error);
    }
  }

  // ────────────────────────────────────────────
  //  Step 5: sensor → DELETE bookings → POST availability
  // ────────────────────────────────────────────

  private async fetchAzulFlights(dto: AzulSearchDto, dateString: string, session: { token: string; cookieString: string }) {
    try {
      const [year, month, day] = dateString.split('-');
      const stdFormat = `${month}/${day}/${year}`;

      const passengers: any[] = [];
      if (dto.adults > 0) passengers.push({ type: 'ADT', count: dto.adults.toString(), companionPass: false });
      if (dto.children > 0) passengers.push({ type: 'CHD', count: dto.children.toString(), companionPass: false });
      if (dto.infants > 0) passengers.push({ type: 'INF', count: dto.infants.toString(), companionPass: false });

      let currentCookies = session.cookieString;

      const baseHeaders: Record<string, string> = {
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

      // ── Step 5a: POST sensor_data (re-valida _abck) ──
      currentCookies = await this.postAzulSensor(currentCookies, dto);

      // ── Step 5b: DELETE bookings ──
      this.logger.log(`[Azul] Step 5b: DELETE bookings para ${dateString}...`);
      try {
        const deleteResponse = await request({
          url: 'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v1/bookings',
          method: 'DELETE',
          headers: { ...baseHeaders, Cookie: currentCookies },
          insecureTLS: false,
        });

        currentCookies = this.mergeCookies(currentCookies, deleteResponse);
        this.logger.log(`[Azul] Step 5b OK.`);
      } catch (deleteError: any) {
        this.logger.warn(`[Azul] DELETE bookings: ${deleteError.status || 'erro'} (ignorando)`);
      }

      // ── Step 5c: POST availability ──
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

      this.logger.log(`[Azul] Step 5c: POST availability para ${dateString}...`);

      const response = await request({
        url: 'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v5/availability',
        method: 'POST',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json',
          Cookie: currentCookies,
        },
        data: JSON.stringify(payload),
        insecureTLS: false,
      });

      return response.data;
    } catch (error: any) {
      this.handleCuimpError('Azul Flights', error);
    }
  }

  // ═══════════════════════════════════════════════
  //  Utilidades
  // ═══════════════════════════════════════════════

  /** Converte "2026-03-05" → "03/05/2026" (formato std da Azul) */
  private toAzulStdDate(dateString: string): string {
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
  }

  /** Extrai cookies do set-cookie de uma response e retorna como string */
  private extractCookies(response: any): string {
    const setCookies = response.headers?.['set-cookie'];
    return this.updateCookieString('', setCookies);
  }

  /** Merge cookies atuais com os que vieram na response */
  private mergeCookies(currentCookies: string, response: any): string {
    const setCookies = response.headers?.['set-cookie'];
    return this.updateCookieString(currentCookies, setCookies);
  }

  /** Mesmo com erro HTTP, tenta extrair cookies da response (Akamai seta cookies mesmo no 403/418) */
  private handlePartialCookies(error: any, currentCookies: string, stepName: string): string {
    if (error.headers?.['set-cookie']) {
      const updatedCookies = this.updateCookieString(currentCookies, error.headers['set-cookie']);
      this.logger.warn(`[Azul] ${stepName} deu ${error.status}, mas pegou cookies: ${this.listCookieNames(updatedCookies)}`);
      return updatedCookies;
    }
    this.logger.warn(`[Azul] ${stepName} falhou: ${error.message}. Continuando com cookies atuais.`);
    return currentCookies;
  }

  private updateCookieString(oldCookieString: string, setCookieInput: string | string[] | null | undefined): string {
    if (!setCookieInput) return oldCookieString || '';

    const setCookieArray = Array.isArray(setCookieInput) ? setCookieInput : [setCookieInput];
    if (setCookieArray.length === 0) return oldCookieString || '';

    const cookieMap = new Map<string, string>();
    if (oldCookieString) {
      oldCookieString.split(';').forEach((part) => {
        const [key, ...val] = part.split('=');
        if (key) cookieMap.set(key.trim(), val.join('='));
      });
    }

    setCookieArray.forEach((setCookieStr) => {
      const mainPart = setCookieStr.split(';')[0];
      const [key, ...val] = mainPart.split('=');
      if (key) {
        cookieMap.set(key.trim(), val.join('='));
      }
    });

    return Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /** Lista nomes dos cookies (pra debug) */
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
    cabin: string | undefined,
    orderBy: string | undefined,
    costField: 'miles' | 'price',
  ): ParsedFlight[] {
    let filtered = flights;

    if (cabin != 'ALL') {
      filtered = flights.filter((f) => f.cabin === cabin);
    }

    if (orderBy === 'preco') {
      filtered.sort((a, b) => (a[costField] || 0) - (b[costField] || 0));
    } else if (orderBy === 'custo_beneficio') {
      filtered.sort((a, b) => {
        const durationA = a.duration.hours * 60 + a.duration.minutes;
        const durationB = b.duration.hours * 60 + b.duration.minutes;
        const ratioA = durationA > 0 ? (a[costField] || 0) / durationA : Number.MAX_VALUE;
        const ratioB = durationB > 0 ? (b[costField] || 0) / durationB : Number.MAX_VALUE;
        return ratioA - ratioB;
      });
    }

    return filtered.slice(0, 3);
  }

  private handleCuimpError(provider: string, error: any): never {
    this.logger.error(`Erro ${provider} (Cuimp): ${error.message}`);

    let status = HttpStatus.BAD_GATEWAY;
    let details = error.message;

    if (error.code === 'ENOTFOUND') {
      details = 'Erro de rede: Não foi possível conectar ao host.';
    } else if (error.status) {
      status = error.status;
      details = `HTTP ${error.status}: ${error.statusText}`;
      if (error.data) {
        details = JSON.stringify(error.data);
      }
    }

    throw new HttpException(
      {
        provider,
        error: `Falha ao buscar voos na ${provider}`,
        details,
      },
      status,
    );
  }
}
