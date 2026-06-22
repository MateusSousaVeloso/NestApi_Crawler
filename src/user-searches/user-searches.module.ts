import { Module } from '@nestjs/common';
import { UserSearchesService } from './user-searches.service';
import { UserSearchesController } from './user-searches.controller';
import { PrismaService } from '../database/prisma.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [UserSearchesController],
  providers: [UserSearchesService, PrismaService],
  exports: [UserSearchesService],
})
export class UserSearchesModule {}
