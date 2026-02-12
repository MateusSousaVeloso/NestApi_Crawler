import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AirportsService } from './airports.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('airports')
@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar aeroportos por nome, cidade, IATA ou estado' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome, cidade ou código IATA' })
  @ApiQuery({ name: 'state', required: false, description: 'Filtrar por estado' })
  search(
    @Query('search') search?: string,
    @Query('state') state?: string,
  ) {
    if (search) {
      return this.airportsService.search(search);
    }

    if (state) {
      return this.airportsService.searchByState(state);
    }

    throw new BadRequestException(
      'Informe pelo menos um parâmetro: search ou state',
    );
  }
}
