import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { PrismaService } from '../database/prisma.service';
import { SearchService } from '../search/search.service';
import { WhatsAppService } from './whatsapp.service';

const mockPrisma = {
  userRoutePreference: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockSearchService = {
  searchSmiles: jest.fn(),
};

const mockWhatsAppService = {
  sendMessage: jest.fn(),
};

describe('NotificationSchedulerService', () => {
  let service: NotificationSchedulerService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSchedulerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SearchService, useValue: mockSearchService },
        { provide: WhatsAppService, useValue: mockWhatsAppService },
      ],
    }).compile();

    service = module.get<NotificationSchedulerService>(NotificationSchedulerService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deactivateExpiredRoutes', () => {
    it('should deactivate expired routes', async () => {
      prisma.userRoutePreference.updateMany.mockResolvedValue({ count: 2 });

      await service.deactivateExpiredRoutes();

      expect(prisma.userRoutePreference.updateMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          dateEnd: { lt: expect.any(Date) },
        },
        data: { isActive: false },
      });
    });

    it('should handle no expired routes', async () => {
      prisma.userRoutePreference.updateMany.mockResolvedValue({ count: 0 });

      await service.deactivateExpiredRoutes();

      expect(prisma.userRoutePreference.updateMany).toHaveBeenCalled();
    });
  });

  describe('handleDaily', () => {
    it('should process DAILY routes', async () => {
      prisma.userRoutePreference.findMany.mockResolvedValue([]);

      await service.handleDaily();

      expect(prisma.userRoutePreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            alertFrequency: 'DAILY',
          }),
        }),
      );
    });
  });

  describe('handleEvery6Hours', () => {
    it('should process EVERY_6_HOURS routes', async () => {
      prisma.userRoutePreference.findMany.mockResolvedValue([]);

      await service.handleEvery6Hours();

      expect(prisma.userRoutePreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            alertFrequency: 'EVERY_6_HOURS',
          }),
        }),
      );
    });
  });

  describe('handleEvery12Hours', () => {
    it('should process EVERY_12_HOURS routes', async () => {
      prisma.userRoutePreference.findMany.mockResolvedValue([]);

      await service.handleEvery12Hours();

      expect(prisma.userRoutePreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            alertFrequency: 'EVERY_12_HOURS',
          }),
        }),
      );
    });
  });
});
