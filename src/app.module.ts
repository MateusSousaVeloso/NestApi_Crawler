import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { HistoryModule } from './history/history.module';
// import { AdminModule } from './admin/admin.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    AuthModule,
    SearchModule,
    HistoryModule,
    SubscriptionsModule,
    // AdminModule,
  ],
})
export class AppModule {}
