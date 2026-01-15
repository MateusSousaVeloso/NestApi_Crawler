import { Controller, Post, Get, Patch, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { SubscribeDto } from './subscriptions.dto';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Assinar um plano' })
  @ApiResponse({ status: 201, description: 'Assinatura realizada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado.' })
  async subscribe(@Req() req, @Body() body: SubscribeDto) {
    return this.subscriptionsService.subscribe(req.user.id, body.planId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Ver detalhes da minha assinatura ativa' })
  @ApiResponse({ status: 200, description: 'Dados da assinatura retornados.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 404, description: 'Nenhuma assinatura ativa encontrada.' })
  async getMySubscription(@Req() req) {
    return this.subscriptionsService.getMySubscription(req.user.id);
  }

  @ApiBearerAuth()
  @Patch('cancel')
  @HttpCode(HttpStatus.NO_CONTENT) // 204
  @ApiOperation({ summary: 'Cancelar assinatura ativa' })
  @ApiResponse({ status: 204, description: 'Assinatura excluída com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 404, description: 'Nenhuma assinatura ativa para cancelar.' })
  async cancel(@Req() req) {
    return this.subscriptionsService.cancelSubscription(req.user.id);
  }
}
