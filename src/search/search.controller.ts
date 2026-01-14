import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service';
import { DispatchSearchDto } from './search.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // 6.3.1 Disparar Processo de Busca
  @Post('dispatch')
  @HttpCode(HttpStatus.OK)
  async dispatch(@Body() dto: DispatchSearchDto) {
    return this.searchService.dispatchSearch(dto);
  }
}