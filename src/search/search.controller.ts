import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { UserSearchesService } from '../user-searches/user-searches.service';
import { CrawlerProvider } from './crawlers/provider';
import { PROVIDER_REGISTRY } from './crawlers/provider.registry';
import {
  AzulSearchDto,
  FinnairSearchDto,
  IberiaSearchDto,
  QatarSearchDto,
  SmilesSearchDto,
  TapSearchDto,
} from './search.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('search')
@Throttle({ search: { ttl: 60000, limit: 50 } })
export class SearchController {
  constructor(private readonly userSearches: UserSearchesService) {}

  private enqueue(
    req: AuthenticatedRequest,
    provider: CrawlerProvider,
    dto: Record<string, unknown>,
  ) {
    return this.userSearches.create({
      userId: req.user.id,
      provider,
      params: dto,
      priority: true,
    });
  }

  @Post('smiles')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Smiles (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: PROVIDER_REGISTRY[CrawlerProvider.SMILES].dto })
  searchSmiles(@Req() req: AuthenticatedRequest, @Body() dto: SmilesSearchDto) {
    return this.enqueue(req, CrawlerProvider.SMILES, { ...dto });
  }

  @Post('azul')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Azul (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: PROVIDER_REGISTRY[CrawlerProvider.AZUL].dto })
  searchAzul(@Req() req: AuthenticatedRequest, @Body() dto: AzulSearchDto) {
    return this.enqueue(req, CrawlerProvider.AZUL, { ...dto });
  }

  @Post('qatar')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Qatar (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: PROVIDER_REGISTRY[CrawlerProvider.QATAR].dto })
  searchQatar(@Req() req: AuthenticatedRequest, @Body() dto: QatarSearchDto) {
    return this.enqueue(req, CrawlerProvider.QATAR, { ...dto });
  }

  @Post('iberia')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Iberia (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: PROVIDER_REGISTRY[CrawlerProvider.IBERIA].dto })
  searchIberia(@Req() req: AuthenticatedRequest, @Body() dto: IberiaSearchDto) {
    return this.enqueue(req, CrawlerProvider.IBERIA, { ...dto });
  }

  @Post('tap')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na TAP (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: PROVIDER_REGISTRY[CrawlerProvider.TAP].dto })
  searchTap(@Req() req: AuthenticatedRequest, @Body() dto: TapSearchDto) {
    return this.enqueue(req, CrawlerProvider.TAP, { ...dto });
  }

  @Post('finnair')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Finnair (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: PROVIDER_REGISTRY[CrawlerProvider.FINNAIR].dto })
  searchFinnair(@Req() req: AuthenticatedRequest, @Body() dto: FinnairSearchDto) {
    return this.enqueue(req, CrawlerProvider.FINNAIR, { ...dto });
  }
}
