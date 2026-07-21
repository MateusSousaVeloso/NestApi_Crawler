import { ParsedFlight, FlightLeg } from '../../search.interfaces';

export function parseSmilesResponse(data: any): ParsedFlight[] {
  if (!data || !data.requestedFlightSegmentList) return [];

  const rawFlights: any[] = [];
  for (const segment of data.requestedFlightSegmentList || []) {
    rawFlights.push(...(segment.flightList || []));
  }

  return rawFlights.map((flight) => {
    const fareList: any[] = flight.fareList || [];
    const defaultFare = fareList[0] || {};

    const rawMiles = defaultFare.miles || 0;
    const miles = rawMiles || undefined;

    const dep = flight.departure || {};
    const arr = flight.arrival || {};
    const depAirportCode = dep.airport?.code || '';
    const arrAirportCode = arr.airport?.code || '';

    const duration = flight.duration || {};
    const durHours = duration.hours ?? 0;
    const durMinutes = duration.minutes ?? 0;

    const legList: any[] = flight.legList || [];
    const stops = flight.stops ?? 0;
    const isDirect = stops === 0;

    let flightCode: string | undefined;
    let legs: FlightLeg[] | undefined;

    if (legList.length > 1) {
      const codes = legList
        .map((leg) => {
          const code = leg.operationAirline?.code || leg.marketingAirline?.code || '';
          return `${code}${leg.flightNumber || ''}`.trim();
        })
        .filter(Boolean);
      flightCode = codes.join(', ') || undefined;

      legs = legList.map((leg) => {
        const legCabinRaw = leg.cabin;
        const cabin = legCabinRaw === 'COMFORT' ? 'PREMIUM_ECONOMIC' : legCabinRaw;
        const legCode =
          (leg.operationAirline?.code || leg.marketingAirline?.code || '') +
          (leg.flightNumber || '');
        return {
          flightCode: legCode.trim(),
          cabin,
          airline: leg.operationAirline?.name || leg.marketingAirline?.name,
          departure: {
            date: leg.departure?.date || '',
            airport: leg.departure?.airport?.code || '',
          },
          arrival: {
            date: leg.arrival?.date || '',
            airport: leg.arrival?.airport?.code || '',
          },
        } as FlightLeg;
      });
      legs.sort((a, b) => (a.arrival.date || '').localeCompare(b.arrival.date || ''));
    } else {
      const firstLeg = legList[0];
      const airlineCode =
        firstLeg?.operationAirline?.code ||
        firstLeg?.marketingAirline?.code ||
        flight.airline?.code ||
        '';
      const flightNumber = firstLeg?.flightNumber || flight.flightNumber || '';
      flightCode = `${airlineCode}${flightNumber}`.trim() || undefined;
    }

    const cabinRaw = flight.cabin;
    const cabin = cabinRaw === 'COMFORT' ? 'PREMIUM_ECONOMIC' : cabinRaw;

    const parsed: ParsedFlight = {
      uid: flight.uid,
      airline: flight.airline?.name,
      cabin,
      availableSeats: flight.availableSeats ?? 0,
      stops,
      departure: {
        ...(isDirect && flightCode ? { flightCode } : {}),
        date: dep.date || '',
        airport: depAirportCode,
        name: dep.airport?.name || '',
      },
      arrival: {
        date: arr.date || '',
        airport: arrAirportCode,
        name: arr.airport?.name || '',
      },
      duration: { hours: durHours, minutes: durMinutes },
      miles,
    };

    if (legs) parsed.legs = legs;
    return parsed;
  });
}
