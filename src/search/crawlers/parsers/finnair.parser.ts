import { ParsedFlight, FlightLeg } from '../../search.interfaces';

const CABIN_MAP: Record<string, string> = {
  ECONOMY: 'ECONOMIC',
  PREMIUM_ECONOMY: 'PREMIUM',
  BUSINESS: 'BUSINESS',
  FIRST: 'FIRST',
};

interface FinnairOffer {
  offerId: string;
  outboundId: string;
  outboundFareFamily: string;
  outboundFareInformation?: { cabinClass?: string }[];
  outboundPointsPrice?: string;
  outboundPrice?: string;
}

interface FinnairItinerarySegment {
  flightNumber?: string;
  operatingAirline?: { code?: string; name?: string };
  aircraftName?: string;
}

interface FinnairOutbound {
  departure?: { dateTime?: string; locationCode?: string };
  arrival?: { dateTime?: string; locationCode?: string };
  duration?: { hours?: number; minutes?: number };
  stops?: number;
  itinerary?: FinnairItinerarySegment[];
  operatingAirlineCodes?: string[];
  uniqueAirlineNames?: string[];
  quotas?: Record<string, number | null>;
}

function resolveSegmentAirline(
  seg: FinnairItinerarySegment,
  airlines: Record<string, { name?: string }>,
): string {
  const code = seg.operatingAirline?.code;
  if (code && airlines[code]?.name) return airlines[code].name as string;
  return seg.operatingAirline?.name || code || '';
}

function resolveAirlineName(
  outbound: FinnairOutbound,
  airlines: Record<string, { name?: string }>,
): string {
  const code = outbound.operatingAirlineCodes?.[0] || outbound.itinerary?.[0]?.operatingAirline?.code;
  if (code && airlines[code]?.name) return airlines[code].name as string;
  return outbound.uniqueAirlineNames?.[0] || outbound.itinerary?.[0]?.operatingAirline?.name || code || '';
}

function buildFlightCode(outbound: FinnairOutbound): string {
  return (outbound.itinerary || [])
    .map((seg) => seg.flightNumber || '')
    .filter(Boolean)
    .join(', ');
}

function buildLegs(
  outbound: FinnairOutbound,
  airlines: Record<string, { name?: string }>,
): FlightLeg[] | undefined {
  const itinerary = outbound.itinerary || [];
  if (itinerary.length <= 1) return undefined;
  return itinerary.map((seg) => ({
    flightCode: seg.flightNumber || '',
    cabin: '',
    airline: resolveSegmentAirline(seg, airlines),
    aircraft: seg.aircraftName,
    departure: {
      date: outbound.departure?.dateTime || '',
      airport: outbound.departure?.locationCode || '',
    },
    arrival: {
      date: outbound.arrival?.dateTime || '',
      airport: outbound.arrival?.locationCode || '',
    },
  }));
}

export function parseFinnairResponse(data: any): ParsedFlight[] {
  if (!data?.offers || !data?.outbounds) return [];

  const airlines: Record<string, { name?: string }> = data.airlines || {};
  const outbounds: Record<string, FinnairOutbound> = data.outbounds || {};
  const currency: string = data.currency || 'EUR';

  const flights: ParsedFlight[] = [];

  try {
    for (const offer of (data.offers || []) as FinnairOffer[]) {
      const outbound = outbounds[offer.outboundId];
      if (!outbound) continue;

      const miles = Number(offer.outboundPointsPrice ?? 0) || undefined;
      const price = Number(offer.outboundPrice ?? 0) || undefined;
      const cabinRaw = offer.outboundFareInformation?.[0]?.cabinClass || '';
      const cabin = CABIN_MAP[cabinRaw] || cabinRaw || 'ECONOMIC';
      const availableSeats = outbound.quotas?.[offer.outboundFareFamily] ?? 0;

      const flight: ParsedFlight = {
        uid: offer.offerId,
        airline: resolveAirlineName(outbound, airlines),
        cabin,
        availableSeats: availableSeats ?? 0,
        stops: outbound.stops ?? 0,
        departure: {
          flightCode: buildFlightCode(outbound) || undefined,
          date: outbound.departure?.dateTime || '',
          airport: outbound.departure?.locationCode || '',
          name: '',
        },
        arrival: {
          date: outbound.arrival?.dateTime || '',
          airport: outbound.arrival?.locationCode || '',
          name: '',
        },
        duration: {
          hours: outbound.duration?.hours ?? 0,
          minutes: outbound.duration?.minutes ?? 0,
        },
        miles,
        price,
        currency,
      };

      const legs = buildLegs(outbound, airlines);
      if (legs) flight.legs = legs;

      flights.push(flight);
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Finnair: ${e.message}`);
    return [];
  }

  return flights;
}
