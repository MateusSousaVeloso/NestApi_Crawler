import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { RoutePreferencesModule } from './route-preferences/route-preferences.module';
import { AirportsModule } from './airports/airports.module';
// import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    AuthModule,
    SearchModule,
    SubscriptionsModule,
    RoutePreferencesModule,
    AirportsModule,
    // AdminModule,
  ],
})
export class AppModule {}
