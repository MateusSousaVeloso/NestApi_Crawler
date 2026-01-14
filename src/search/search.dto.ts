import { IsString, IsNotEmpty, IsObject, IsUUID } from 'class-validator';

export class DispatchSearchDto {
  @IsUUID()
  user_id: string;

  @IsObject()
  search_params: {
    trip_type: 'one_way' | 'round_trip';
    origin: string;
    destination: string;
    dates: { departure_date: string; return_date?: string };
    passengers: { adults: number; children: number; infants: number };
    preferences: Record<string, any>;
  };
}