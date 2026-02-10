import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service';
import { CrawlerService } from './crawler.service';

jest.mock('cuimp', () => ({
  request: jest.fn(),
}));

import { request } from 'cuimp';

const mockCrawlerService = {
  getAzulCredentials: jest.fn(),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: CrawlerService, useValue: mockCrawlerService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    // Inject crawlerService since it's initialized as a private readonly field
    (service as any).crawlerService = mockCrawlerService;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchSmiles', () => {
    const smilesDto = {
      origin: 'GRU',
      destination: 'MIA',
      departureDate: '2026-03-19',
      adults: 1,
      children: 0,
      infants: 0,
      cabin: 'ALL' as const,
    };

    it('should return flight data on success', async () => {
      const mockResponse = {
        status: 200,
        data: { flights: [{ id: 1, price: 30000 }] },
      };
      (request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.searchSmiles(smilesDto);

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('api-air-flightsearch-green.smiles.com.br'),
          method: 'GET',
        }),
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw HttpException on request failure', async () => {
      (request as jest.Mock).mockRejectedValue({
        message: 'Network error',
        data: null,
      });

      await expect(service.searchSmiles(smilesDto)).rejects.toThrow(HttpException);

      try {
        await service.searchSmiles(smilesDto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      }
    });

    it('should include correct query parameters', async () => {
      (request as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      await service.searchSmiles(smilesDto);

      const calledUrl = (request as jest.Mock).mock.calls[0][0].url;
      expect(calledUrl).toContain('originAirportCode=GRU');
      expect(calledUrl).toContain('destinationAirportCode=MIA');
      expect(calledUrl).toContain('departureDate=2026-03-19');
      expect(calledUrl).toContain('adults=1');
      expect(calledUrl).toContain('cabin=ALL');
    });
  });

  describe('searchAzul', () => {
    const azulDto = {
      origin: 'GRU',
      destination: 'VCP',
      departureDate: '2026-03-19',
      adults: 1,
      children: 0,
      infants: 0,
      flexDaysLeft: 3,
      flexDaysRight: 3,
    };

    const mockCredentials = {
      bearerToken: 'mock-bearer',
      subscriptionKey: 'mock-key',
      cookies: 'mock-cookies',
    };

    it('should return formatted Azul flight data on success', async () => {
      mockCrawlerService.getAzulCredentials.mockResolvedValue(mockCredentials);
      (request as jest.Mock).mockResolvedValue({
        status: 200,
        data: { trips: [{ origin: 'GRU', destination: 'VCP' }] },
      });

      const result = await service.searchAzul(azulDto);

      expect(mockCrawlerService.getAzulCredentials).toHaveBeenCalled();
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('voeazul.com.br'),
          data: expect.objectContaining({
            criteria: expect.arrayContaining([
              expect.objectContaining({
                departureStation: 'GRU',
                arrivalStation: 'VCP',
              }),
            ]),
          }),
        }),
      );
      expect(result).toEqual({
        provider: 'azul',
        searchParams: {
          origin: 'GRU',
          destination: 'VCP',
          departureDate: '2026-03-19',
          passengers: { adults: 1, children: 0, infants: 0 },
        },
        data: { trips: [{ origin: 'GRU', destination: 'VCP' }] },
      });
    });

    it('should format date correctly for Azul API', async () => {
      mockCrawlerService.getAzulCredentials.mockResolvedValue(mockCredentials);
      (request as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      await service.searchAzul(azulDto);

      const payload = (request as jest.Mock).mock.calls[0][0].data;
      expect(payload.criteria[0].std).toBe('03/19/2026');
    });

    it('should include child and infant passengers when present', async () => {
      mockCrawlerService.getAzulCredentials.mockResolvedValue(mockCredentials);
      (request as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      await service.searchAzul({ ...azulDto, children: 1, infants: 1 });

      const payload = (request as jest.Mock).mock.calls[0][0].data;
      expect(payload.passengers).toHaveLength(3);
      expect(payload.passengers[1]).toEqual({ type: 'CHD', count: '1', companionPass: false });
      expect(payload.passengers[2]).toEqual({ type: 'INF', count: '1', companionPass: false });
    });

    it('should throw HttpException on Azul API failure', async () => {
      mockCrawlerService.getAzulCredentials.mockResolvedValue(mockCredentials);
      (request as jest.Mock).mockRejectedValue({ message: 'Connection refused' });

      await expect(service.searchAzul(azulDto)).rejects.toThrow(HttpException);
    });
  });
});
