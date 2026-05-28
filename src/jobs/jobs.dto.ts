import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FlightProvider } from '../search/search.enums';

export class CreateJobDto {
  @ApiProperty({ enum: FlightProvider })
  @IsEnum(FlightProvider)
  provider: FlightProvider;

  @ApiProperty({ description: 'Parâmetros da busca (depende do provider)' })
  @IsNotEmpty()
  params: Record<string, unknown>;
}
