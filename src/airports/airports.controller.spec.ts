import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AirportsController } from './airports.controller';
import { AirportsService } from './airports.service';

const mockAirportsService = {
  search: jest.fn(),
  searchByState: jest.fn(),
};

describe('AirportsController', () => {
  let controller: AirportsController;
  let service: typeof mockAirportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirportsController],
      providers: [
        { provide: AirportsService, useValue: mockAirportsService },
      ],
    }).compile();

    controller = module.get<AirportsController>(AirportsController);
    service = module.get(AirportsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call search when search param is provided', () => {
    const mockResult = [{ iata: 'GRU', name: 'Guarulhos' }];
    service.search.mockReturnValue(mockResult);

    const result = controller.search('GRU', undefined);

    expect(service.search).toHaveBeenCalledWith('GRU');
    expect(result).toEqual(mockResult);
  });

  it('should call searchByState when state param is provided', () => {
    const mockResult = [{ iata: 'GRU', name: 'Guarulhos' }];
    service.searchByState.mockReturnValue(mockResult);

    const result = controller.search(undefined, 'São Paulo');

    expect(service.searchByState).toHaveBeenCalledWith('São Paulo');
    expect(result).toEqual(mockResult);
  });

  it('should throw BadRequestException when no params provided', () => {
    expect(() => controller.search(undefined, undefined)).toThrow(BadRequestException);
  });

  it('should prioritize search over state when both provided', () => {
    const mockResult = [{ iata: 'GRU', name: 'Guarulhos' }];
    service.search.mockReturnValue(mockResult);

    controller.search('GRU', 'São Paulo');

    expect(service.search).toHaveBeenCalledWith('GRU');
    expect(service.searchByState).not.toHaveBeenCalled();
  });
});
