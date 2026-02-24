import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionStatus } from '../../prisma/generated/client';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async subscribe(userId: string, planId: number) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    const user = await this.findUserOrThrow(userId);

    await this.prisma.userSubscription.deleteMany({
      where: { userPhone: user.phone_number, status: SubscriptionStatus.active },
    });

    const paymentDate = new Date();
    const endDate = new Date(paymentDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    return this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.deleteMany({
        where: { userPhone: user.phone_number },
      });

      return tx.userSubscription.create({
        data: {
          userPhone: user.phone_number,
          planId: plan.id,
          payment_date: paymentDate,
          end_date: endDate,
          status: SubscriptionStatus.active,
        },
        include: {
          plan: {
            select: { name: true, price: true, durationDays: true },
          },
        },
      });
    });
  }

  async getMySubscription(userId: string) {
    const user = await this.findUserOrThrow(userId);
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userPhone: user.phone_number,
        status: SubscriptionStatus.active,
        end_date: { gt: new Date() },
      },
      include: {
        plan: {
          select: { name: true, price: true, durationDays: true },
        },
      },
      orderBy: { end_date: 'desc' },
    });

    if (!subscription) throw new NotFoundException('Nenhuma assinatura ativa encontrada.');
    return subscription;
  }

  async cancelSubscription(userId: string) {
    const user = await this.findUserOrThrow(userId);
    const activeSub = await this.prisma.userSubscription.findFirst({
      where: { userPhone: user.phone_number, status: SubscriptionStatus.active },
    });
    if (!activeSub) throw new NotFoundException('Nenhuma assinatura ativa para cancelar.');

    return this.prisma.userSubscription.update({
      where: { id: activeSub.id },
      data: { status: SubscriptionStatus.cancelled },
    });
  }
}
