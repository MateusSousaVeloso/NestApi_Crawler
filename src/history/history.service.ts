import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async getHistory(userId: string, limit: number) {
    return this.prisma.history.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
        createdAt: true,
      }
    });
  }

  async logMessage(data: { user_id: string; role: string; content: string; metadata?: any }) {
    await this.prisma.history.create({
      data: {
        userId: data.user_id,
        role: data.role,
        content: data.content,
        metadata: data.metadata || {},
      }
    });
    
    return { status: 'success' };
  }
}