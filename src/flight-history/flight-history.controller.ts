import { Controller, Get, Param, Query, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FlightHistoryService } from './flight-history.service';
import { FlightHistoryFilterDto } from './flight-history.dto';

@ApiTags('Flight History')
@Controller('flight-history')
export class FlightHistoryController {
  constructor(private readonly flightHistoryService: FlightHistoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar histórico de pesquisas de voos' })
  @ApiResponse({ status: 200, description: 'Lista de pesquisas de voos.' })
  @ApiQuery({ name: 'origin', required: false, description: 'IATA da origem' })
  @ApiQuery({ name: 'destination', required: false, description: 'IATA do destino' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Data inicial (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Data final (YYYY-MM-DD)' })
  @ApiQuery({ name: 'provider', required: false, description: 'Provedor (Smiles, Azul)' })
  async findAll(@Query() filter: FlightHistoryFilterDto) {
    return this.flightHistoryService.findAll(filter);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detalhes de uma pesquisa de voo específica' })
  @ApiResponse({ status: 200, description: 'Detalhes dos voos encontrados.' })
  @ApiResponse({ status: 404, description: 'Pesquisa não encontrada.' })
  async findOne(@Param('id') id: string) {
    const result = await this.flightHistoryService.findOne(id);
    if (!result) throw new NotFoundException('Pesquisa de voo não encontrada.');
    return result;
  }
}
