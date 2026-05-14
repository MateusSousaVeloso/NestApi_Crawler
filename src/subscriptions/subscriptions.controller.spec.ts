import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

const mockUserId = 'user-uuid-123';
const mockReq = { user: { id: mockUserId } };

const mockSubscription = {
  id: 'sub-uuid-456',
  payment_date: new Date('2026-01-01'),
  end_date: new Date('2026-01-31'),
  status: 'active',
  userPhone: '5511949381549',
  planId: 1,
  plan: { name: 'Premium Mensal', price: 29.9, durationDays: 30 },
};

const mockSubscriptionsService = {
  subscribe: jest.fn(),
  getMySubscription: jest.fn(),
  cancelSubscription: jest.fn(),
};

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: typeof mockSubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    service = module.get(SubscriptionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('subscribe', () => {
    it('should subscribe user to a plan', async () => {
      service.subscribe.mockResolvedValue(mockSubscription);

      const result = await controller.subscribe(mockReq, { planId: 1 });

      expect(service.subscribe).toHaveBeenCalledWith(mockUserId, 1);
      expect(result).toEqual(mockSubscription);
    });

    it('should propagate NotFoundException when plan not found', async () => {
      service.subscribe.mockRejectedValue(new NotFoundException('Plano não encontrado.'));

      await expect(controller.subscribe(mockReq, { planId: 999 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMySubscription', () => {
    it('should return active subscription', async () => {
      service.getMySubscription.mockResolvedValue(mockSubscription);

      const result = await controller.getMySubscription(mockReq);

      expect(service.getMySubscription).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockSubscription);
    });

    it('should propagate NotFoundException when no active subscription', async () => {
      service.getMySubscription.mockRejectedValue(new NotFoundException('Nenhuma assinatura ativa encontrada.'));

      await expect(controller.getMySubscription(mockReq)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel the active subscription', async () => {
      const cancelledSub = { ...mockSubscription, status: 'cancelled' };
      service.cancelSubscription.mockResolvedValue(cancelledSub);

      const result = await controller.cancel(mockReq);

      expect(service.cancelSubscription).toHaveBeenCalledWith(mockUserId);
      expect(result.status).toBe('cancelled');
    });

    it('should propagate NotFoundException when no subscription to cancel', async () => {
      service.cancelSubscription.mockRejectedValue(new NotFoundException('Nenhuma assinatura ativa para cancelar.'));

      await expect(controller.cancel(mockReq)).rejects.toThrow(NotFoundException);
    });
  });
});
