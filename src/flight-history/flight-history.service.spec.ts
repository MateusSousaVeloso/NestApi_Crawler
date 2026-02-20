import { Test, TestingModule } from '@nestjs/testing';
import { FlightHistoryService } from './flight-history.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  flightSearchResult: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  flightSearchDetail: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('FlightHistoryService', () => {
  let service: FlightHistoryService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightHistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FlightHistoryService>(FlightHistoryService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all results with no filters', async () => {
      const mockResults = [{ id: '1', origin: 'GRU', destination: 'MIA' }];
      prisma.flightSearchResult.findMany.mockResolvedValue(mockResults);

      const result = await service.findAll({});

      expect(prisma.flightSearchResult.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ flightDate: 'asc' }, { searchedAt: 'desc' }],
        include: { _count: { select: { details: true } } },
      });
      expect(result).toEqual(mockResults);
    });

    it('should filter by origin', async () => {
      prisma.flightSearchResult.findMany.mockResolvedValue([]);

      await service.findAll({ origin: 'gru' });

      expect(prisma.flightSearchResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ origin: 'GRU' }),
        }),
      );
    });

    it('should filter by destination', async () => {
      prisma.flightSearchResult.findMany.mockResolvedValue([]);

      await service.findAll({ destination: 'mia' });

      expect(prisma.flightSearchResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ destination: 'MIA' }),
        }),
      );
    });

    it('should filter by provider', async () => {
      prisma.flightSearchResult.findMany.mockResolvedValue([]);

      await service.findAll({ provider: 'Smiles' });

      expect(prisma.flightSearchResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ provider: 'Smiles' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      prisma.flightSearchResult.findMany.mockResolvedValue([]);

      await service.findAll({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });

      expect(prisma.flightSearchResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            flightDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single result with details', async () => {
      const mockResult = { id: '1', details: [] };
      prisma.flightSearchResult.findUnique.mockResolvedValue(mockResult);

      const result = await service.findOne('1');

      expect(prisma.flightSearchResult.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          details: { orderBy: [{ cabin: 'asc' }, { miles: 'asc' }] },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should return null when not found', async () => {
      prisma.flightSearchResult.findUnique.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('saveSearchResults', () => {
    it('should not save when flights array is empty', async () => {
      await service.saveSearchResults('GRU', 'MIA', '2026-01-01', 'Smiles', []);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should not save when flights is null', async () => {
      await service.saveSearchResults('GRU', 'MIA', '2026-01-01', 'Smiles', null as any);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should save flights via transaction', async () => {
      const mockFlights = [
        {
          uid: '123',
          airline: 'GOL',
          cabin: 'ECONOMIC',
          availableSeats: 5,
          stops: 0,
          departure: { flightCode: 'G31234', date: '2026-01-01T10:00:00', airport: 'GRU' },
          arrival: { date: '2026-01-01T18:00:00', airport: 'MIA' },
          duration: { hours: 8, minutes: 0 },
          miles: 30000,
        },
      ];

      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          flightSearchDetail: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          flightSearchResult: { upsert: jest.fn().mockResolvedValue({ id: '1' }) },
        });
      });

      await service.saveSearchResults('GRU', 'MIA', '2026-01-01', 'Smiles', mockFlights);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
