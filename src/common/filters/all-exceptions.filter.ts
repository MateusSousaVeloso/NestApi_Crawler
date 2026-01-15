import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseData = exceptionResponse as any;
        message = responseData.message || message;
        error = responseData.error || error;
      } else {
        message = exceptionResponse as string;
      }
      this.logger.warn(`Erro HTTP ${status} em ${request.method} ${request.url}: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
    } 
    else if (exception instanceof Error) {
      this.logger.error(`Erro Crítico: [${request.method} ${request.url}]: ${exception.message}`, exception.stack);
    } 
    else {
      this.logger.error(`Erro desconhecido capturado: ${exception}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method, 
    });
  }
}