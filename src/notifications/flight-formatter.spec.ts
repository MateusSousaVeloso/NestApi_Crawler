import { formatFlightMessage, formatFlightsForDate } from './flight-formatter';

describe('FlightFormatter', () => {
  const directFlight = {
    uid: '123',
    airline: 'GOL',
    cabin: 'ECONOMIC',
    availableSeats: 5,
    stops: 0,
    departure: {
      flightCode: 'G31234',
      date: '2026-03-15T13:00:00Z',
      airport: 'GRU',
    },
    arrival: {
      date: '2026-03-15T21:00:00Z',
      airport: 'MIA',
    },
    duration: { hours: 8, minutes: 0 },
    miles: 30000,
  };

  const connectingFlight = {
    uid: '456',
    airline: 'LATAM',
    cabin: 'BUSINESS',
    availableSeats: 2,
    stops: 1,
    departure: {
      date: '2026-03-15T10:00:00Z',
      airport: 'GRU',
    },
    arrival: {
      date: '2026-03-15T22:00:00Z',
      airport: 'MIA',
    },
    duration: { hours: 12, minutes: 0 },
    miles: 80000,
    legs: [
      {
        flightCode: 'LA8001',
        departure: { date: '2026-03-15T10:00:00Z', airport: 'GRU' },
        arrival: { date: '2026-03-15T16:00:00Z', airport: 'GIG' },
      },
      {
        flightCode: 'LA8002',
        departure: { date: '2026-03-15T17:00:00Z', airport: 'GIG' },
        arrival: { date: '2026-03-15T22:00:00Z', airport: 'MIA' },
      },
    ],
  };

  describe('formatFlightMessage', () => {
    it('should format direct flight correctly', () => {
      const result = formatFlightMessage(directFlight, 1);

      expect(result).toContain('1. *GOL*');
      expect(result).toContain('G31234');
      expect(result).toContain('Econômica');
      expect(result).toContain('Direto');
      expect(result).toContain('30.000');
      expect(result).toContain('GRU');
      expect(result).toContain('MIA');
    });

    it('should format connecting flight correctly', () => {
      const result = formatFlightMessage(connectingFlight, 2);

      expect(result).toContain('2. *LATAM*');
      expect(result).toContain('Executiva');
      expect(result).toContain('Escalas:* 1');
      expect(result).toContain('Trechos:');
      expect(result).toContain('LA8001');
      expect(result).toContain('LA8002');
    });

    it('should show duration', () => {
      const result = formatFlightMessage(directFlight, 1);

      expect(result).toContain('8 horas e 0 minutos');
    });

    it('should show available seats', () => {
      const result = formatFlightMessage(directFlight, 1);

      expect(result).toContain('5');
    });
  });

  describe('formatFlightsForDate', () => {
    it('should format flights for a date', () => {
      const result = formatFlightsForDate(
        '2026-03-15',
        [directFlight],
        'São Paulo (GRU)',
        'Miami (MIA)',
      );

      expect(result).toContain('março');
      expect(result).toContain('São Paulo (GRU)');
      expect(result).toContain('Miami (MIA)');
      expect(result).toContain('GOL');
    });

    it('should handle empty flights', () => {
      const result = formatFlightsForDate(
        '2026-03-15',
        [],
        'São Paulo (GRU)',
        'Miami (MIA)',
      );

      expect(result).toContain('Nenhum voo encontrado');
    });

    it('should handle multiple flights', () => {
      const result = formatFlightsForDate(
        '2026-03-15',
        [directFlight, connectingFlight],
        'São Paulo (GRU)',
        'Miami (MIA)',
      );

      expect(result).toContain('1. *GOL*');
      expect(result).toContain('2. *LATAM*');
    });
  });
});
