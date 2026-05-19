import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  create(provider: string, payload: Record<string, unknown>) {
    return this.prisma.job.create({
      data: { provider, payload: payload as Prisma.InputJsonValue, status: 'pending' },
    });
  }

  findById(id: string) {
    return this.prisma.job.findUniqueOrThrow({ where: { id } });
  }

  markProcessing(id: string) {
    return this.prisma.job.update({ where: { id }, data: { status: 'processing' } });
  }

  markCompleted(id: string, result?: Record<string, unknown>) {
    return this.prisma.job.update({ where: { id }, data: { status: 'completed', result: result as Prisma.InputJsonValue } });
  }

  markFailed(id: string, errorMessage: string) {
    return this.prisma.job.update({ where: { id }, data: { status: 'failed', errorMessage } });
  }
}
