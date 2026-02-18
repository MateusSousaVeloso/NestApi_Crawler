import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CabinType, AlertFrequency } from '../../prisma/generated/client';

export class CreateRoutePreferenceDto {
  @ApiProperty({ example: 'São Paulo', description: 'Nome da cidade de origem' })
  @IsString()
  @IsNotEmpty()
  originCity: string;

  @ApiProperty({ example: 'GRU', description: 'Código IATA do aeroporto de origem' })
  @IsString()
  @IsNotEmpty()
  originIata: string;

  @ApiProperty({ example: 'Miami', description: 'Nome da cidade de destino' })
  @IsString()
  @IsNotEmpty()
  destinationCity: string;

  @ApiProperty({ example: 'MIA', description: 'Código IATA do aeroporto de destino' })
  @IsString()
  @IsNotEmpty()
  destinationIata: string;

  @ApiPropertyOptional({
    enum: CabinType,
    default: CabinType.ANY,
    description: 'Tipo de cabine preferida (ANY = Qualquer, ECONOMIC = Econômica, BUSINESS = Executiva, FIRST = Primeira Classe)',
  })
  @IsEnum(CabinType)
  @IsOptional()
  cabinType?: CabinType = CabinType.ANY;

  @ApiPropertyOptional({
    enum: AlertFrequency,
    default: AlertFrequency.DAILY,
    description: 'Frequência dos alertas (DAILY = Diariamente, EVERY_6_HOURS = A cada 6 horas, EVERY_12_HOURS = A cada 12 horas)',
  })
  @IsEnum(AlertFrequency)
  @IsOptional()
  alertFrequency?: AlertFrequency = AlertFrequency.DAILY;

  @ApiPropertyOptional({
    example: '2025-06-01',
    description: 'Data de início do período de busca (formato ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  dateStart?: string;

  @ApiPropertyOptional({
    example: '2025-06-30',
    description: 'Data de fim do período de busca (formato ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  dateEnd?: string;
}

export class UpdateRoutePreferenceDto extends PartialType(CreateRoutePreferenceDto) {
  @ApiPropertyOptional({ example: true, description: 'Se a rota está ativa para receber alertas' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ToggleRoutePreferenceDto {
  @ApiProperty({ example: true, description: 'Ativar ou desativar a rota' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
