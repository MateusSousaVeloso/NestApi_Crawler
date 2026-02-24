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
  @ApiOperation({ summary: 'Listar historico de pesquisas de voos' })
  @ApiResponse({ status: 200, description: 'Lista de pesquisas de voos.' })
  @ApiQuery({ name: 'origin', required: false, description: 'IATA da origem' })
  @ApiQuery({ name: 'destination', required: false, description: 'IATA do destino' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Data inicial (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Data final (YYYY-MM-DD)' })
  @ApiQuery({ name: 'provider', required: false, description: 'Provedor (Smiles)' })
  @ApiQuery({ name: 'airline', required: false, description: 'Companhia aerea (COPA, AMERICAN AIRLINES, etc.)' })
  @ApiQuery({ name: 'stops', required: false, description: 'Numero de paradas (0=direto, 1, 2)' })
  @ApiQuery({ name: 'cabin', required: false, description: 'Classe (ECONOMIC, BUSINESS, FIRST)' })
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
