import { Logger } from '@nestjs/common';
import { ParsedFlight, FlightLeg } from '../../search.interfaces';

const logger = new Logger('TapParser');

const CABIN_MAP: Record<string, string> = {
  Y: 'economy',
  W: 'premium_economy',
  C: 'business',
  J: 'business',
  F: 'first',
};

function findInner(data: any): any {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Array.isArray(data.listOutbound) && data.offerMatrix) return data;
  if (data.data) return findInner(data.data);
  return null;
}

export function parseTapResponse(rawData: any): ParsedFlight[] {
  if (!rawData || typeof rawData !== 'object') return [];

  const inner = findInner(rawData);
  logger.debug(`inner found: ${!!inner}, offerMatrix listTab: ${inner?.offerMatrix?.listTab?.length ?? 0}`);
  if (!inner?.offerMatrix?.listTab?.length) return [];

  const listOutbound: any[] = inner.listOutbound ?? [];
  const listInbound: any[] = inner.listInbound ?? [];
  const { listTab, currency } = inner.offerMatrix;

  const outMap = new Map<number, any>(listOutbound.map((f: any) => [f.idFlight, f]));
  const inMap  = new Map<number, any>(listInbound.map((f: any) => [f.idFlight, f]));

  const seen = new Set<string>();
  const flights: ParsedFlight[] = [];

  for (const offer of listTab) {
    if (String(offer.available) !== '1' || !offer.offerBean) continue;

    const bean = offer.offerBean;
    const totalMiles: number = bean.totalPoints?.price ?? 0;
    if (totalMiles === 0) continue;

    for (const group of (bean.groupFlights ?? [])) {
      const outFlight = outMap.get(group.idOutBound);
      if (!outFlight) continue;

      const outSegs: any[] = outFlight.listSegment ?? [];
      if (!outSegs.length) continue;

      const uid = `TAP-${offer.date}-${offer.returnDate ?? ''}-${bean.idOffer}-${group.idOutBound}-${group.idInBound}`;
      if (seen.has(uid)) continue;
      seen.add(uid);

      const firstSeg = outSegs[0];
      const lastSeg  = outSegs[outSegs.length - 1];
      const outCabin = CABIN_MAP[bean.outCabin] ?? bean.outCabin ?? 'economy';

      const routeParts = [firstSeg.departureAirport, ...outSegs.map((s: any) => s.arrivalAirport)];
      const flightCode = outSegs.map((s: any) => `TP${s.flightNumber}`).join(', ');
      const durationMin: number = outFlight.duration ?? 0;

      const outLegs: FlightLeg[] = outSegs.map((s: any) => ({
        flightCode: `TP${s.flightNumber}`,
        cabin: outCabin,
        aircraft: s.equipment,
        departure: { date: s.departureDate, airport: s.departureAirport },
        arrival:   { date: s.arrivalDate,   airport: s.arrivalAirport   },
      }));

      const inFlight = inMap.get(group.idInBound);
      const inCabin  = CABIN_MAP[bean.inCabin] ?? bean.inCabin ?? 'economy';
      const inLegs: FlightLeg[] = (inFlight?.listSegment ?? []).map((s: any) => ({
        flightCode: `TP${s.flightNumber}`,
        cabin: inCabin,
        aircraft: s.equipment,
        departure: { date: s.departureDate, airport: s.departureAirport },
        arrival:   { date: s.arrivalDate,   airport: s.arrivalAirport   },
      }));

      flights.push({
        uid,
        airline: 'TAP',
        cabin: outCabin,
        availableSeats: 0,
        stops: outFlight.numberOfStops ?? 0,
        departure: {
          flightCode,
          date:    firstSeg.departureDate,
          airport: firstSeg.departureAirport,
          name:    firstSeg.departureAirport,
        },
        arrival: {
          date:    lastSeg.arrivalDate,
          airport: lastSeg.arrivalAirport,
          name:    lastSeg.arrivalAirport,
        },
        duration: {
          hours:   Math.floor(durationMin / 60),
          minutes: durationMin % 60,
        },
        miles: totalMiles,
        price: bean.totalPrice?.tax ?? undefined,
        currency: currency ?? 'BRL',
        legs: [...outLegs, ...inLegs],
      });
    }
  }

  return flights;
}
