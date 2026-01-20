import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}
  @Get(':user_id')
  async getHistory(
    @Param('id') id: string,
    @Query('limit') limit: string
  ) {
    return this.historyService.getHistory(id, Number(limit) || 10);
  }

  @Post('log')
  async logMessage(@Body() body: { id: string; message: string;}) {
    return this.historyService.logMessage(body);
  }
}