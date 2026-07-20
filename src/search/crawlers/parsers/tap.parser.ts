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

function findInner(data: any, depth = 0): any {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Array.isArray(data.listOutbound)) {
    const hasOfferMatrix = !!data.offerMatrix?.listTab?.length;
    const hasOffers = Array.isArray(data.offers?.listOffers) && data.offers.listOffers.length > 0;
    if (hasOfferMatrix || hasOffers) return data;
  }
  if (data.data) return findInner(data.data, depth + 1);
  return null;
}

/** Busca one-way: usa data.offers.listOffers */
function parseOneWay(inner: any): ParsedFlight[] {
  const listOffers: any[] = inner.offers.listOffers;
  const listOutbound: any[] = inner.listOutbound ?? [];
  const currency: string = inner.offers.currency ?? 'BRL';

  const outMap = new Map<number, any>(listOutbound.map((f: any) => [f.idFlight, f]));
  const seen = new Set<string>();
  const flights: ParsedFlight[] = [];

  for (const offer of listOffers) {
    const totalMiles: number = offer.totalPoints?.price ?? 0;
    if (totalMiles === 0) continue;

    const cabinCode: string = offer.outCabin ?? 'Y';
    const cabin = CABIN_MAP[cabinCode] ?? 'economy';
    const tax: number = offer.totalPrice?.tax ?? 0;

    for (const group of (offer.groupFlights ?? [])) {
      const flight = outMap.get(group.idOutBound);
      if (!flight) continue;

      const segs: any[] = flight.listSegment ?? [];
      if (!segs.length) continue;

      const uid = `TAP-O-${offer.idOffer}-${group.idOutBound}`;
      if (seen.has(uid)) continue;
      seen.add(uid);

      const firstSeg = segs[0];
      const lastSeg = segs[segs.length - 1];
      const flightCode = segs.map((s: any) => `TP${s.flightNumber}`).join(', ');
      const durationMin: number = flight.duration ?? 0;

      const legs: FlightLeg[] = segs.map((s: any) => ({
        flightCode: `TP${s.flightNumber}`,
        cabin,
        airline: 'TAP',
        aircraft: s.equipment,
        departure: { date: s.departureDate, airport: s.departureAirport },
        arrival:   { date: s.arrivalDate,   airport: s.arrivalAirport   },
      }));

      flights.push({
        uid,
        airline: 'TAP',
        cabin,
        availableSeats: group.seatOutBound ?? 0,
        stops: flight.numberOfStops ?? 0,
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
        miles:    totalMiles,
        price:    tax,
        currency,
        legs,
      });
    }
  }

  return flights;
}

/** Busca return: usa data.offerMatrix.listTab (formato antigo) */
function parseReturn(inner: any): ParsedFlight[] {
  const listOutbound: any[] = inner.listOutbound ?? [];
  const listInbound: any[]  = inner.listInbound  ?? [];
  const { listTab, currency } = inner.offerMatrix;

  const outMap = new Map<number, any>(listOutbound.map((f: any) => [f.idFlight, f]));
  const inMap  = new Map<number, any>(listInbound.map((f: any)  => [f.idFlight, f]));

  const seen = new Set<string>();
  const flights: ParsedFlight[] = [];

  for (const offer of listTab) {
    if (offer.available !== '1' || !offer.offerBean) continue;

    const bean = offer.offerBean;
    const totalMiles: number = bean.totalPoints?.price ?? 0;
    if (totalMiles === 0) continue;

    for (const group of (bean.groupFlights ?? [])) {
      const outFlight = outMap.get(group.idOutBound);
      if (!outFlight) continue;

      const outSegs: any[] = outFlight.listSegment ?? [];
      if (!outSegs.length) continue;

      const uid = `TAP-R-${offer.date}-${offer.returnDate ?? ''}-${bean.idOffer}-${group.idOutBound}-${group.idInBound}`;
      if (seen.has(uid)) continue;
      seen.add(uid);

      const firstSeg = outSegs[0];
      const lastSeg  = outSegs[outSegs.length - 1];
      const outCabin = CABIN_MAP[bean.outCabin] ?? bean.outCabin ?? 'economy';
      const flightCode = outSegs.map((s: any) => `TP${s.flightNumber}`).join(', ');
      const durationMin: number = outFlight.duration ?? 0;

      const outLegs: FlightLeg[] = outSegs.map((s: any) => ({
        flightCode: `TP${s.flightNumber}`,
        cabin: outCabin,
        airline: 'TAP',
        aircraft: s.equipment,
        departure: { date: s.departureDate, airport: s.departureAirport },
        arrival:   { date: s.arrivalDate,   airport: s.arrivalAirport   },
      }));

      const inFlight = inMap.get(group.idInBound);
      const inCabin  = CABIN_MAP[bean.inCabin] ?? bean.inCabin ?? 'economy';
      const inLegs: FlightLeg[] = (inFlight?.listSegment ?? []).map((s: any) => ({
        flightCode: `TP${s.flightNumber}`,
        cabin: inCabin,
        airline: 'TAP',
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
        miles:    totalMiles,
        price:    bean.totalPrice?.tax ?? undefined,
        currency: currency ?? 'BRL',
        legs:     [...outLegs, ...inLegs],
      });
    }
  }

  return flights;
}

export function parseTapResponse(rawData: any): ParsedFlight[] {
  if (!rawData || typeof rawData !== 'object') return [];

  const inner = findInner(rawData);
  if (!inner) return [];

  try {
    if (Array.isArray(inner.offers?.listOffers) && inner.offers.listOffers.length > 0) {
      const result = parseOneWay(inner);
      logger.debug(`parseOneWay → ${result.length} voo(s)`);
      return result;
    }

    if (inner.offerMatrix?.listTab?.length) {
      const result = parseReturn(inner);
      logger.debug(`parseReturn → ${result.length} voo(s)`);
      return result;
    }
  } catch (e: any) {
    logger.error(`Erro ao parsear TAP: ${e.message}`);
  }

  return [];
}
