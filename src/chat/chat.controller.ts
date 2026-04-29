import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { ChatService } from './chat.service';
import { GetMessagesDto, ImportMessagesDto, SendMessageDto } from './chat.dto';
import type { Request } from 'express';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  @ApiOperation({ summary: 'Histórico de mensagens do usuário (cursor pagination)' })
  @ApiResponse({ status: 200, description: 'Página de mensagens.' })
  async getMessages(@Query() dto: GetMessagesDto, @Req() req: Request) {
    return this.chatService.getMessages((req.user as any).id, dto);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Enviar mensagem ao agente e persistir o par usuário/assistente' })
  @ApiResponse({ status: 201, description: 'Mensagem do assistente.' })
  @ApiResponse({ status: 502, description: 'N8N indisponível.' })
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: Request) {
    return this.chatService.sendMessage((req.user as any).id, dto.content);
  }

  @Delete('messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Limpar todo o histórico de chat do usuário' })
  @ApiResponse({ status: 204, description: 'Histórico limpo.' })
  async clearMessages(@Req() req: Request) {
    await this.chatService.clearMessages((req.user as any).id);
  }

  @Post('messages/import')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Importar histórico do localStorage (one-shot, ignora se DB já tem mensagens)' })
  async importMessages(@Body() dto: ImportMessagesDto, @Req() req: Request) {
    await this.chatService.importMessages((req.user as any).id, dto.messages);
  }
}
