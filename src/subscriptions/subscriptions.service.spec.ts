import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../database/prisma.service';

const mockUserId = 'user-uuid-123';
const mockPhoneNumber = '5511949381549';

const mockUser = {
  id: mockUserId,
  name: 'Mateus',
  phone_number: mockPhoneNumber,
  email: 'mateus@gmail.com',
};

const mockPlan = {
  id: 1,
  name: 'Premium Mensal',
  price: 29.9,
  durationDays: 30,
};

const mockSubscription = {
  id: 'sub-uuid-456',
  payment_date: new Date('2026-01-01'),
  end_date: new Date('2026-01-31'),
  status: 'active',
  userPhone: mockPhoneNumber,
  planId: 1,
  plan: { name: 'Premium Mensal', price: 29.9, durationDays: 30 },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  subscriptionPlan: {
    findUnique: jest.fn(),
  },
  userSubscription: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation(async (callback) => {
    return callback(mockPrisma);
  }),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should create a subscription for a user', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userSubscription.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userSubscription.create.mockResolvedValue(mockSubscription);

      const result = await service.subscribe(mockUserId, 1);

      expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUserId } });
      expect(prisma.userSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userPhone: mockPhoneNumber, status: 'active' },
      });
      expect(prisma.userSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userPhone: mockPhoneNumber,
          planId: 1,
          status: 'active',
        }),
        include: {
          plan: { select: { name: true, price: true, durationDays: true } },
        },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundException when plan not found', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(service.subscribe(mockUserId, 999)).rejects.toThrow(NotFoundException);
      await expect(service.subscribe(mockUserId, 999)).rejects.toThrow('Plano não encontrado.');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.subscribe('nonexistent', 1)).rejects.toThrow(NotFoundException);
      await expect(service.subscribe('nonexistent', 1)).rejects.toThrow('Usuário não existe.');
    });
  });

  describe('getMySubscription', () => {
    it('should return active subscription', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userSubscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await service.getMySubscription(mockUserId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUserId } });
      expect(prisma.userSubscription.findFirst).toHaveBeenCalledWith({
        where: {
          userPhone: mockPhoneNumber,
          status: 'active',
          end_date: { gt: expect.any(Date) },
        },
        include: {
          plan: { select: { name: true, price: true, durationDays: true } },
        },
        orderBy: { end_date: 'desc' },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMySubscription('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getMySubscription('nonexistent')).rejects.toThrow('Usuário não existe.');
    });

    it('should throw NotFoundException when no active subscription', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userSubscription.findFirst.mockResolvedValue(null);

      await expect(service.getMySubscription(mockUserId)).rejects.toThrow(NotFoundException);
      await expect(service.getMySubscription(mockUserId)).rejects.toThrow('Nenhuma assinatura ativa encontrada.');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userSubscription.findFirst.mockResolvedValue(mockSubscription);
      prisma.userSubscription.update.mockResolvedValue({ ...mockSubscription, status: 'cancelled' });

      const result = await service.cancelSubscription(mockUserId);

      expect(prisma.userSubscription.findFirst).toHaveBeenCalledWith({
        where: { userPhone: mockPhoneNumber, status: 'active' },
      });
      expect(prisma.userSubscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: { status: 'cancelled' },
      });
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.cancelSubscription('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.cancelSubscription('nonexistent')).rejects.toThrow('Usuário não existe.');
    });

    it('should throw NotFoundException when no active subscription to cancel', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userSubscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(NotFoundException);
      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow('Nenhuma assinatura ativa para cancelar.');
    });
  });
});
