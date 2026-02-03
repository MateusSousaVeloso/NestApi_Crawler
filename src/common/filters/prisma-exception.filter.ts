import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '../../../prisma/generated/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ocorreu um erro interno no servidor.';

    this.logger.error(`Erro Prisma em ${request.method} ${request.url}: ${exception.code}`);

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT; // 409
        let target: string | undefined;
        const meta = exception.meta as any;
        const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;

        if (Array.isArray(adapterFields)) target = adapterFields.join(', ');
        else target = adapterFields;

        message = target ? `Um registro com este ${target} já existe.` : 'Um registro já existe utilizando esses campos.';
        break;
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND; // 404
        message = 'O registro que você tentou operar não foi encontrado.';
        break;
      }
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
        message = `Erro no banco de dados. (Código: ${exception.code})`;
        break;
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      error: HttpStatus[status],
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method
    });
  }
}
