import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../database/prisma.service';

const mockPrismaService = {
  history: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe('HistoryService', () => {
  let service: HistoryService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    prisma = module.get(PrismaService);
  });

  it('should retrieve history', async () => {
    const mockHistory = [{ role: 'user', content: 'Oi' }];
    prisma.history.findMany.mockResolvedValue(mockHistory);

    const result = await service.getHistory('user-1', 10);
    
    expect(prisma.history.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'user-1' },
        take: 10
    }));
    expect(result).toBe(mockHistory);
  });

  it('should log a message', async () => {
    const dto = { user_id: '1', role: 'user', content: 'Olá' };
    await service.logMessage(dto);

    expect(prisma.history.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: dto.user_id,
        content: dto.content
      })
    });
  });
});