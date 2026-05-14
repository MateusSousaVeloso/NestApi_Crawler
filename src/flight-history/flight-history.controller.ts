import { Controller, Get, Param, Query, HttpCode, HttpStatus, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FlightHistoryService } from './flight-history.service';
import { FlightHistoryFilterDto } from './flight-history.dto';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';

@ApiTags('Flight History')
@UseGuards(AccessTokenGuard)
@Controller('flight-history')
export class FlightHistoryController {
  constructor(private readonly flightHistoryService: FlightHistoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar historico de pesquisas de voos (cursor pagination)' })
  @ApiResponse({ status: 200, description: 'Página de pesquisas de voos com nextCursor.' })
  @ApiQuery({ name: 'origin', required: false })
  @ApiQuery({ name: 'destination', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'airline', required: false })
  @ApiQuery({ name: 'stops', required: false })
  @ApiQuery({ name: 'cabin', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'id do último item da página anterior' })
  @ApiQuery({ name: 'take', required: false, description: 'Itens por página (padrão 20, máx 100)' })
  async findAll(@Query() filter: FlightHistoryFilterDto) {
    return this.flightHistoryService.findAll(filter);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detalhes de uma pesquisa de voo especifica' })
  @ApiResponse({ status: 200, description: 'Detalhes dos voos encontrados.' })
  @ApiResponse({ status: 404, description: 'Pesquisa nao encontrada.' })
  async findOne(@Param('id') id: string) {
    const result = await this.flightHistoryService.findOne(id);
    if (!result) throw new NotFoundException('Pesquisa de voo nao encontrada.');
    return result;
  }
}
