import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}
  // 6.4.1 Recuperar Histórico
  @Get(':user_id')
  async getHistory(
    @Param('user_id') userId: string,
    @Query('limit') limit: string
  ) {
    return this.historyService.getHistory(userId, Number(limit) || 10);
  }

  // 6.4.2 Registrar Mensagem
  @Post('log')
  async logMessage(@Body() body: { user_id: string; role: string; content: string; metadata?: any }) {
    return this.historyService.logMessage(body);
  }
}