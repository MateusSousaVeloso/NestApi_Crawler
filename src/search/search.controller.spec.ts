import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  const mockSearchService = {
    dispatchSearch: jest.fn(() => Promise.resolve({ status: 'success' })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  it('should dispatch a search request', async () => {
    const dto: any = { user_id: '123' };
    await controller.dispatch(dto);
    expect(service.dispatchSearch).toHaveBeenCalledWith(dto);
  });
});