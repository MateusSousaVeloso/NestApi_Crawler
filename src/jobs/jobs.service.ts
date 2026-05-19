import { Injectable } from '@nestjs/common';
import { Prisma, UserSearchStatus } from '../../prisma/generated/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  create(provider: string, params: Record<string, unknown>, userId: string) {
    return this.prisma.userSearch.create({
      data: { provider, params: params as Prisma.InputJsonValue, status: 'pending', userId },
    });
  }

  async listByUser(userId: string, status?: string, page = 1, limit = 20) {
    const where = { userId, ...(status ? { status: status as UserSearchStatus } : {}) };
    const [total, items] = await Promise.all([
      this.prisma.userSearch.count({ where }),
      this.prisma.userSearch.findMany({
        where,
        orderBy: { searchTimestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          provider: true,
          status: true,
          params: true,
          searchTimestamp: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          _count: { select: { results: true } },
        },
      }),
    ]);
    return { total, page, limit, items };
  }

  findById(id: string) {
    return this.prisma.userSearch.findUniqueOrThrow({
      where: { id },
      include: {
        results: {
          include: { flightSearchResult: { include: { details: true } } },
        },
      },
    });
  }

  markDoing(id: string) {
    return this.prisma.userSearch.update({
      where: { id },
      data: { status: 'doing', startedAt: new Date() },
    });
  }

  markDone(id: string) {
    return this.prisma.userSearch.update({
      where: { id },
      data: { status: 'done', completedAt: new Date() },
    });
  }

  markError(id: string, errorMessage: string) {
    return this.prisma.userSearch.update({
      where: { id },
      data: { status: 'error', errorMessage, completedAt: new Date() },
    });
  }

  addResult(userSearchId: string, resultId: string) {
    return this.prisma.userSearchResult.upsert({
      where: { userSearchId_resultId: { userSearchId, resultId } },
      create: { userSearchId, resultId },
      update: {},
    });
  }
}
