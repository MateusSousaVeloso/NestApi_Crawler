export interface FlightLeg {
  flightCode: string;
  cabin: string;
  aircraft?: string;
  departure: {
    date: string;
    airport: string;
  };
  arrival: {
    date: string;
    airport: string;
  };
}

export interface ParsedFlight {
  uid: string;
  airline: string;
  cabin: string;
  availableSeats: number;
  stops: number;
  departure: {
    flightCode?: string;
    date: string;
    airport: string;
    name: string;
  };
  arrival: {
    date: string;
    airport: string;
    name: string;
  };
  duration: {
    hours: number;
    minutes: number;
  };
  miles?: number;
  price?: number;
  currency?: string;
  productClass?: string;
  legs?: FlightLeg[];
}
