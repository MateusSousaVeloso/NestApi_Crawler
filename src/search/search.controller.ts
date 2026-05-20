import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { JobsService } from '../jobs/jobs.service';
import { RabbitMQService, JOBS_QUEUE } from '../rabbitmq/rabbitmq.service';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
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
    private readonly jobsService: JobsService,
    private readonly rabbitMQ: RabbitMQService,
  ) {}

  private async enqueueSearch(provider: string, dto: Record<string, unknown>, userId: string) {
    const search = await this.jobsService.create(provider, dto, userId);
    this.rabbitMQ.publish(JOBS_QUEUE, {
      jobId: search.id,
      provider,
      payload: dto,
    });
    return search;
  }

  @Post('smiles')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Smiles (assíncrono)' })
  @ApiBody({ type: SmilesSearchDto })
  async searchSmiles(@Body() dto: SmilesSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch('smiles', dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('azul')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Azul (assíncrono)' })
  @ApiBody({ type: AzulSearchDto })
  async searchAzul(@Body() dto: AzulSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch('azul', dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('qatar')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Qatar Airways (assíncrono)' })
  @ApiBody({ type: QatarSearchDto })
  async searchQatar(@Body() dto: QatarSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch('qatar', dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('iberia')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Iberia (assíncrono)' })
  @ApiBody({ type: IberiaSearchDto })
  async searchIberia(@Body() dto: IberiaSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch('iberia', dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('tap')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na TAP Portugal (assíncrono)' })
  @ApiBody({ type: TapSearchDto })
  async searchTap(@Body() dto: TapSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch('tap', dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }
}
