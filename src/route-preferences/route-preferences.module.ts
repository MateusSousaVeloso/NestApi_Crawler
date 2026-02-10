import { Module } from '@nestjs/common';
import { RoutePreferencesService } from './route-preferences.service';
import { RoutePreferencesController } from './route-preferences.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  providers: [RoutePreferencesService, PrismaService],
  controllers: [RoutePreferencesController],
})
export class RoutePreferencesModule {}
