import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

const mockSearchService = {
  searchSmiles: jest.fn(),
  searchAzul: jest.fn(),
};

describe('SearchController', () => {
  let controller: SearchController;
  let service: typeof mockSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get(SearchService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchSmiles', () => {
    const smilesDto = {
      origin: 'GRU',
      destination: 'MIA',
      departureDate: '2026-03-19',
      adults: 1,
      children: 0,
      infants: 0,
    };

    it('should return Smiles search results', async () => {
      const mockResult = { flights: [{ id: 1, price: 30000 }] };
      service.searchSmiles.mockResolvedValue(mockResult);

      const result = await controller.searchSmiles(smilesDto);

      expect(service.searchSmiles).toHaveBeenCalledWith(smilesDto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate HttpException from service', async () => {
      service.searchSmiles.mockRejectedValue(new HttpException('Falha na requisição Smiles', 502));

      await expect(controller.searchSmiles(smilesDto)).rejects.toThrow(HttpException);
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

    it('should return Azul search results', async () => {
      const mockResult = {
        provider: 'azul',
        searchParams: { origin: 'GRU', destination: 'VCP' },
        data: { trips: [] },
      };
      service.searchAzul.mockResolvedValue(mockResult);

      const result = await controller.searchAzul(azulDto);

      expect(service.searchAzul).toHaveBeenCalledWith(azulDto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate HttpException from service', async () => {
      service.searchAzul.mockRejectedValue(new HttpException('Falha ao buscar voos na azul', 502));

      await expect(controller.searchAzul(azulDto)).rejects.toThrow(HttpException);
    });
  });
});
