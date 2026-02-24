const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatDateExtended(dateStr: string): string {
  const date = new Date(dateStr);
  const weekday = WEEKDAYS_PT[date.getUTCDay()];
  const day = date.getUTCDate();
  const month = MONTHS_PT[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${weekday}, ${day} de ${month} de ${year}`;
}

function extractTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatMiles(miles: number): string {
  return miles.toLocaleString('pt-BR');
}

function formatCabin(cabin: string): string {
  const map: Record<string, string> = {
    ECONOMIC: 'Econômica',
    BUSINESS: 'Executiva',
    FIRST: 'Primeira Classe',
    ALL: 'Todas',
  };
  return map[cabin?.toUpperCase()] || cabin || 'N/A';
}

function formatLegDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

export function formatFlightMessage(flight: any, index: number): string {
  const isDirect = flight.stops === 0;
  const durationHours = flight.duration?.hours || 0;
  const durationMinutes = flight.duration?.minutes || 0;

  const departureDate = formatDateExtended(flight.departure.date);
  const departureTime = extractTime(flight.departure.date);
  const arrivalDate = formatDateExtended(flight.arrival.date);
  const arrivalTime = extractTime(flight.arrival.date);
  const miles = formatMiles(flight.miles);
  const cabin = formatCabin(flight.cabin);

  if (isDirect) {
    return [
      `${index}. *${flight.airline}* — ${flight.departure.flightCode || 'N/A'}`,
      `   - *Classe:* ${cabin}`,
      `   - *Partida:* ${departureDate}, ${departureTime} (${flight.departure.airport})`,
      `   - *Chegada:* ${arrivalDate}, ${arrivalTime} (${flight.arrival.airport})`,
      `   - *Duração:* ${durationHours} horas e ${durationMinutes} minutos`,
      `   - *Escalas:* Direto`,
      `   - *Assentos Disponíveis*: ${flight.availableSeats}`,
      `   - *Milhas:* ${miles}`,
    ].join('\n');
  }

  const legs = (flight.legs || [])
    .map((leg: any) => {
      const legDepTime = extractTime(leg.departure.date);
      const legArrTime = extractTime(leg.arrival.date);
      const legDate = formatLegDate(leg.departure.date);
      return `     - ${leg.flightCode}: ${legDate}, ${legDepTime} (${leg.departure.airport}) → ${legArrTime} (${leg.arrival.airport})`;
    })
    .join('\n');

  return [
    `${index}. *${flight.airline}*`,
    `   - *Classe:* ${cabin}`,
    `   - *Partida:* ${departureDate}, ${departureTime} (${flight.departure.airport})`,
    `   - *Chegada:* ${arrivalDate}, ${arrivalTime} (${flight.arrival.airport})`,
    `   - *Duração:* ${durationHours} horas e ${durationMinutes} minutos`,
    `   - *Escalas:* ${flight.stops}`,
    `   - *Trechos:*`,
    legs,
    `   - *Assentos Disponíveis*: ${flight.availableSeats}`,
    `   - *Milhas:* ${miles}`,
  ].join('\n');
}

export function formatFlightsForDate(date: string, flights: any[], origin: string, destination: string): string {
  if (!flights || flights.length === 0) {
    return `📅 *${formatDateExtended(date + 'T12:00:00Z')}*\n${origin} → ${destination}\n\nNenhum voo encontrado para esta data.`;
  }

  if ('error' in flights) {
    return `📅 *${formatDateExtended(date + 'T12:00:00Z')}*\n${origin} → ${destination}\n\nErro ao buscar voos: ${(flights as any).error}`;
  }

  const firstFlight = flights[0];
  const depEpoch = String(new Date(firstFlight.departure.date).getTime());
  const params = new URLSearchParams({
    adults: '1',
    cabin: firstFlight.cabin || 'ALL',
    children: '0',
    departureDate: depEpoch,
    infants: '0',
    isElegible: 'false',
    isFlexibleDateChecked: 'false',
    returnDate: '',
    searchType: 'g3',
    segments: '1',
    tripType: '2',
    originAirport: firstFlight.departure.airport,
    originCity: '',
    originCountry: '',
    originAirportIsAny: 'false',
    destinationAirport: firstFlight.arrival.airport,
    destinCity: '',
    destinCountry: '',
    destinAirportIsAny: 'false',
    'novo-resultado-voos': 'true',
  });
  const url = `Veja todos os voos em:\nhttps://www.smiles.com.br/mfe/emissao-passagem/?${params.toString()}`;

  const header = `📅 *${formatDateExtended(date + 'T12:00:00Z')}*\n✈️ ${origin} → ${destination}\n`;
  const flightMessages = flights.map((flight, i) => formatFlightMessage(flight, i + 1)).join('\n\n');

  return `${header}\n${flightMessages}\n\n🔗 ${url}`;
}