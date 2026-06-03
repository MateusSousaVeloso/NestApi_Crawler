import { BadRequestException, Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
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
import { FlightProvider } from './search.enums';

@ApiTags('Search')
@Controller('search')
@Throttle({ search: { ttl: 60000, limit: 20 } })
export class SearchController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly rabbitMQ: RabbitMQService,
  ) {}

  private toDate(raw: string): Date {
    return new Date(raw);
  }

  private adjustDateRange(dto: Record<string, unknown>): Record<string, unknown> | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const depRaw = dto.departureDate as string | undefined;
    const finRaw = dto.finalDate as string | undefined;

    const dep = depRaw ? this.toDate(depRaw) : null;
    const fin = finRaw ? this.toDate(finRaw) : null;

    // finalDate no passado → rejeita sempre
    if (fin && fin < today) {
      throw new BadRequestException('Data final está no passado');
    }

    // departureDate no passado sem finalDate → rejeita
    if (dep && dep < today && !fin) {
      throw new BadRequestException('Data de partida está no passado');
    }

    // departureDate no passado mas finalDate ok → trimma para hoje
    if (dep && dep < today) {
      return { ...dto, departureDate: todayStr };
    }

    // finalDate anterior a departureDate → rejeita
    if (dep && fin && fin < dep) {
      throw new BadRequestException('Data final não pode ser anterior à data de partida');
    }

    return dto;
  }

  private async enqueueSearch(provider: string, dto: Record<string, unknown>, userId: string) {
    dto = this.adjustDateRange(dto)!;

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
    const search = await this.enqueueSearch(FlightProvider.Smiles, dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('azul')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Azul (assíncrono)' })
  @ApiBody({ type: AzulSearchDto })
  async searchAzul(@Body() dto: AzulSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch(FlightProvider.Azul, dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('qatar')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Qatar Airways (assíncrono)' })
  @ApiBody({ type: QatarSearchDto })
  async searchQatar(@Body() dto: QatarSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch(FlightProvider.Qatar, dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('iberia')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na Iberia (assíncrono)' })
  @ApiBody({ type: IberiaSearchDto })
  async searchIberia(@Body() dto: IberiaSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch(FlightProvider.Iberia, dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }

  @Post('tap')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Buscar voos na TAP Portugal (assíncrono)' })
  @ApiBody({ type: TapSearchDto })
  async searchTap(@Body() dto: TapSearchDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.enqueueSearch(FlightProvider.Tap, dto as unknown as Record<string, unknown>, userId);
    return { searchId: search.id, status: search.status };
  }
}
