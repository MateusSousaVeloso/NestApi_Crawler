import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoutePreferencesService } from './route-preferences.service';
import { PrismaService } from '../database/prisma.service';

const mockUserId = 'user-uuid-123';
const mockRouteId = 'route-uuid-456';

const mockRoute = {
  id: mockRouteId,
  originCity: 'São Paulo',
  originIata: 'GRU',
  destinationCity: 'Miami',
  destinationIata: 'MIA',
  cabinType: 'BUSINESS',
  alertFrequency: 'EVERY_6_HOURS',
  isActive: true,
  userId: mockUserId,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrismaService = {
  userRoutePreference: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('RoutePreferencesService', () => {
  let service: RoutePreferencesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutePreferencesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RoutePreferencesService>(RoutePreferencesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      originCity: 'São Paulo',
      originIata: 'GRU',
      destinationCity: 'Miami',
      destinationIata: 'MIA',
      cabinType: 'BUSINESS' as const,
      alertFrequency: 'EVERY_6_HOURS' as const,
    };

    it('should create a route preference', async () => {
      prisma.userRoutePreference.create.mockResolvedValue(mockRoute);

      const result = await service.create(mockUserId, createDto);

      expect(prisma.userRoutePreference.create).toHaveBeenCalledWith({
        data: { ...createDto, userId: mockUserId },
      });
      expect(result).toEqual(mockRoute);
    });
  });

  describe('findAll', () => {
    it('should return all routes for a user', async () => {
      const routes = [mockRoute, { ...mockRoute, id: 'route-2', destinationIata: 'LIS' }];
      prisma.userRoutePreference.findMany.mockResolvedValue(routes);

      const result = await service.findAll(mockUserId);

      expect(prisma.userRoutePreference.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(routes);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no routes', async () => {
      prisma.userRoutePreference.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single route', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(mockRoute);

      const result = await service.findOne(mockUserId, mockRouteId);

      expect(prisma.userRoutePreference.findFirst).toHaveBeenCalledWith({
        where: { id: mockRouteId, userId: mockUserId },
      });
      expect(result).toEqual(mockRoute);
    });

    it('should throw NotFoundException when route does not exist', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, 'nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne(mockUserId, 'nonexistent')).rejects.toThrow('Rota não encontrada.');
    });
  });

  describe('update', () => {
    const updateDto = { destinationCity: 'Lisboa', destinationIata: 'LIS' };
    const updatedRoute = { ...mockRoute, ...updateDto };

    it('should update a route preference', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(mockRoute);
      prisma.userRoutePreference.update.mockResolvedValue(updatedRoute);

      const result = await service.update(mockUserId, mockRouteId, updateDto);

      expect(prisma.userRoutePreference.findFirst).toHaveBeenCalledWith({
        where: { id: mockRouteId, userId: mockUserId },
      });
      expect(prisma.userRoutePreference.update).toHaveBeenCalledWith({
        where: { id: mockRouteId },
        data: updateDto,
      });
      expect(result).toEqual(updatedRoute);
    });

    it('should throw NotFoundException when updating non-existent route', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(null);

      await expect(service.update(mockUserId, 'nonexistent', updateDto)).rejects.toThrow(NotFoundException);
      expect(prisma.userRoutePreference.update).not.toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('should toggle route to inactive', async () => {
      const toggledRoute = { ...mockRoute, isActive: false };
      prisma.userRoutePreference.findFirst.mockResolvedValue(mockRoute);
      prisma.userRoutePreference.update.mockResolvedValue(toggledRoute);

      const result = await service.toggle(mockUserId, mockRouteId, false);

      expect(prisma.userRoutePreference.update).toHaveBeenCalledWith({
        where: { id: mockRouteId },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should toggle route to active', async () => {
      const inactiveRoute = { ...mockRoute, isActive: false };
      const activatedRoute = { ...mockRoute, isActive: true };
      prisma.userRoutePreference.findFirst.mockResolvedValue(inactiveRoute);
      prisma.userRoutePreference.update.mockResolvedValue(activatedRoute);

      const result = await service.toggle(mockUserId, mockRouteId, true);

      expect(prisma.userRoutePreference.update).toHaveBeenCalledWith({
        where: { id: mockRouteId },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException when toggling non-existent route', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(null);

      await expect(service.toggle(mockUserId, 'nonexistent', true)).rejects.toThrow(NotFoundException);
      expect(prisma.userRoutePreference.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a route preference', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(mockRoute);
      prisma.userRoutePreference.delete.mockResolvedValue(mockRoute);

      const result = await service.remove(mockUserId, mockRouteId);

      expect(prisma.userRoutePreference.findFirst).toHaveBeenCalledWith({
        where: { id: mockRouteId, userId: mockUserId },
      });
      expect(prisma.userRoutePreference.delete).toHaveBeenCalledWith({
        where: { id: mockRouteId },
      });
      expect(result).toEqual(mockRoute);
    });

    it('should throw NotFoundException when deleting non-existent route', async () => {
      prisma.userRoutePreference.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockUserId, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.userRoutePreference.delete).not.toHaveBeenCalled();
    });
  });
});
