import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FlightHistoryController } from './flight-history.controller';
import { FlightHistoryService } from './flight-history.service';

const mockFlightHistoryService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
};

describe('FlightHistoryController', () => {
  let controller: FlightHistoryController;
  let service: typeof mockFlightHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlightHistoryController],
      providers: [
        { provide: FlightHistoryService, useValue: mockFlightHistoryService },
      ],
    }).compile();

    controller = module.get<FlightHistoryController>(FlightHistoryController);
    service = module.get(FlightHistoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return flight history list', async () => {
      const mockResults = [{ id: '1', origin: 'GRU', destination: 'MIA' }];
      service.findAll.mockResolvedValue(mockResults);

      const result = await controller.findAll({});

      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResults);
    });

    it('should pass filters to service', async () => {
      service.findAll.mockResolvedValue([]);

      const filter = { origin: 'GRU', provider: 'Smiles' };
      await controller.findAll(filter);

      expect(service.findAll).toHaveBeenCalledWith(filter);
    });
  });

  describe('findOne', () => {
    it('should return flight details', async () => {
      const mockResult = { id: '1', details: [] };
      service.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException when not found', async () => {
      service.findOne.mockResolvedValue(null);

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
