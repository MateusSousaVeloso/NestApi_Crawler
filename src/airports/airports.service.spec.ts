import { AirportsService } from './airports.service';

describe('AirportsService', () => {
  let service: AirportsService;

  beforeEach(() => {
    service = new AirportsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should find airport by exact IATA code', () => {
      const result = service.search('GRU');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].iata).toBe('GRU');
    });

    it('should find airport by IATA code case-insensitive', () => {
      const result = service.search('gru');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].iata).toBe('GRU');
    });

    it('should find airports by city name', () => {
      const result = service.search('São Paulo');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no match', () => {
      const result = service.search('xyznonexistent');
      expect(result).toEqual([]);
    });

    it('should return iata and name fields', () => {
      const result = service.search('GRU');
      expect(result[0]).toHaveProperty('iata');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('searchByState', () => {
    it('should find airports by state', () => {
      const result = service.searchByState('São Paulo');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when state not found', () => {
      const result = service.searchByState('xyznonexistent');
      expect(result).toEqual([]);
    });
  });
});
