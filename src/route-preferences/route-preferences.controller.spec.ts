import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoutePreferencesController } from './route-preferences.controller';
import { RoutePreferencesService } from './route-preferences.service';

const mockUserId = 'user-uuid-123';
const mockRouteId = 'route-uuid-456';

const mockReq = { user: { id: mockUserId } };

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

const mockRoutePreferencesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  toggle: jest.fn(),
  remove: jest.fn(),
};

describe('RoutePreferencesController', () => {
  let controller: RoutePreferencesController;
  let service: typeof mockRoutePreferencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutePreferencesController],
      providers: [
        { provide: RoutePreferencesService, useValue: mockRoutePreferencesService },
      ],
    }).compile();

    controller = module.get<RoutePreferencesController>(RoutePreferencesController);
    service = module.get(RoutePreferencesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
      service.create.mockResolvedValue(mockRoute);

      const result = await controller.create(mockReq, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUserId, createDto);
      expect(result).toEqual(mockRoute);
    });
  });

  describe('findAll', () => {
    it('should return all routes for the authenticated user', async () => {
      const routes = [mockRoute, { ...mockRoute, id: 'route-2' }];
      service.findAll.mockResolvedValue(routes);

      const result = await controller.findAll(mockReq);

      expect(service.findAll).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(routes);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no routes exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockReq);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single route', async () => {
      service.findOne.mockResolvedValue(mockRoute);

      const result = await controller.findOne(mockReq, mockRouteId);

      expect(service.findOne).toHaveBeenCalledWith(mockUserId, mockRouteId);
      expect(result).toEqual(mockRoute);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Rota não encontrada.'));

      await expect(controller.findOne(mockReq, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { destinationCity: 'Lisboa', destinationIata: 'LIS' };
    const updatedRoute = { ...mockRoute, ...updateDto };

    it('should update a route preference', async () => {
      service.update.mockResolvedValue(updatedRoute);

      const result = await controller.update(mockReq, mockRouteId, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockUserId, mockRouteId, updateDto);
      expect(result.destinationCity).toBe('Lisboa');
      expect(result.destinationIata).toBe('LIS');
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(new NotFoundException('Rota não encontrada.'));

      await expect(controller.update(mockReq, 'nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggle', () => {
    it('should toggle route to inactive', async () => {
      const toggledRoute = { ...mockRoute, isActive: false };
      service.toggle.mockResolvedValue(toggledRoute);

      const result = await controller.toggle(mockReq, mockRouteId, { isActive: false });

      expect(service.toggle).toHaveBeenCalledWith(mockUserId, mockRouteId, false);
      expect(result.isActive).toBe(false);
    });

    it('should toggle route to active', async () => {
      service.toggle.mockResolvedValue(mockRoute);

      const result = await controller.toggle(mockReq, mockRouteId, { isActive: true });

      expect(service.toggle).toHaveBeenCalledWith(mockUserId, mockRouteId, true);
      expect(result.isActive).toBe(true);
    });

    it('should propagate NotFoundException from service', async () => {
      service.toggle.mockRejectedValue(new NotFoundException('Rota não encontrada.'));

      await expect(controller.toggle(mockReq, 'nonexistent', { isActive: true })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a route preference', async () => {
      service.remove.mockResolvedValue(mockRoute);

      const result = await controller.remove(mockReq, mockRouteId);

      expect(service.remove).toHaveBeenCalledWith(mockUserId, mockRouteId);
      expect(result).toEqual(mockRoute);
    });

    it('should propagate NotFoundException from service', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Rota não encontrada.'));

      await expect(controller.remove(mockReq, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
