import { ParsedFlight, FlightLeg } from '../../search.interfaces';

export function parseIberiaResponse(data: any): ParsedFlight[] {
  if (!data || typeof data !== 'object') return [];

  const flights: ParsedFlight[] = [];
  const seen = new Set<string>();

  try {
    for (const od of data.originDestinations || []) {
      for (const slice of od.slices || []) {
        const uid = `IB-${slice.sliceId}`;
        if (seen.has(uid)) continue;
        seen.add(uid);

        const segs: any[] = slice.segments || [];
        if (!segs.length) continue;

        const firstSeg = segs[0];
        const lastSeg  = segs[segs.length - 1];

        const cabin: string = firstSeg.offers?.[0]?.bookingClass ?? '';
        const availableSeats: number = firstSeg.offers?.[0]?.remainingSeats ?? 0;

        const flightCode = segs
          .map((s: any) => `${s.flight?.marketingCarrier?.code ?? ''}${s.flight?.marketingFlightNumber ?? ''}`)
          .join(', ');

        const legs: FlightLeg[] = segs.map((s: any) => ({
          flightCode: `${s.flight?.marketingCarrier?.code ?? ''}${s.flight?.marketingFlightNumber ?? ''}`,
          cabin,
          aircraft: s.flight?.aircraft?.description ?? '',
          departure: {
            date:    s.departureDateTime ?? '',
            airport: s.departure?.airport?.code ?? '',
          },
          arrival: {
            date:    s.arrivalDateTime ?? '',
            airport: s.arrival?.airport?.code ?? '',
          },
        }));

        const durationMin: number = slice.duration ?? 0;

        flights.push({
          uid,
          airline: firstSeg.flight?.marketingCarrier?.name ?? 'Iberia',
          cabin,
          availableSeats,
          stops: slice.stopsNumber ?? (segs.length - 1),
          departure: {
            flightCode,
            date:    slice.departureDateTime ?? firstSeg.departureDateTime ?? '',
            airport: firstSeg.departure?.airport?.code ?? '',
            name:    firstSeg.departure?.city?.description ?? '',
          },
          arrival: {
            date:    slice.arrivalDateTime ?? lastSeg.arrivalDateTime ?? '',
            airport: lastSeg.arrival?.airport?.code ?? '',
            name:    lastSeg.arrival?.city?.description ?? '',
          },
          duration: {
            hours:   Math.floor(durationMin / 60),
            minutes: durationMin % 60,
          },
          currency: 'BRL',
          legs,
        });
      }
    }
  } catch (e: any) {
    console.error(`[IberiaParser] Erro: ${e.message}`);
  }

  return flights;
}
