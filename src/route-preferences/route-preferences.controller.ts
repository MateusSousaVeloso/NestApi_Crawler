import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { RoutePreferencesService } from './route-preferences.service';
import {
  CreateRoutePreferenceDto,
  UpdateRoutePreferenceDto,
  ToggleRoutePreferenceDto,
} from './route-preferences.dto';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';

@ApiTags('Route Preferences')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('route-preferences')
export class RoutePreferencesController {
  constructor(private readonly routePreferencesService: RoutePreferencesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova rota favorita' })
  @ApiResponse({ status: 201, description: 'Rota criada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async create(@Req() req: Request & { user: { id: string } }, @Body() dto: CreateRoutePreferenceDto) {
    return this.routePreferencesService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as rotas favoritas do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de rotas retornada.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async findAll(@Req() req: Request & { user: { id: string } }) {
    return this.routePreferencesService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de uma rota favorita' })
  @ApiParam({ name: 'id', description: 'ID da rota favorita' })
  @ApiResponse({ status: 200, description: 'Detalhes da rota retornados.' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async findOne(@Req() req: Request & { user: { id: string } }, @Param('id') id: string) {
    return this.routePreferencesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma rota favorita' })
  @ApiParam({ name: 'id', description: 'ID da rota favorita' })
  @ApiResponse({ status: 200, description: 'Rota atualizada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async update(@Req() req: Request & { user: { id: string } }, @Param('id') id: string, @Body() dto: UpdateRoutePreferenceDto) {
    return this.routePreferencesService.update(req.user.id, id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Ativar ou desativar alertas de uma rota' })
  @ApiParam({ name: 'id', description: 'ID da rota favorita' })
  @ApiResponse({ status: 200, description: 'Status da rota atualizado.' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async toggle(@Req() req: Request & { user: { id: string } }, @Param('id') id: string, @Body() dto: ToggleRoutePreferenceDto) {
    return this.routePreferencesService.toggle(req.user.id, id, dto.isActive);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover uma rota favorita' })
  @ApiParam({ name: 'id', description: 'ID da rota favorita' })
  @ApiResponse({ status: 204, description: 'Rota removida com sucesso.' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async remove(@Req() req: Request & { user: { id: string } }, @Param('id') id: string) {
    return this.routePreferencesService.remove(req.user.id, id);
  }
}
