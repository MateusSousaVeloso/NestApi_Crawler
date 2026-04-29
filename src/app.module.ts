import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { RoutePreferencesModule } from './route-preferences/route-preferences.module';
import { AirportsModule } from './airports/airports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FlightHistoryModule } from './flight-history/flight-history.module';
import { ChatModule } from './chat/chat.module';
import { UserAwareThrottlerGuard } from './common/guards/userAwareThrottler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'auth',    ttl: 60000, limit: 5  }, // rotas de auth (signup/login)
      { name: 'search',  ttl: 60000, limit: 20 }, // crawler Smiles/Azul
      { name: 'default', ttl: 60000, limit: 60 }, // demais rotas autenticadas
    ]),
    UsersModule,
    AuthModule,
    SearchModule,
    SubscriptionsModule,
    RoutePreferencesModule,
    AirportsModule,
    NotificationsModule,
    FlightHistoryModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
  ],
})
export class AppModule {}
