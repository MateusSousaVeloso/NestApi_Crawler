import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async subscribe(userId: string, planId: number) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não existe.');

    await this.prisma.userSubscription.deleteMany({
      where: { userId, status: 'active' },
    });

    const paymentDate = new Date();
    const endDate = new Date(paymentDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = await this.prisma.userSubscription.create({
      data: {
        userId,
        planId: plan.id,
        payment_date: paymentDate,
        end_date: endDate,
        status: 'active',
      },
      include: {
        plan: true, 
      },
    });

    return subscription;
  }

  async getMySubscription(userId: string) {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'active',
        end_date: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { end_date: 'desc' },
    });

    if (!subscription) throw new NotFoundException('Nenhuma assinatura ativa encontrada.');
    return subscription;
  }

  async cancelSubscription(userId: string) {
    const activeSub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
    });
    if (!activeSub) throw new NotFoundException('Nenhuma assinatura ativa para cancelar.');

    return this.prisma.userSubscription.update({
      where: { id: activeSub.id },
      data: { status: 'cancelled' },
    });
  }
}
