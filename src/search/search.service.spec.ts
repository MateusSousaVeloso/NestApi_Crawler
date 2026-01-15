import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('SearchService', () => {
  let service: SearchService;
  let httpService: HttpService;

  // Mock do HttpService
  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should dispatch search to crawler and return results', async () => {
    // Simula resposta do crawler (se você usasse Observables do axios)
    mockHttpService.post.mockReturnValue(of({ data: { status: 'queued' } }));

    const dto: any = {
      user_id: '123',
      search_params: {
        origin: 'GRU',
        destination: 'LIS',
        dates: { departure_date: '2026-05-20' },
        preferences: { programs: ['smiles'] },
      },
    };

    const result = await service.dispatchSearch(dto);

    // Verifica estrutura de retorno mockada no service
    expect(result.status).toBe('success');
    expect(result.results.cheapest_option.airline).toBe('TAP');
    // Verifica se os parâmetros foram extraídos corretamente para o job
    expect(result.execution_id).toBeDefined();
  });
});