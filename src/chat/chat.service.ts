import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ChatRole } from '../../prisma/generated/client';
import axios from 'axios';
import { GetMessagesDto } from './chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getMessages(userId: string, dto: GetMessagesDto) {
    const take = Math.min(dto.take ? Number.parseInt(dto.take, 10) : 50, 100);
    const cursor = dto.cursor;

    const rows = await this.prisma.milhas_message.findMany({
      take: take + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? (data.at(-1)?.id ?? null) : null;

    return { data: data.toReversed(), nextCursor, hasMore };
  }

  async sendMessage(userId: string, content: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone_number: true, name: true },
    });
    if (!user) throw new NotFoundException('Usuário não existe.');

    const webhookUrl = this.config.get<string>('N8N_WEBHOOK_URL');
    if (!webhookUrl) throw new BadGatewayException('Webhook N8N não configurado.');

    let botResponse: string;
    try {
      const response = await axios.post(webhookUrl, {
        phone: user.phone_number,
        text: { message: content },
        senderName: user.name,
      });
      const d = response.data;
      botResponse = typeof d === 'string' ? d : d?.output || d?.message || JSON.stringify(d);
    } catch (err: any) {
      this.logger.error(`Erro ao chamar N8N: ${err.message}`);
      throw new BadGatewayException('Serviço de chat indisponível. Tente novamente.');
    }

    const [, assistantMsg] = await this.prisma.$transaction([
      this.prisma.milhas_message.create({ data: { userId, role: ChatRole.user, content } }),
      this.prisma.milhas_message.create({ data: { userId, role: ChatRole.assistant, content: botResponse } }),
    ]);

    return assistantMsg;
  }

  async clearMessages(userId: string) {
    await this.prisma.milhas_message.deleteMany({ where: { userId } });
  }
}
