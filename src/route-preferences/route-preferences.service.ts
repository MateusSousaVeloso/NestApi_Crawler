import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRoutePreferenceDto, UpdateRoutePreferenceDto } from './route-preferences.dto';

@Injectable()
export class RoutePreferencesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoutePreferenceDto) {
    return this.prisma.userRoutePreference.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.userRoutePreference.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const route = await this.prisma.userRoutePreference.findFirst({
      where: { id, userId },
    });
    if (!route) throw new NotFoundException('Rota não encontrada.');
    return route;
  }

  async update(userId: string, id: string, dto: UpdateRoutePreferenceDto) {
    await this.findOne(userId, id);
    return this.prisma.userRoutePreference.update({
      where: { id },
      data: dto,
    });
  }

  async toggle(userId: string, id: string, isActive: boolean) {
    await this.findOne(userId, id);
    return this.prisma.userRoutePreference.update({
      where: { id },
      data: { isActive },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.userRoutePreference.delete({
      where: { id },
    });
  }
}
