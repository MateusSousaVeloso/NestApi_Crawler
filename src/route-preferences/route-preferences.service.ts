import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRoutePreferenceDto, UpdateRoutePreferenceDto } from './route-preferences.dto';

@Injectable()
export class RoutePreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDateRange(dateStart?: string, dateEnd?: string) {
    if (dateEnd) {
      if (!dateStart) {
        throw new HttpException(
          { message: 'Data inicial é obrigatória quando data final é informada' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const start = new Date(dateStart + 'T00:00:00Z');
      const end = new Date(dateEnd + 'T00:00:00Z');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        throw new HttpException(
          { message: 'Data final deve ser posterior a data inicial' },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (diffDays > 15) {
        throw new HttpException(
          { message: 'O limite é 15 dias por pesquisa' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async create(userId: string, dto: CreateRoutePreferenceDto) {
    const routeCount = await this.prisma.userRoutePreference.count({
      where: { userId, isActive: true },
    });

    if (routeCount >= 10) {
      throw new HttpException(
        { message: 'Limite de 10 rotas ativas por usuário atingido' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const { dateStart, dateEnd, ...rest } = dto;
    this.validateDateRange(dateStart, dateEnd);

    return this.prisma.userRoutePreference.create({
      data: {
        ...rest,
        dateStart: dateStart ? new Date(dateStart + 'T00:00:00Z') : null,
        dateEnd: dateEnd ? new Date(dateEnd + 'T00:00:00Z') : null,
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
    const { dateStart, dateEnd, ...rest } = dto;
    this.validateDateRange(dateStart, dateEnd);

    return this.prisma.userRoutePreference.update({
      where: { id },
      data: {
        ...rest,
        ...(dateStart !== undefined && { dateStart: dateStart ? new Date(dateStart + 'T00:00:00Z') : null }),
        ...(dateEnd !== undefined && { dateEnd: dateEnd ? new Date(dateEnd + 'T00:00:00Z') : null }),
      },
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
