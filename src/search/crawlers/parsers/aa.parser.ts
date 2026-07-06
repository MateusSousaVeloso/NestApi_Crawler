import { ParsedFlight, FlightLeg } from '../../search.interfaces';

const CABIN_MAP: Record<string, string> = {
  COACH: 'ECONOMIC',
  PREMIUM_ECONOMY: 'PREMIUM',
  BUSINESS: 'BUSINESS',
  FIRST: 'FIRST',
};

interface AASegment {
  flight?: { carrierCode?: string; carrierName?: string; flightNumber?: string };
  departureDateTime?: string;
  arrivalDateTime?: string;
  origin?: { code?: string; name?: string };
  destination?: { code?: string; name?: string };
}

interface AAPricingDetail {
  productType?: string;
  benefitKey?: string;
  productAvailable?: boolean;
  seatsRemaining?: number;
  perPassengerAwardPoints?: number | string;
  allPassengerDisplayTotal?: { amount?: number; currency?: string };
  solutionID?: string;
}

interface AASlice {
  hash?: string;
  stops?: number;
  durationInMinutes?: number;
  carrierNames?: string[];
  origin?: { code?: string; name?: string };
  destination?: { code?: string; name?: string };
  departureDateTime?: string;
  arrivalDateTime?: string;
  segments?: AASegment[];
  pricingDetail?: AAPricingDetail[];
}

function buildFlightCode(segments: AASegment[]): string {
  return segments
    .map((seg) => `${seg.flight?.carrierCode || ''}${seg.flight?.flightNumber || ''}`)
    .filter(Boolean)
    .join(', ');
}

function buildLegs(segments: AASegment[]): FlightLeg[] | undefined {
  if (segments.length <= 1) return undefined;
  return segments.map((seg) => ({
    flightCode: `${seg.flight?.carrierCode || ''}${seg.flight?.flightNumber || ''}`,
    cabin: '',
    departure: {
      date: seg.departureDateTime || '',
      airport: seg.origin?.code || '',
    },
    arrival: {
      date: seg.arrivalDateTime || '',
      airport: seg.destination?.code || '',
    },
  }));
}

export function parseAAResponse(data: any): ParsedFlight[] {
  if (!data?.slices) return [];

  const flights: ParsedFlight[] = [];

  try {
    for (const slice of data.slices as AASlice[]) {
      const segments = slice.segments || [];
      const airline = slice.carrierNames?.[0] || segments[0]?.flight?.carrierName || '';
      const legs = buildLegs(segments);

      for (const pricing of slice.pricingDetail || []) {
        if (!pricing.productAvailable) continue;

        const cabinRaw = pricing.productType || pricing.benefitKey || '';
        const cabin = CABIN_MAP[cabinRaw] || cabinRaw || 'ECONOMIC';
        const miles = Number(pricing.perPassengerAwardPoints ?? 0) || undefined;

        const flight: ParsedFlight = {
          uid: pricing.solutionID || `${slice.hash || ''}-${cabinRaw}`,
          airline,
          cabin,
          availableSeats: pricing.seatsRemaining ?? 0,
          stops: slice.stops ?? 0,
          departure: {
            flightCode: buildFlightCode(segments) || undefined,
            date: slice.departureDateTime || '',
            airport: slice.origin?.code || '',
            name: slice.origin?.name || '',
          },
          arrival: {
            date: slice.arrivalDateTime || '',
            airport: slice.destination?.code || '',
            name: slice.destination?.name || '',
          },
          duration: {
            hours: Math.floor((slice.durationInMinutes ?? 0) / 60),
            minutes: (slice.durationInMinutes ?? 0) % 60,
          },
          miles,
          price: pricing.allPassengerDisplayTotal?.amount,
          currency: pricing.allPassengerDisplayTotal?.currency,
        };

        if (legs) flight.legs = legs;

        flights.push(flight);
      }
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta American Airlines: ${e.message}`);
    return [];
  }

  return flights;
}
