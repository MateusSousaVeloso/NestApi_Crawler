import { IsString, IsOptional, IsEmail, IsNotEmpty, IsObject } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsObject()
  @IsOptional()
  initial_preferences?: Record<string, any>;
}

export class UpdateUserDto {
  @IsObject()
  @IsOptional()
  preferences?: Record<string, any>;
}

export class UpdateSubscriptionDto {
  @IsString()
  status: string;

  @IsString()
  plan_tier: string;

  @IsString()
  expiration_date: string;

  @IsString()
  transaction_id: string;
}