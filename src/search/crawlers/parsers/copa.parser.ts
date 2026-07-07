import { ParsedFlight, FlightLeg } from '../../search.interfaces';

interface CopaCarrier {
  flightNumber?: string;
  airlineCode?: string;
  airlineName?: string;
}

interface CopaEndpoint {
  airportCode?: string;
  airportName?: string;
  flightDate?: string;
  flightTime?: string;
}

interface CopaFlight {
  marketingCarrier?: CopaCarrier;
  operatingCarrier?: CopaCarrier | null;
  arrival?: CopaEndpoint;
  departure?: CopaEndpoint;
}

interface CopaOffer {
  id: string;
  pricePerAdult?: { miles?: number; taxes?: number };
  fareFamily?: { code?: string; name?: string };
}

interface CopaSolution {
  numberOfLayovers?: number;
  journeyTime?: string;
  flights?: CopaFlight[];
  offers?: CopaOffer[];
}

function parseJourneyTime(journeyTime?: string): { hours: number; minutes: number } {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(journeyTime || '');
  return {
    hours: Number(match?.[1] || 0),
    minutes: Number(match?.[2] || 0),
  };
}

function combineDateTime(endpoint?: CopaEndpoint): string {
  if (!endpoint?.flightDate) return '';
  return `${endpoint.flightDate}T${endpoint.flightTime || '00:00'}:00`;
}

function resolveCabin(fareFamilyCode?: string): string {
  if (!fareFamilyCode) return 'ECONOMIC';
  return fareFamilyCode.startsWith('B') ? 'BUSINESS' : 'ECONOMIC';
}

function buildFlightCode(flights: CopaFlight[]): string {
  return flights
    .map((f) => `${f.marketingCarrier?.airlineCode || ''}${f.marketingCarrier?.flightNumber || ''}`)
    .filter(Boolean)
    .join(', ');
}

function resolveAirline(flights: CopaFlight[]): string {
  const names = [...new Set(flights.map((f) => f.marketingCarrier?.airlineName).filter(Boolean))];
  return names.join(' / ') || '';
}

function buildLegs(flights: CopaFlight[]): FlightLeg[] | undefined {
  if (flights.length <= 1) return undefined;
  return flights.map((f) => ({
    flightCode: `${f.marketingCarrier?.airlineCode || ''}${f.marketingCarrier?.flightNumber || ''}`,
    cabin: '',
    departure: {
      date: combineDateTime(f.departure),
      airport: f.departure?.airportCode || '',
    },
    arrival: {
      date: combineDateTime(f.arrival),
      airport: f.arrival?.airportCode || '',
    },
  }));
}

export function parseCopaResponse(data: any): ParsedFlight[] {
  if (!data?.solutions) return [];

  const currency: string = data.currency?.code || 'USD';
  const flightsList: ParsedFlight[] = [];

  try {
    for (const solution of data.solutions as CopaSolution[]) {
      const flights = solution.flights || [];
      if (!flights.length) continue;

      const airline = resolveAirline(flights);
      const legs = buildLegs(flights);
      const firstFlight = flights[0];
      const lastFlight = flights[flights.length - 1];

      for (const offer of solution.offers || []) {
        const flight: ParsedFlight = {
          uid: offer.id,
          airline,
          cabin: resolveCabin(offer.fareFamily?.code),
          availableSeats: 0,
          stops: solution.numberOfLayovers ?? 0,
          departure: {
            flightCode: buildFlightCode(flights) || undefined,
            date: combineDateTime(firstFlight.departure),
            airport: firstFlight.departure?.airportCode || '',
            name: firstFlight.departure?.airportName || '',
          },
          arrival: {
            date: combineDateTime(lastFlight.arrival),
            airport: lastFlight.arrival?.airportCode || '',
            name: lastFlight.arrival?.airportName || '',
          },
          duration: parseJourneyTime(solution.journeyTime),
          miles: offer.pricePerAdult?.miles,
          price: offer.pricePerAdult?.taxes,
          currency,
        };

        if (legs) flight.legs = legs;

        flightsList.push(flight);
      }
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Copa Airlines: ${e.message}`);
    return [];
  }

  return flightsList;
}
