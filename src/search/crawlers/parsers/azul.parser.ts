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
  airline: string;
}

// A Azul não manda nome de companhia em lugar nenhum da resposta, só o
// código do operador real (identifier.operatedBy, que pode divergir do
// carrierCode "AD" em voos com conexão operados por parceiro). Sem uma
// tabela de nomes, usamos "Azul" pro código AD e o próprio código nos
// demais casos — melhor que inventar um nome que não temos confirmação.
function resolveOperatorName(code: string | undefined): string {
  if (!code || code === 'AD') return 'Azul';
  return code;
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
        airline: resolveOperatorName(segId.operatedBy || segId.carrierCode),
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

  const airline = legs
    ? [...new Set(legs.map((l) => l.airline).filter(Boolean))].join(' / ')
    : resolveOperatorName(identifier.operatedBy || carrier);

  return { uid, std, sta, depAirport, arrAirport, durHours, durMinutes, stops, flightCode, availableSeats, legs, airline };
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
          airline: fields.airline,
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

export function parseAzulResponse(milesData: any): ParsedFlight[] {
  const milesResults = parseMilesResponse(milesData);
  return milesResults.map(({ flight }) => flight);
}
