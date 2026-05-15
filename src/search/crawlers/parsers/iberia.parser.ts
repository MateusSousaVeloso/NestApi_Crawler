import { ParsedFlight } from '../../search.interfaces';

export function parseIberiaResponse(data: any): ParsedFlight[] {
  if (!data) return [];

  // sliceId → {slice, od} para cruzar dados de voo com preços das offers
  const sliceLookup = new Map<string, { slice: any; od: any }>();
  for (const od of data.originDestinations || []) {
    for (const sl of od.slices || []) {
      sliceLookup.set(sl.sliceId, { slice: sl, od });
    }
  }

  const flights: ParsedFlight[] = [];

  try {
    for (const offer of data.offers || []) {
      const price = offer.price || {};

      for (const odOffer of offer.originDestinations || []) {
        for (const applicableSlice of odOffer.applicableSlices || []) {
          const sliceId = applicableSlice.sliceId;
          const entry = sliceLookup.get(sliceId);
          if (!entry) continue;
          const sliceObj = entry.slice;

          const fareSegs = applicableSlice.segments || [];
          const cabin = fareSegs[0]?.bookingClass || '';

          for (const seg of sliceObj.segments || []) {
            const flightInfo = seg.flight || {};
            const marketing = flightInfo.marketingCarrier || {};
            const flightNumber = flightInfo.marketingFlightNumber || '';
            const code = marketing.code || '';

            flights.push({
              uid: `${code}${flightNumber}`,
              airline: marketing.name || 'Iberia',
              cabin,
              availableSeats: 0,
              stops: sliceObj.stopsNumber ?? 0,
              departure: {
                flightCode: `${code}${flightNumber}`,
                date: seg.departureDateTime || '',
                airport: seg.departureAirport || '',
                name: '',
              },
              arrival: {
                date: seg.arrivalDateTime || '',
                airport: seg.arrivalAirport || '',
                name: '',
              },
              duration: { hours: 0, minutes: 0 },
              price: Number(price.total ?? 0) || undefined,
              currency: price.currency || 'BRL',
            });
          }
        }
      }
    }
  } catch (e: any) {
    console.error(`Erro ao parsear resposta Iberia: ${e.message}`);
    return [];
  }

  return flights;
}
