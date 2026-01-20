import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async getHistory(id: string, limit: number) {
    return this.prisma.history.findMany({
      where: { id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        message: true,
        createdAt: true,
      }
    });
  }

  async logMessage(data: { id: string; message: string}) {
    await this.prisma.history.create({
      data: {
        session_id: data.id,
        message: data.message,
      }
    });
    
    return { status: 'success' };
  }
}