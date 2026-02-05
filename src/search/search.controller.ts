import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SmilesSearchDto, AzulSearchDto } from './search.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Post('smiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Smiles' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Smiles.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com a API da Smiles.' })
  @ApiBody({ type: SmilesSearchDto })
  async searchSmiles(@Body() dto: SmilesSearchDto) {
    return this.searchService.searchSmiles(dto);
  }

  @Post('azul')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar voos na Azul' })
  @ApiResponse({ status: 200, description: 'Resultados da busca na Azul.' })
  @ApiResponse({ status: 502, description: 'Falha ao comunicar com a API da Azul.' })
  @ApiBody({ type: AzulSearchDto })
  async searchAzul(@Body() dto: AzulSearchDto) {
    return this.searchService.searchAzul(dto);
  }

  // @Post('latam')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Buscar voos na LATAM' })
  // @ApiResponse({ status: 200, description: 'Resultados da busca na LATAM.' })
  // @ApiResponse({ status: 502, description: 'Falha ao comunicar com a API da LATAM.' })
  // @ApiBody({ type: FlightSearchDto })
  // async searchLatam(@Body() dto: FlightSearchDto) {
  //   return this.searchService.searchLatam(dto);
  // }
}
