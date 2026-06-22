import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { UserSearchesService } from './user-searches.service';
import { ListUserSearchesDto } from './user-searches.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('UserSearches')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('user-searches')
export class UserSearchesController {
  constructor(private readonly service: UserSearchesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as buscas do usuário logado (cursor pagination)' })
  @ApiResponse({ status: 200, description: 'Lista de UserSearch.' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'doing', 'done', 'error'] })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  list(@Req() req: AuthenticatedRequest, @Query() filter: ListUserSearchesDto) {
    return this.service.findByUser(req.user.id, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado atual de uma busca (polling)' })
  @ApiResponse({ status: 200, description: 'UserSearch encontrada.' })
  @ApiResponse({ status: 404, description: 'UserSearch não encontrada.' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.findOne(req.user.id, id);
  }

  @Get(':id/results')
  @ApiOperation({
    summary:
      'Resultados que esta busca produziu — snapshot pré-update se houver, senão estado atual',
  })
  @ApiResponse({ status: 200, description: 'Lista de resultados resolvidos.' })
  @ApiResponse({ status: 404, description: 'UserSearch não encontrada.' })
  getResults(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getResultsAtTime(id, req.user.id);
  }
}
