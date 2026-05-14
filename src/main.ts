import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(helmet());
  app.use(compression());

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('FRONTEND_URL deve ser configurada nas variáveis de ambiente.');
  }
  app.enableCors({ origin: frontendUrl, credentials: true });

  // CSRF: rejeita requests mutantes originados de domínios diferentes do frontend.
  // Requests sem header Origin (curl, Postman, server-to-server) são permitidos.
  // Comparação é feita por URL.origin (scheme + host + port) para evitar bypass via prefix matching
  // (ex: app.com.attacker.com passaria com startsWith).
  // const allowedOrigin = new URL(frontendUrl).origin;
  // app.use((req: Request, res: Response, next: NextFunction) => {
  //   if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  //   const origin = req.headers.origin;
  //   if (!origin) return next();
  //   let normalizedOrigin: string;
  //   try {
  //     normalizedOrigin = new URL(origin).origin;
  //   } catch {
  //     return res.status(403).json({ statusCode: 403, message: 'Origem inválida.', error: 'Forbidden' });
  //   }
  //   if (normalizedOrigin !== allowedOrigin) {
  //     return res.status(403).json({ statusCode: 403, message: 'Origem não autorizada.', error: 'Forbidden' });
  //   }
  //   next();
  // });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('CrawlerMilhas API')
    .setDescription('Documentação da API Crawler para busca de passagens aéreas com milhas.')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
      name: 'Authorization',
      description: 'Insira o Bearer Token.',
    })
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
