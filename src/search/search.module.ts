import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { UserSearchesModule } from '../user-searches/user-searches.module';

@Module({
  imports: [UserSearchesModule],
  controllers: [SearchController],
})
export class SearchModule {}
