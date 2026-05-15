import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SmilesService } from './crawlers/smiles.service';
import { AzulService } from './crawlers/azul.service';
import { QatarService } from './crawlers/qatar.service';
import { IberiaService } from './crawlers/iberia.service';
import { TapService } from './crawlers/tap.service';
import {
  AzulSearchDto,
  IberiaSearchDto,
  QatarSearchDto,
  SmilesSearchDto,
  TapSearchDto,
} from './search.dto';

@ApiTags('Search')
@Controller('search')
@Throttle({ search: { ttl: 60000, limit: 20 } })
export class SearchController {
  constructor(
    private readonly smilesService: SmilesService,
    private readonly azulService: AzulService,
    private readonly qatarService: QatarService,
    private readonly iberiaService: IberiaService,
    private readonly tapService: TapService,
  ) {}

  @Post('smiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Smiles' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Smiles.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: SmilesSearchDto })
  searchSmiles(@Body() dto: SmilesSearchDto) {
    return this.smilesService.search(dto);
  }

  @Post('azul')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Azul' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Azul.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: AzulSearchDto })
  searchAzul(@Body() dto: AzulSearchDto) {
    return this.azulService.search(dto);
  }

  @Post('qatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Qatar Airways (Avios + cash)' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Qatar.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: QatarSearchDto })
  searchQatar(@Body() dto: QatarSearchDto) {
    return this.qatarService.search(dto);
  }

  @Post('iberia')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Iberia' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Iberia.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: IberiaSearchDto })
  searchIberia(@Body() dto: IberiaSearchDto) {
    return this.iberiaService.search(dto);
  }

  @Post('tap')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na TAP Portugal' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na TAP.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: TapSearchDto })
  searchTap(@Body() dto: TapSearchDto) {
    return this.tapService.search(dto);
  }
}
