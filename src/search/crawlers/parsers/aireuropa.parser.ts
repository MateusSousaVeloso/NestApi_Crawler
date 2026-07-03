import { ParsedFlight, FlightLeg } from '../../search.interfaces';

function getAvailability(data: any): any {
  return data?.data?.pageDefinitionConfig?.pageData?.business?.Availability;
}

function durationFromSegments(segments: any[]): { hours: number; minutes: number } {
  const totalMs = segments.reduce((sum, s) => sum + (s.flightTime || s.segmentTime || 0), 0);
  const totalMinutes = Math.floor(totalMs / 60000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function toIso(dateStr: string): string {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toISOString();
}

export function parseAirEuropaResponse(data: any): ParsedFlight[] {
  const avail = getAvailability(data);
  if (!avail?.recommendationList || !avail?.proposedBounds?.length) return [];

  const fareFamilyNames: Record<string, string> = {};
  for (const ff of avail.fareFamilyList || []) {
    fareFamilyNames[ff.ffCode] = ff.ffName;
  }

  const proposedFlightsGroup: any[] = avail.proposedBounds[0]?.proposedFlightsGroup || [];

  const flights: ParsedFlight[] = [];

  try {
    for (const reco of avail.recommendationList || []) {
      const bound = reco.bounds?.[0];
      const flightGroup = bound?.flightGroupList?.[0];
      if (!bound || !flightGroup) continue;

      // Voos sem oferta em milhas (cash-only) são ignorados — o crawler só
      // retorna dados quando "Pagar com Milhas" está marcado, mas a Air
      // Europa às vezes ainda inclui itinerários alternativos sem preço.
      const miles = bound.boundAmount?.milesAmount;
      if (!miles) continue;

      const proposal = proposedFlightsGroup.find((g) => g.proposedBoundId === flightGroup.flightId);
      const segments: any[] = proposal?.segments || [];
      if (!segments.length) continue;

      const firstSeg = segments[0];
      const lastSeg = segments[segments.length - 1];
      const flightCode = segments.map((s) => `${s.airline?.code || ''}${s.flightNumber || ''}`).join(', ');
      const cabin = fareFamilyNames[reco.ffCode] || reco.ffCode || '';

      const flight: ParsedFlight = {
        uid: `${reco.ffCode}-${reco.recoId}`,
        airline: firstSeg.airline?.name || '',
        cabin,
        availableSeats: flightGroup.numberOfSeatsLeft ?? 0,
        stops: segments.length - 1,
        departure: {
          flightCode,
          date: toIso(firstSeg.beginDate),
          airport: firstSeg.beginLocation?.locationCode || '',
          name: firstSeg.beginLocation?.locationName || '',
        },
        arrival: {
          date: toIso(lastSeg.endDate),
          airport: lastSeg.endLocation?.locationCode || '',
          name: lastSeg.endLocation?.locationName || '',
        },
        duration: durationFromSegments(segments),
        miles,
      };

      if (segments.length > 1) {
        flight.legs = segments.map(
          (s): FlightLeg => ({
            flightCode: `${s.airline?.code || ''}${s.flightNumber || ''}`,
            cabin,
            departure: { date: toIso(s.beginDate), airport: s.beginLocation?.locationCode || '' },
            arrival: { date: toIso(s.endDate), airport: s.endLocation?.locationCode || '' },
          }),
        );
      }

      flights.push(flight);
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Air Europa: ${e.message}`);
    return [];
  }

  return flights;
}
