import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { UserSearchesService } from '../user-searches/user-searches.service';
import type { CrawlerProvider } from '../user-searches/user-searches.dto';
import {
  AzulSearchDto,
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
  @ApiBody({ type: SmilesSearchDto })
  searchSmiles(@Req() req: AuthenticatedRequest, @Body() dto: SmilesSearchDto) {
    return this.enqueue(req, 'smiles', { ...dto });
  }

  @Post('azul')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Azul (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: AzulSearchDto })
  searchAzul(@Req() req: AuthenticatedRequest, @Body() dto: AzulSearchDto) {
    return this.enqueue(req, 'azul', { ...dto });
  }

  @Post('qatar')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Qatar (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: QatarSearchDto })
  searchQatar(@Req() req: AuthenticatedRequest, @Body() dto: QatarSearchDto) {
    return this.enqueue(req, 'qatar', { ...dto });
  }

  @Post('iberia')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na Iberia (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: IberiaSearchDto })
  searchIberia(@Req() req: AuthenticatedRequest, @Body() dto: IberiaSearchDto) {
    return this.enqueue(req, 'iberia', { ...dto });
  }

  @Post('tap')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Agenda busca na TAP (priority_queue). Retorna jobId.' })
  @ApiResponse({ status: 202, description: 'Job criado, status=pending.' })
  @ApiBody({ type: TapSearchDto })
  searchTap(@Req() req: AuthenticatedRequest, @Body() dto: TapSearchDto) {
    return this.enqueue(req, 'tap', { ...dto });
  }
}
