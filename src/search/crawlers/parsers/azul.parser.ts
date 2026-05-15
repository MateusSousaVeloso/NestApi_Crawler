import { ParsedFlight, FlightLeg } from '../../search.interfaces';

interface ExtractedFields {
  uid: string;
  std?: string;
  sta?: string;
  depAirport: string;
  arrAirport: string;
  durHours: number;
  durMinutes: number;
  stops: number;
  flightCode?: string;
  availableSeats: number;
  legs?: FlightLeg[];
}

function extractJourneyFields(journey: any): ExtractedFields {
  const identifier = journey.identifier || {};
  const segments: any[] = journey.segments || [];
  const connections = identifier.connections;

  const carrier = identifier.carrierCode || '';
  const flightNum = identifier.flightNumber || '';
  const uid = journey.journeyKey || `${carrier}${flightNum}`;

  const std = identifier.std;
  const sta = identifier.sta;
  const duration = identifier.duration || {};
  const durHours = duration.hours ?? 0;
  const durMinutes = duration.minutes ?? 0;

  const depAirport = identifier.departureStation || '';
  const arrAirport = identifier.arrivalStation || '';

  let stops: number;
  if (Array.isArray(connections)) stops = connections.length;
  else stops = Math.max(0, segments.length - 1);

  let flightCode: string | undefined;
  if (segments.length) {
    const codes = segments
      .map((s) => {
        const id = s.identifier || {};
        return `${id.carrierCode || ''}${id.flightNumber || ''}`.trim();
      })
      .filter(Boolean);
    flightCode = codes.join(', ') || undefined;
  } else {
    flightCode = `${carrier}${flightNum}`.trim() || undefined;
  }

  // Assentos: mínimo entre todos os legs
  const allRemaining: number[] = [];
  for (const seg of segments) {
    for (const leg of seg.legs || []) {
      const remaining = leg.legInfo?.remainingSeats;
      if (remaining != null) allRemaining.push(remaining);
    }
  }
  const availableSeats = allRemaining.length ? Math.min(...allRemaining) : 0;

  let legs: FlightLeg[] | undefined;
  if (segments.length > 1) {
    legs = segments.map((seg) => {
      const segId = seg.identifier || {};
      return {
        flightCode: `${segId.carrierCode || ''}${segId.flightNumber || ''}`.trim(),
        cabin: 'ECONOMIC',
        departure: {
          date: segId.std || '',
          airport: segId.departureStation || '',
        },
        arrival: {
          date: segId.sta || '',
          airport: segId.arrivalStation || '',
        },
      } as FlightLeg;
    });
    legs.sort((a, b) => (a.arrival.date || '').localeCompare(b.arrival.date || ''));
  }

  return { uid, std, sta, depAirport, arrAirport, durHours, durMinutes, stops, flightCode, availableSeats, legs };
}

function parseMilesResponse(data: any): { flight: ParsedFlight; uid: string }[] {
  const result: { flight: ParsedFlight; uid: string }[] = [];
  if (!data) return result;

  try {
    for (const trip of data.data?.trips || []) {
      for (const journey of trip.journeys || []) {
        if (!(journey.status?.available ?? true)) continue;
        const availableFares = (journey.fares || []).filter((f: any) => f.available ?? true);
        if (!availableFares.length) continue;

        const fare = availableFares[0];
        const paxPoints: any[] = fare.paxPoints || [];
        const level = paxPoints[0]?.levels?.[0] || {};
        const rawMiles = level.points?.discountedAmount ?? level.points?.amount;

        const fields = extractJourneyFields(journey);
        const flight: ParsedFlight = {
          uid: fields.uid,
          airline: 'Azul',
          cabin: 'ECONOMIC',
          availableSeats: fields.availableSeats,
          stops: fields.stops,
          departure: {
            ...(fields.flightCode ? { flightCode: fields.flightCode } : {}),
            date: fields.std || '',
            airport: fields.depAirport,
            name: '',
          },
          arrival: {
            date: fields.sta || '',
            airport: fields.arrAirport,
            name: '',
          },
          duration: { hours: fields.durHours, minutes: fields.durMinutes },
          miles: rawMiles || undefined,
          currency: 'BRL',
        };
        if (fields.legs) flight.legs = fields.legs;
        result.push({ flight, uid: fields.uid });
      }
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Azul (milhas): ${e.message}`);
  }
  return result;
}

function parseCashResponse(data: any): Map<string, number> {
  const byUid = new Map<string, number>();
  if (!data) return byUid;

  try {
    for (const trip of data.data?.trips || []) {
      for (const journey of trip.journeys || []) {
        if (!(journey.status?.available ?? true)) continue;
        const fares = journey.fares || [];
        if (!fares.length) continue;

        const identifier = journey.identifier || {};
        const uid =
          journey.journeyKey ||
          `${identifier.carrierCode || ''}${identifier.flightNumber || ''}`;

        const paxFares: any[] = fares[0].paxFares || [];
        const adtFare = paxFares.find((pf) => pf.paxType === 'ADT');
        const adt = adtFare?.totalAmount ?? paxFares[0]?.totalAmount ?? 0;
        byUid.set(uid, adt ? Math.round(adt * 100) / 100 : 0);
      }
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Azul (cash): ${e.message}`);
  }
  return byUid;
}

export function parseAzulResponse(milesData: any, cashData: any): ParsedFlight[] {
  const milesResults = parseMilesResponse(milesData);
  const cashByUid = cashData ? parseCashResponse(cashData) : new Map<string, number>();

  const milesUids = new Set<string>();
  for (const { flight, uid } of milesResults) {
    flight.price = cashByUid.get(uid) ?? 0;
    milesUids.add(uid);
  }

  const flights: ParsedFlight[] = milesResults.map(({ flight }) => flight);

  // Voos cash-only (sem disponibilidade de milhas)
  if (cashData) {
    try {
      for (const trip of cashData.data?.trips || []) {
        for (const journey of trip.journeys || []) {
          if (!(journey.status?.available ?? true)) continue;
          const identifier = journey.identifier || {};
          const uid =
            journey.journeyKey ||
            `${identifier.carrierCode || ''}${identifier.flightNumber || ''}`;
          if (milesUids.has(uid)) continue;

          const fares = journey.fares || [];
          if (!fares.length) continue;
          const paxFares: any[] = fares[0].paxFares || [];
          if (!paxFares.length) continue;
          const adtFare = paxFares.find((pf) => pf.paxType === 'ADT');
          const adt = adtFare?.totalAmount ?? paxFares[0]?.totalAmount ?? 0;

          const fields = extractJourneyFields(journey);
          const flight: ParsedFlight = {
            uid,
            airline: 'Azul',
            cabin: 'ECONOMIC',
            availableSeats: fields.availableSeats,
            stops: fields.stops,
            departure: {
              ...(fields.flightCode ? { flightCode: fields.flightCode } : {}),
              date: fields.std || '',
              airport: fields.depAirport,
              name: '',
            },
            arrival: {
              date: fields.sta || '',
              airport: fields.arrAirport,
              name: '',
            },
            duration: { hours: fields.durHours, minutes: fields.durMinutes },
            price: adt ? Math.round(adt * 100) / 100 : 0,
            currency: 'BRL',
          };
          if (fields.legs) flight.legs = fields.legs;
          flights.push(flight);
        }
      }
    } catch (e: any) {
      console.error(`Erro ao parsear cash-only Azul: ${e.message}`);
    }
  }

  return flights;
}
