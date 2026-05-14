import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SmilesService } from './crawlers/smiles.service';
import { AzulService } from './crawlers/azul.service';
import { AzulSearchDto, SmilesSearchDto } from './search.dto';

@ApiTags('Search')
@Controller('search')
@Throttle({ search: { ttl: 60000, limit: 20 } })
export class SearchController {
  constructor(
    private readonly smilesService: SmilesService,
    private readonly azulService: AzulService,
  ) {}

  @Post('smiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Smiles' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Smiles.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com a API da Smiles.' })
  @ApiBody({ type: SmilesSearchDto })
  searchSmiles(@Body() dto: SmilesSearchDto) {
    return this.smilesService.search(dto);
  }

  @Post('azul')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Azul' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Azul.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com a API da Azul.' })
  @ApiBody({ type: AzulSearchDto })
  searchAzul(@Body() dto: AzulSearchDto) {
    return this.azulService.search(dto);
  }
}
