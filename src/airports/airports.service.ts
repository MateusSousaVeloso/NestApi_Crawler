import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  state: string;
  country: string;
  elevation: number;
  lat: number;
  lon: number;
  tz: string;
}

export interface AirportResult {
  iata: string;
  name: string;
}

@Injectable()
export class AirportsService {
  private readonly airports: Airport[];
  private readonly airportsByIata: Map<string, Airport>;

  constructor() {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'airports.json'), 'utf-8'));
    this.airports = (Object.values(data) as Airport[]).filter((a) => a.iata !== '');

    this.airportsByIata = new Map();
    for (const airport of this.airports) {
      this.airportsByIata.set(airport.iata.toUpperCase(), airport);
    }
  }

  search(query: string): AirportResult[] {
    const term = query.toLowerCase();
    const termUpper = query.toUpperCase();

    const exactMatch = this.airportsByIata.get(termUpper);
    if (exactMatch) {
      return [{ iata: exactMatch.iata, name: exactMatch.name }];
    }

    return this.airports
      .filter((a) => a.name.toLowerCase().includes(term) || a.city.toLowerCase().includes(term))
      .slice(0, 10)
      .map((a) => ({ iata: a.iata, name: a.name }));
  }

  searchByState(state: string): AirportResult[] {
    const term = state.toLowerCase();
    return this.airports.filter((a) => a.state.toLowerCase().includes(term)).map((a) => ({ iata: a.iata, name: a.name }));
  }
}
