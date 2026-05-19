import { IsString, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type JobProvider = 'smiles' | 'azul' | 'qatar' | 'iberia' | 'tap';

export class CreateJobDto {
  @ApiProperty({ enum: ['smiles', 'azul', 'qatar', 'iberia', 'tap'] })
  @IsString()
  @IsIn(['smiles', 'azul', 'qatar', 'iberia', 'tap'])
  provider: JobProvider;

  @ApiProperty({ description: 'Parâmetros da busca (depende do provider)' })
  @IsNotEmpty()
  params: Record<string, unknown>;
}
