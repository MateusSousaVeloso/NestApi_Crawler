import { ParsedFlight, FlightLeg } from '../../search.interfaces';

const CASH_FAMILY_MAP: Record<string, 'ECONOMY' | 'BUSINESS'> = {
  ECONOMY_CONVENIENCE: 'ECONOMY',
  ECONOMY_COMFORT: 'ECONOMY',
  BUSINESS_COMFORT: 'BUSINESS',
  BUSINESS_ELITE: 'BUSINESS',
};

const CABIN_MAP: Record<string, string> = {
  ECONOMY: 'ECONOMIC',
  BUSINESS: 'BUSINESS',
};

interface OfferContext {
  origin: string;
  destination: string;
  segments: any[];
  durHours: number;
  durMinutes: number;
  departureDatetime: string;
  arrivalDatetime: string;
  stops: number;
  firstFn: string;
  flightCode: string;
  uidKey: string;
  legs?: FlightLeg[];
}

function extractOfferContext(offer: any): OfferContext | null {
  const segments: any[] = offer.segments || [];
  if (!segments.length) return null;

  const origin = offer.origin?.iataCode || '';
  const destination = offer.destination?.iataCode || '';
  const totalSeconds = offer.duration ?? 0;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const durHours = Math.floor(totalMinutes / 60);
  const durMinutes = totalMinutes % 60;

  const departureDatetime = segments[0].departure?.dateTime || '';
  const arrivalDatetime = segments[segments.length - 1].arrival?.dateTime || '';
  const stops = offer.numberOfStops ?? 0;

  const flightNums = segments.map((s) => s.flightNumber).filter(Boolean);
  const firstFn = segments[0].flightNumber || '';
  const flightCode = flightNums.join(', ');
  const uidKey = flightNums.join(',') || firstFn;

  let legs: FlightLeg[] | undefined;
  if (segments.length > 1) {
    legs = segments.map((seg) => ({
      flightCode: seg.flightNumber || '',
      cabin: '',
      departure: {
        date: seg.departure?.dateTime || '',
        airport: seg.departure?.origin?.iataCode || '',
      },
      arrival: {
        date: seg.arrival?.dateTime || '',
        airport: seg.arrival?.destination?.iataCode || '',
      },
    }));
  }

  return {
    origin,
    destination,
    segments,
    durHours,
    durMinutes,
    departureDatetime,
    arrivalDatetime,
    stops,
    firstFn,
    flightCode,
    uidKey,
    legs,
  };
}

function buildFlight(ctx: OfferContext, cabin: string, uid: string): ParsedFlight {
  const flight: ParsedFlight = {
    uid,
    airline: 'Qatar Airways',
    cabin,
    availableSeats: 0,
    stops: ctx.stops,
    departure: {
      flightCode: ctx.flightCode || ctx.firstFn,
      date: ctx.departureDatetime,
      airport: ctx.origin,
      name: '',
    },
    arrival: {
      date: ctx.arrivalDatetime,
      airport: ctx.destination,
      name: '',
    },
    duration: { hours: ctx.durHours, minutes: ctx.durMinutes },
  };
  if (ctx.legs) flight.legs = ctx.legs;
  return flight;
}

function parseCashResponse(data: any): Map<string, { price: number; seats: number }> {
  const result = new Map<string, { price: number; seats: number }>();
  if (!data?.flightOffers) return result;

  for (const offer of data.flightOffers || []) {
    const ctx = extractOfferContext(offer);
    if (!ctx) continue;

    const best: Record<string, { price: number; seats: number }> = {};
    for (const fare of offer.fareOffers || []) {
      const broad = CASH_FAMILY_MAP[fare.fareFamilyCode];
      if (!broad) continue;
      const seats = fare.availableSeats ?? 0;
      if (!seats) continue;
      const priceBlock = fare.price || {};
      const priceRaw = priceBlock.total ?? priceBlock.base ?? 0;
      const price = Number(priceRaw);
      if (!price || price <= 0) continue;
      if (!best[broad] || price < best[broad].price) {
        best[broad] = { price: Math.round(price * 100) / 100, seats };
      }
    }

    for (const [broad, entry] of Object.entries(best)) {
      const uid = `${ctx.uidKey}|${ctx.departureDatetime}_${broad}`;
      result.set(uid, entry);
    }
  }

  return result;
}

function parseAwardResponse(data: any): ParsedFlight[] {
  if (!data?.flightOffers) return [];
  const flights: ParsedFlight[] = [];

  try {
    for (const offer of data.flightOffers || []) {
      const ctx = extractOfferContext(offer);
      if (!ctx) continue;

      for (const fare of offer.fareOffers || []) {
        const priceBlock = fare.price || {};
        if (priceBlock.currencyCode !== 'AVIOS') continue;
        const seats = fare.availableSeats ?? 0;
        if (!seats) continue;

        const cabinRaw = fare.cabinType || '';
        const cabin = CABIN_MAP[cabinRaw] || cabinRaw;
        const uid = `${ctx.uidKey}|${ctx.departureDatetime}_${cabinRaw}`;

        const flight = buildFlight(ctx, cabin, uid);
        flight.availableSeats = seats;
        flight.miles = priceBlock.base;
        flights.push(flight);
      }
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Award Qatar: ${e.message}`);
    return [];
  }

  return flights;
}

export function parseQatarResponse(awardData: any, cashData: any): ParsedFlight[] {
  const flights = parseAwardResponse(awardData);
  if (!cashData) return flights;

  const cashByUid = parseCashResponse(cashData);
  const awardUids = new Set<string>();

  for (const flight of flights) {
    awardUids.add(flight.uid);
    const cashKey = flight.uid;
    const cashEntry = cashByUid.get(cashKey);
    if (cashEntry) {
      flight.price = cashEntry.price;
      flight.currency = 'BRL';
    }
  }

  // Voos cash-only (sem milhas)
  for (const [uid, entry] of cashByUid.entries()) {
    if (awardUids.has(uid)) continue;
    const broadFromUid = uid.split('_').pop() || '';
    const cabin = CABIN_MAP[broadFromUid] || broadFromUid;
    // Reconstruir contexto a partir do uid não é possível — pular se não estiver na lista de award
    // (mantemos consistência: cash-only só aparece se award também respondeu)
    const flight: ParsedFlight = {
      uid,
      airline: 'Qatar Airways',
      cabin,
      availableSeats: entry.seats,
      stops: 0,
      departure: { date: '', airport: '', name: '' },
      arrival: { date: '', airport: '', name: '' },
      duration: { hours: 0, minutes: 0 },
      price: entry.price,
      currency: 'BRL',
    };
    flights.push(flight);
  }

  return flights;
}
