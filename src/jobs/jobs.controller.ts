import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { RabbitMQService, JOBS_QUEUE } from '../rabbitmq/rabbitmq.service';
import { CreateJobDto } from './jobs.dto';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly rabbitMQ: RabbitMQService,
  ) {}

  /**
   * Cria um job de busca assíncrona e publica na fila do RabbitMQ.
   * O frontend usa o jobId retornado para fazer polling em GET /jobs/:id.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Criar job de busca assíncrona' })
  async createJob(@Body() dto: CreateJobDto) {
    const job = await this.jobsService.create(dto.provider, dto.payload);

    // Publica a mensagem na fila — o Python worker vai consumir isso
    this.rabbitMQ.publish(JOBS_QUEUE, {
      jobId: job.id,
      provider: dto.provider,
      payload: dto.payload,
    });

    return { jobId: job.id, status: job.status };
  }

  /**
   * Retorna o status e resultado do job (polling do frontend).
   * status: pending → processing → completed | failed
   */
  @Get(':id')
  @ApiOperation({ summary: 'Buscar status e resultado do job' })
  getJob(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }
}
