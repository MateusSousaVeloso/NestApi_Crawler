import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { request } from 'cuimp';
import { AzulSearchDto, SmilesSearchDto } from './search.dto';
import { FlightHistoryService } from '../flight-history/flight-history.service';
import { ParsedFlight } from './search.interfaces';

// ─── Akamai config ───────────────────────────────
const AZUL_AKAMAI_SENSOR_URL = 'https://www.voeazul.com.br/Iq4CfOM3vGbH7KGcUbxx/zu9OLk5SN9iJz4zEEw/FXwEbR59TQ4/AyZRZ/xRJMA0B';
const AZUL_AKAMAI_SCRIPT_URL = 'https://www.voeazul.com.br/akam/13/4bc5f6ae';
const AZUL_PAGE_URL = 'https://www.voeazul.com.br/br/pt/home/selecao-voo';

const AZUL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const AZUL_SEC_CH_UA = '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  constructor(private readonly flightHistoryService: FlightHistoryService) {}

  // ═══════════════════════════════════════════════
  //  SMILES
  // ═══════════════════════════════════════════════

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

  //  Fluxo real (capturado do site):
  //    1. GET página selecao-voo → cookies iniciais
  //    2. GET /akam/13/4bc5f6ae → script Akamai → _abck, bm_sz, bm_s, bm_so, bm_ss
  //    3. POST xRJMA0B → sensor_data → valida _abck
  //    4. POST token → Bearer
  //    5. Para cada busca:
  //       a. POST xRJMA0B → sensor_data → re-valida _abck
  //       b. DELETE bookings → limpa sessão
  //       c. POST availability → busca voos

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
    const pageUrl = `${AZUL_PAGE_URL}?c[0].ds=${dto.origin}&c[0].std=${this.toAzulStdDate(dto.departureDate)}&c[0].as=${dto.destination}&p[0].t=ADT&p[0].c=${dto.adults}&p[0].cp=false&f.dl=3&f.dr=3&cc=BRL`;

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
    const referer = `${AZUL_PAGE_URL}?c[0].ds=${dto.origin}&c[0].std=${this.toAzulStdDate(dto.departureDate)}&c[0].as=${dto.destination}&p[0].t=ADT&p[0].c=${dto.adults}&p[0].cp=false&f.dl=3&f.dr=3&cc=BRL`;

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
    const sensorBase64 =
      'MzswOzE7MDszNDI1ODQ4O0czdTNhUFRsVGM2Z0FZV2xyYUkvWWVuTEJtS2wwbC95N0ZvTFZVYjVZakE9OzE4LDg0LDAsMCwzLDIxMjg7Y0siZWEjRCI5Ing6TlZgSiw0QS92a0VMaUIwWkl9Vl1xTEJTbVU7djdBfWNpPCV9cy8ve3Y+In0iQEcqIkgiRGhsIkwiTS80KyJ9WT8iaVRLIj0iPnRnZj9mYSJOIkpJXSJIJSBHe3klTyBgTVExRGwjRiJKJDIiOiJfVVVhdyYiRiI0QCZOImlkUiJvL2chZCIhIj9sKyJuInlyPCIvImk5TmoiImckJCIvdXIiPSJBQy40IixMTiJiYE0iTCIgS2IgeCNrQV5nSyV7dCJxInw7QT0iVyJ2ZElSU3AtYno+V3N6ICJEQykiLE5KYSIqImBodFttSmdraCFrSGA9Xng/c3wtdWwsPjRzZ3Z1Ijg3alcibSJ5PjF9Ojd3KmQxaSxdYyJZLnoiJSMxPyJqLjQ7QkJefGMiZ2RwL1ciO005YzorYkQian1sIk4ibS1NZigqIjgiPywseCJmLVp8R2IiInUidG0iOzd7QTkicTwiUSJrZWg4bnVlLVAqZVR7bjolPmVhYkh2cXUqPSA5ZyxYcjg8N2RLUlEhQSlURSh+TzdaLSo5ek9bUX05cDduLWskRU9XMHUwIloiUykuIigiPGdGIko5ZiJeOVIwWiI2djRTam9VOjJTdiIxd1pUIlYiKis1STFxP3NzfjJOQzo7Zyo/ZyJMIlpdNnwibSIiLVlhIkVjTiJ5JFkgZD4yZEJXR0MiOzdYYyJSIkBAIiQgZSJlQUVFLSI5aDozZ1h8dUYiejM2IiU5cyI/KEYiZCJ8b04sJSJPdSAiJX1lV1kiK04iMkg9aiIsIiQ7X0xmVlhvXyNSN0g8alkpLX56bDhzIWF+fCNmejo+UnUgODEhTzghTUByaEFaOCspT31qKmlZK1diaClldGQteTsqPiw9KyZraDs7dVFTLlhxLXZxWHM+ICsoaTc5KkJCO1d3e0c5W0Z9JixrSSJ2Imk1MzgiJVIhIiw1bnciMSIiZTo9IkVHNCJLIjAiWE5ZIlFUXiIhIk8qPX1jZCNqTnBLcjR2OFQqc0MiSSJvITpNImBrVmc2Iiw8RiJfV3I2WCJCWHoibSI1XSJSNjMiRjtediJNImVheUVAPDhEbTNxTnR5Wm8iMCJ6S0UiYSJ2e1FXI3Ere249WlRHbGo7ZUtwVXtHVn1uajtnWUBWYSsuYyY5PVFHRGk7OTZTbEt6USRsM2oyTT5Dez9BMVBSKDxoN2BqcnV4RXV8eUNaNG9OIHVEJEVxb3BLKyR3NkxxPGguV2kzKDJvUVFMI1J+W0QrcVEpWCYtLWxTUFF5I2swZXtmfj85PiBiciBRel8/NHBvTTJZKDpFMGdwfDxrQmRHIFFyPUlPL3Q2Mm9BN3FiWUoxIVAkNU9AfCg9bTJ4Ny5MNmcpQVhEITVTPmdQOkJ9JnVhOyAzR0QoQlh9Rz9pVyp8OnIsQSl+R1M9dmtjX1ZfQTl2W3w/MylCTzJbVTElYENtXmogIWs3VDgjc219ayBvb003WTchazRYMmFZPS11akB+QGNmVilUNXV5biwhNTY3dHI1ZVlieUUualo/RygkXkhjMC0vYCYla3RzNCw6QEw3MVoqLTReJHtNWkI+NjFnWShNVGEyaFdPXlp9NTxRUERRfEdPZjFiTTM0fjh+NXxrPWpvIVcwKSM1QltzLEJWUFkjamx2UzElbWtvfWt4aVsyeHc7d1lZRGwqP093K0pNQzBiejt0WFM8SkNhW2FRXipofDp9W3BiPEl4M1p1Oi5AIHAkPyNhW1JlaDk7RzVBKmF5NC5rdHdIVTJZJU1qeSlrYCQ8dmdqZyEsU01odHZVQWUtd2kuK014S2pLbTVAYFRDZTF9Y2ZpQyJYIiNsJiI0TmZgRiJiOVkiKGV+Ik9uYyJJa2g1RUI/SV4hPiJILSQiVCJCZn4iZSwvIiN3LlkiVyIpLng2PzQidihfZCR4aDh1dmw3WThfVH5rQCQ+aHNvQXV6ZSk/cDBoMyJnIl9xQSJEIippUiZ6SVFRWW5oXnh0enluOHEiZSJPTmMpIjsiUWRqMls/LX1RSiZvQWsifWQzIjNjbWN9ImEiIngia104IiZNcU98fTwiYGQwZCJ+IjxhcUEiUCJnaER2N0BTX240VzBJV1BDPSI7IkREYW4iWWRzM3JMIlksKkgiWV1MIj9UIjwtfCp2IGdYN2giRSQpOCJaJVsifnZeMyIkd2pgOD9TInx7NykiLiJeTnktKiVRaUhyZ0FJICJLIjJqbWQiViIjNiM8M0k9OTJ0PWReVyNDNnJjTiJ8IjMtQSI4IksxJiJjIm8hSjkiMyJ4bGw4eyJGMD9EWyIkIi9eIkciUTtDZ28iZiJneSJfMCIjSU56IkohImR3ViI/LE4iWiJDcnRQbVR6OkpnKnYhLGxEYjVsYVpKeDMyZUZJYzxkbT93PWcsNUZQKC40VGpWTVZ1SHohVW4wREZUOyVLfi5LfCBQaThFdkdzSTE+QSxlS2RLMCwjKy5TR1YmL3BbIzY/NkBQYiZaIkkicjJILSJGTzgiXV92InEiRFtnSDdYMURRfHRMWSJ9ImkjRFM2OFIiMyIiICIpR2MiSCJWby9SRT9uPTdgSG4/Il0ieFtpKEhLOyJyVyJ0YSJTYFVJIi4vfDcicmgiaWkxbiJVSCxkLyJtIztkInNpIkFLRiJEZmkzdH1kXjhgXnkiWTE7IjJbUzp1KmVwS20wTVoiWSQgIjAiclkrIFdHfWYlVFJiRW0ibT9AIipqfSJLInUlWz9GJGBPWUB6bCZGXkgsIDoyOnt0fi5dZ3drMll9IzcrcyVHWz8xd2dZaTImTX1PK3FNYXZpM2o+ZzNuKStkRn1MdnMpID4rciBwblMqVCIoIlR8Pm8ifCIiU0hrIjxpQSJ3VFcifmF6WiJ5OkAiOFMzIm8iL110VX16anN2OEp5ZU53YjlGLkVYMzQsZVhMPDwteGZwekN+Im5GPiIkdiJrNUs3b31pInBzdiIpIiJXIjpQdiJqIjA3fmxPKl16d3FPbXEiWSJWRnYiQ0thIklYTXg5Ijo2IXpsYUYhWXUibk8iQyJZZDRScCJ7Ik1Iei4iai9vOzhYWk9SMSFdMXg2ZyJ+Ml0iJSJbWG5nYz1tfiJdPCQiXV1WXl0ieyIkRk4xZE1CKVYwLFkwOlgqbkZeIzdCMk9PUDllQyAwVz1Pb2VPV0J2Kl9qR157JXxeW0JjNm0oOmFFYlRlVUBRaVZoPi57YUgzaHltcVJGWDEiN2Yid2teImAiKnNrclA+emR6Uzc6Z01Bc0FmQ25aMTYrVW5SUWVzQCVmdDs+Kkg0Wkk9dCJPdksiTG03Ii8qfkNoZEhQVnYiS1MsImBNLGEkImR6IkJhRG5DfUoicG5sIjYidiImWGMiRXlrIk4iMjB8KUReOTFBLntDcjxza28iQSIjVWw6Ii4idTNUIj57PyIuZ3VsNiI4fUszX3QsISIpeiJ9Kl8hYXhAaXoibV4vMWgicEwufl1SLmA2UiJlRyUiWiIibyJZKGgibyIzM303OndGMCIpIlcmfkl2OEMiOiI6XUdGbGpnciM+fGwuKCZtREgiNiJoblYiQjl6ImRZYyFAIipMOCJFcj9LInkiankiUyJ6NyY7IiEiNiJhYEMiZzheIlt2T0d7Ty0ieSpedyJCImx0eUtEIl4iVy0zfSJqPGldRC1wVyJna0EiYSJDN2xwY35rJSJwZ0IiISVsTWAiSCI2WUlDd1UhSCJXIkwhISByNzYia3FXLSZidiJdNDV+MiJXIiRiIjgiPUk7PSYiaiJaYyJyVSIscEtgIjxWTXFsXzoiP0JCdGkyQjEgJmMsJk1hZyFCLyJ8IDYsaz9EWSBtRzVAVW1JcCVTQ1dWTTZXSll4fjdMfiBTMkF5ejwsJSlkIl5iRiJjYCMicSIlUlgtNURkSWl1SjV2JCoyM3cySzlvfT81bDJtXjIqLjJWfV0kW2hEQFI/L1tyVzMmSyw5S0h3Nkp+X3g2JE41cmp6QmUueyFdaFJhc0V8aGwiMSJSdzc1IjciJExiYCYiRiIybFh6IlsiaiJ9Vj0iMn5FIlciJCIwLm4iXVdNIksiPTEiJVsxIlVCQngicyJsa0hPJkRvdjkidUhuImomSyJwIiJ4ImtDa2oiTHVmOF08IlY2SSFdfXR4UCgsKkh4QyJRJCpdIioicUEjQVFNXkokR3k4dFoyLi11ZF5zd0RUPDd1YVB1eWhqQiZqVU44UCBHSkIhN1NIaEh2QF1QemtPRi4mTEc5bTE+Izo+P2ghX0xVSC9TLkNVYGsuRG89Yz5FOSNoXj9wMjxUR2J2VW8gXT0jWDFoInkiRnM7eiJSKiB+fiI8LWIidltLZyBTIWE4eiJDYEdTIjsiTF9Ibno1U1tbS1MuKHM8XmsyQCBoO1BUQ1kjb3g1RDlZdCA3OSUvJTkzfnogYC4hfkVfUHRvdnZoWShMYXd8dUgwRUlVVm8sOE57dGc1VigwWCRZQT0mKHlbcXU4ZXJwaUM2MTI4UyJrIm94bkciIyJZJHZSXU5MOkYvakl4fixnPzsoPUhpIzQ0WkRHLVhgd05zd1pdUGFgYkdDdUxlI1UjNSY/VXEpU2JrdCBMODtaPWxgWGBoI29xZ2g+fTRQN3Zqez08dSZfZSovNHRkITJwUktGWFt0eC1yfmI7W3BiSlNZKT9tLVJ2L0NbPyNOW0QpLiU/R19pKyArdmgiMyJKbGsiISJ7S3IuP1tGOV57cFZnZCJxQ08iVGxAQl0iSThTSURsVlMwYSQ0QD9YSXfDoU9mZz8kWHJMw6NiUzVfQ14uPWfDrVo/WmciayItSEdzIjkiWDJVNG9tVi0zLyoiRiI+UndVbV80In4idmBzcEl4dW0iXiIwUn5LWXdxIntMPUZhIlsmIiBkQypAakNGNDoiLSJKN0kiOWV9InZxSGt5fmJ0Uy57a2A3PzZ9Jk1bSXZTJVp0Pz9BJENjLyFOQENOMGZzPC1xNzMoeiFjV0FSZn5TS2gsRDdKVjJ9bD4sP1c1ZFQ4RjEjQCktQCtua3hJRS4sXnYxP0tdXmwvIU1MVWNqNVYyem5CMjZEOCMsSC08eFAzJVtOeVFaZ3BJamIoQG5XKy9fbm9xIm4iOiopIiYiWWNPaiJgLXwxLkRCZzIlWmtVZ2JBM3RXSCZZVklKMVBKJShgYkc+YkhQbkYyMlB1OXpKM2QiWllBIjYxKSJBIm4mXmpULm15bEImOSxPcyU2I0tsVyY1W0BuIVMjPCFaTUg8UFRRLCxSLDRHMktMOkpyTW57ekdWZi9oZGk7YClAaFFaR0BXfCFdYDBZSzw3QSJ7IjVYfHkiYjcyWCYiUDVNPyJ5Qlkib1V1IjFNXU5tQyJxUGQtIjkiaGUgbnolJVRFaG5oUWAtQTFKNHJUK1NkKCVKayo4JWdRXVU6bnt1KDU4NF09fDN0Ol1BXmBvIlgiNWp+IjQiJkJuYCYuSD5ZYS1nUVU5SWpoLCp3WDluK2Qxc19hbCogJGtmUnZWZCU2XXY/RX1AOywoIHUyfCB4ZTFxNzZ5eCJPW1VlT15DdysqM2JtJSJdPnx1IjpNMFhEemt+Y3gieCxhLSJNbyNDYkRLJjlYUlMgWGJVJDIiQH5pIlAiTHkieiIjREVYIkgiS2YiQWlhIil1ciFNIiRbRSx1Inc+NyJUIi5SZCBBbFVRQDNIYmwifSJTSzRhSCgmIjEiInwiO0hBIlNRKD0/ZldjR2cyQEMxQH41w6FAJGl+OkwsMsOjOF9bS0ssZCpfw61xWCAwIjMiQEY3YCJPIntrbDBZSk9OZHttXnphb1VDZGxjYCVIJD8xUkJiIWZGOlo1ND1ZK3J+RThUUkR9MzZbOmRoNCppXkhOajdgeisiQV5KIjQ1KiJlIiAiMVEqIksyNSIwIkdlIikiOCZ5VyJtInMrKSJhNjsiTG4yXyItInpKNy9jUXFqbHRLZ2EgPkxaYSorRGhgWklHRyFaKD9eTiFsdEIqbD40PD1AOCEyJlBYbSpVVVkwdXsxYiB8fTIuMixyQy9fPTtmaWNtZC1OaDckRFVKTVUvQV0uZVpGUVdUfD4zLW1IJjwkWmJmKiJKcikiVUtfIk1DYThxKSJ7ME1WImYiOG4yTD8rIyhRazdOJERnaSFbUXIrcEZYVmRqLTFOTlUpcC5SSTxCTHxEaCBkIFpla11GcTcubXdpKz1oaCokOSRoJltENltlPEw5V0FLKUVgVEZeMCNvdCZETyg5Y1VsXlImUUE7Rm1AXkptXSpRZDQuLmEmamt9LFRxPkV4Lj4hKFEsNS9HWzVlVjNyQHdCZ1tjMmlqaHIsVGhEZTk7ZGJkLmRtcT9ULVtQKnxLNVshJC1pMUhEZXxKa0RlPE9venVSL0FIbjYhVlMoIVI/YjdJTzBneXU5TTRgN2dCVH0mJndbZmdGb2Q2NXd0TkJgPE5gPS5COnIldUN7SCtXIzo9fmh0L2tBKHlqY1c7I2I+WnNbRkVaMFs4eVsxfEp1eTcybTlFJltKOkY0NXtqTTNFZWJTZn5OJmI6I2tXflNiLH1vK1I0dW5hbU5eUlYxeUBMWkhbcGU0JV5TK3lRL050cV0jUzpzcG8tdTR5KFpJbkk9MlV5XzIwX2pIRShffUg9O24/M3V5cSspNjpEMDBIenZxOXdIMzhoc2BUOihLciN7UnBxX3ZzLzY/S1pHQndHS1chSz0jdXZtXWxDQWM1NVR8TVdBW095JU1Oa1lLO295emEveGhgXWFgYVE8d0lObUd7enc/PnB2RUpbUWk/fDY2JU5JLVA+WFZaSkB0T215Z0pGRG97RF8kN2NVWDkhMVQ6cnVWc28vLEs3NXtbbnx3S2ViLkhuO2Z+OE1OOSpFVkUgKCY7QWRVfnkgUEtiK35neHRCWj9YPE9yKzQmbD1ZRjk8O1RjfTdHSWE9MVd8ZFZ5e1l3VGtZdlNZdl1YKVdIfEQ8ZHk0TWFufHtoQGBQS3YlT3dlJHE1a3s5OTpqMDVpMThnb0xdIzhDRjNeL0I3U2o7fGEud0UrSHFmZC1lZVpyK05sSGk0PltTWDdlY2A4Rj1pTDR0SjdPdykjVT81LlVpOF49VjQ7aXFjPS4sN3AvcEI0b3ZHOk1zLkFzVWVkNUN2RH1LdE1vbCFKPEFaKVZHKntXTTJ4QSg7PyBje3xNakh4XTZlNVBkaF1BWWw2dWJLRDEzd3M6byRDJHUsLm4pb0Y0XUdnP19pVzNaZ1guKWFiYF5LPCRjeT17cSQ2bUswY1h6fkZ0KEs6MVVoVC8qayZ3fm1qUzJfdHVjK0F3PzhqaU9AaUhUJCt4L1pFLDV9LCo1LTdyWyVNS1BxI2dKPiB5WE4ocS1LU1N2RSl4K3wsOUo/TTcrQSBxfEN2VDMqen5iVUMpQntxeEV8a1ZxYnw1OkJgRzV1Q0dSekkwdHRlaFRkPilaNzMzfUg7PU1Xa3M7NVVDSnFPYnBBbmhTVUdUUEY4KmI2OlAvXXRqfSVQY30wTkA+eV1pJVQvMW0wITUgNSF7YTdTTTxyKn5AUCAuXXEpfjF9W3gsbENHKEtDV2FwWGtIKC9hRCs1N11pOVcuQWlte15DbCVpVU1WbmYofT4xPS1iLU0peTg7XSVac1VmNz9SPjdTb2hORElodDdNbWR1VUlmJHt1KTxjK18tZCZRbCV4azBZQi85SHNzUU90fTotaj9nXWRvKU19YCtzOHAlQz49ZDEyeSs7ZH04YX0pRUA1ZiU3JkpdQXlhLnhKezJQTmQoY2RPaCBGZD9TKS9XWVEoUlpSIT8hVT55Wjh4Om9nc1EgL3w4UihDfE56M1ZISCRsa3A7bE8pfWFUfWomZ3V4WzhGNXJ9Zn1dKF8pTUpRMmUmOmYvcEtOMjlsTSpbYCZaQEJTfjwhRixkM1MrOkggdCo0fUMuaGlaUTgzYj9UXVU6SU8sTjRqXSxdLWBwNXFbfjRiSkMsIyQjZGNBIClSODBOTTBhRGtwTCtRNk1hYEZlIGQ5RS8uJDN+I2FNYCV4dytIJlI/eWxKTHhSbDh6JE5kQzg7KkU4QCw9eWgxWFNVaiBvRjl1dl5ULnMsTVJJdUI1bnt5Ky8/QTUyKzx4IW8+ZEItK2NrT0l9dUBrZ2xEbHFYXVNqbDIwPzMrXykxQWQmJGZjTVE6OHtxP3p9elo7eyUpLEhaKig2JX1RMzlMJUk+LzN0O34xZmxDbyErYztEKlFkdzNfZXl5IFQrQF03aVhQSElbVmFTUChrci1wSEhNbiNVWS41WkhTRSNDRjFnZ1huai4gPS42YkZgdmFGTV14I08mUVV3Jjt7aCFHJmFfZnx7OUtdRF1BMDthVDtQWXgsZitaI0hSal09ZiB5SGZmfS1TVW5nbVdNdjslcDJKaClqLncxY3Urd2w1VFYyTFZ0eE9Pe3cvI3E/al5PbXNZKGAybThdfT4wK2EtenUqK0xyN04keT8pJEUwKCA4Xj5rUnhmKWMjS0ZJfVFJOlptQkkuP3UrRDsqaDE5R2R9aDYhaFV3ViZIVVQxXldYdy5tI1p8WGUwNjhXQFFTLUYrXU0hIWI9YT1IPjpscWU1UjBWL1UxTmVte144U2QhVkwkdlhNOS9IITI+JGVveE1kPG9TIFt6QVhrVig/VD4iSSJmW0MiWylXcl06LkEiRSI5TEUoUy1XIkgifCxJIk8iej8qKyJxPXgmWUlDIlsiXSJsck8yIj0ifjYvSmpNKCUiMCIgWmhAIz9fInUiZFchfWEiRDlkIjpnZyJLYkwtdE0tImdbaCJkIVAtM0oiPmtmUD4vKCJoMD1KeTJxViJpIltFdWNhTUIibnRVOyVqTDciTyJ0R0NffjMxIloiWnZ0UV0iaiJWYzdoInw7b2dFRHYwbSI1eiJMIlg8a2EiXyJmL0teImgiJWZ1dlN1a2AiPlVBInZoTSJVIk9DUDdfYT5xX1k5NDQ2MkhTMyQiZiJRKiUpInciZHBINywiViMmImFxMSJ2IiIyIlJNLiUiNSJBNktERXlWdiZmVm1uKUIifiI/cm4iPSJJJW1EUDtzQyYvPTM6InoiSit6NitXeSJAIiRNX2RRQGV+eyJOWGAiKy1LInoiQyIqI2Aic0h0IjludyJPdWllIlRvIkd0Ims6RGIiZk46YyJ+QiJLR21SIl1YL0FvWnsiXmlacSJFVCgwIkxnViJGImNgIjIiISpaRyJWIlBjaTFfcFsiPyJzWyBHIiMiakFqcyI4InhoWzYiWyJOd3V6XTQwPUxTMlcxTDA+VFVXNHQgfVRpSiwkYUggbjBTandUODs2ZnZBbE9wWmU7RUF0W2t8TXZoTz90b1RAaDxKXSJ4ImU0UiIocTN9fl1dIkZ+PyJEImlBQSwgZFgiYiJte2QkIl8iWCt1QzFZIisib2NyIjkiIXd8YWpjUiIlIj1KQVUiR0QoZFkqKyIjVGhfInZXViJ3bGsiNiJ+VkxYKXZlLEsjRDpvbklFcENre29vNElGKSt7I3glcyBVRW85MSVMZER2c0pOLyxiRGMhIXNNcGNKIkAiK1FRImEickZOPSIjIncjaSIgIiIpT3ciWDV5Ig==';
    const sensorData = Buffer.from(sensorBase64, 'base64').toString('utf-8');
    const referer = dto
      ? `${AZUL_PAGE_URL}?c[0].ds=${dto.origin}&c[0].std=${this.toAzulStdDate(dto.departureDate)}&c[0].as=${dto.destination}&p[0].t=ADT&p[0].c=${dto.adults}&p[0].cp=false&f.dl=3&f.dr=3&cc=BRL`
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
      this.logger.log(`[Azul] Sensor POST OK. Cookies: ${this.listCookieNames(updatedCookies)}`);
      this.logger.log(`[Azul] Sensor POST sucesso: ${JSON.stringify(response.data)}`);
      return updatedCookies;
    } catch (error: any) {
      return this.handlePartialCookies(error, currentCookies, 'POST sensor');
    }
  }

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
