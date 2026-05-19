import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JobsService } from './jobs.service';
import { RabbitMQService, PRIORITY_QUEUE } from '../rabbitmq/rabbitmq.service';
import { CreateJobDto } from './jobs.dto';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly rabbitMQ: RabbitMQService,
  ) {}

  @Post()
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Criar busca assíncrona — retorna searchId para polling' })
  async createJob(@Body() dto: CreateJobDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const search = await this.jobsService.create(dto.provider, dto.params, userId);

    this.rabbitMQ.publish(PRIORITY_QUEUE, {
      jobId: search.id,
      provider: dto.provider,
      payload: dto.params,
    });

    return { searchId: search.id, status: search.status };
  }

  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Listar buscas do usuário autenticado com paginação' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'doing', 'done', 'error'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listSearches(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const userId = (req.user as { id: string }).id;
    return this.jobsService.listByUser(userId, status, Number(page), Number(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Polling de status — status: pending → doing → done | error' })
  getJob(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }
}
