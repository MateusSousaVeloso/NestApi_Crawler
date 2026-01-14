import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { HistoryModule } from './history/history.module';
// import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    SearchModule,
    HistoryModule,
    // AdminModule,
  ],
})
export class AppModule {}
