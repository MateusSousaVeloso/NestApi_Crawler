import { Controller, Post, Get, Req, Body, Param, HttpCode, HttpStatus, UseGuards, NotFoundException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
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
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('search')
@Throttle({ search: { ttl: 60000, limit: 20 } })
export class SearchController {
  constructor(
    private readonly smilesService: SmilesService,
    private readonly azulService: AzulService,
    private readonly qatarService: QatarService,
    private readonly iberiaService: IberiaService,
    private readonly tapService: TapService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('smiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Smiles' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Smiles.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: SmilesSearchDto })
  searchSmiles(@Req() req, @Body() dto: SmilesSearchDto) {
    return this.smilesService.search(req.user.id, dto);
  }

  @Post('azul')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Azul' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Azul.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: AzulSearchDto })
  searchAzul(@Req() req, @Body() dto: AzulSearchDto) {
    return this.azulService.search(req.user.id, dto);
  }

  @Post('qatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Qatar Airways (Avios + cash)' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Qatar.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: QatarSearchDto })
  searchQatar(@Req() req, @Body() dto: QatarSearchDto) {
    return this.qatarService.search(req.user.id, dto);
  }

  @Post('iberia')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Iberia' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Iberia.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: IberiaSearchDto })
  searchIberia(@Req() req, @Body() dto: IberiaSearchDto) {
    return this.iberiaService.search(req.user.id, dto);
  }

  @Post('tap')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na TAP Portugal' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na TAP.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com o crawler Python.' })
  @ApiBody({ type: TapSearchDto })
  searchTap(@Req() req, @Body() dto: TapSearchDto) {
    return this.tapService.search(req.user.id, dto);
  }

  @Get(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consultar status e resultados de uma busca' })
  @ApiResponse({ status: 200, description: 'Status e resultados da busca.' })
  @ApiResponse({ status: 404, description: 'Busca não encontrada.' })
  async getSearchStatus(@Req() req, @Param('id') id: string) {
    const search = await this.prisma.user_searches.findFirst({
      where: { id, userId: req.user.id },
      include: {
        user_search_results: {
          include: {
            flight_search_results: {
              include: { details: true },
            },
          },
        },
      },
    });

    if (!search) throw new NotFoundException('Busca não encontrada.');

    return {
      id: search.id,
      provider: search.provider,
      status: search.status,
      priority: search.priority,
      params: search.params,
      searchTimestamp: search.searchTimestamp,
      startedAt: search.startedAt,
      completedAt: search.completedAt,
      errorMessage: search.errorMessage,
      results: search.user_search_results.map((r) => r.flight_search_results),
    };
  }
}
