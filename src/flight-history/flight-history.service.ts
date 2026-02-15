import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FlightHistoryFilterDto } from './flight-history.dto';

@Injectable()
export class FlightHistoryService {
  private readonly logger = new Logger(FlightHistoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Classifica a cabin para o cálculo de mínimos.
   * ECONOMIC, Economy -> economy
   * PREMIUM_ECONOMIC, Premium, W -> premium
   * BUSINESS, Business, Executiva, J, C -> business
   * FIRST, First, F -> first
   */
  private classifyCabin(cabin: string): 'economy' | 'premium' | 'business' | 'first' {
    const c = (cabin || '').toUpperCase();
    if (c.includes('FIRST') || c === 'F') return 'first';
    if (c.includes('BUSINESS') || c.includes('EXECUTIVA') || c === 'J' || c === 'C') return 'business';
    if (c.includes('PREMIUM') || c === 'W') return 'premium';
    return 'economy';
  }

  /**
   * Monta a rota a partir dos legs do voo.
   * Para voo direto GRU->MIA: "GRU/MIA"
   * Para 1 parada GRU->PTY->MIA: "GRU/PTY/MIA"
   * Para 2 paradas GRU->JFK->ATL->MIA: "GRU/JFK/ATL/MIA"
   */
  private buildRoute(f: any, origin: string, destination: string): string {
    if (!f.legs || f.legs.length === 0) {
      // Voo direto
      return `${f.departure?.airport || origin}/${f.arrival?.airport || destination}`;
    }

    // Monta rota com todos os aeroportos únicos em ordem
    const airports: string[] = [];
    for (const leg of f.legs) {
      const dep = leg.departure?.airport;
      const arr = leg.arrival?.airport;
      if (dep && !airports.includes(dep)) airports.push(dep);
      if (arr && !airports.includes(arr)) airports.push(arr);
    }

    // Se o primeiro aeroporto não é a origem, adiciona
    if (airports.length === 0 || airports[0] !== (f.departure?.airport || origin)) {
      airports.unshift(f.departure?.airport || origin);
    }
    // Se o último não é o destino, adiciona
    const lastAirport = airports[airports.length - 1];
    if (lastAirport !== (f.arrival?.airport || destination)) {
      airports.push(f.arrival?.airport || destination);
    }

    return airports.join('/');
  }

  /**
   * Extrai hora no formato HH:mm de uma data ISO string.
   */
  private extractTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '00:00';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '00:00';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Calcula o sufixo de dias (+1, +2, etc.) entre partida e chegada.
   */
  private getDayOffset(depStr: string | null, arrStr: string | null): string {
    if (!depStr || !arrStr) return '';
    const dep = new Date(depStr);
    const arr = new Date(arrStr);
    if (isNaN(dep.getTime()) || isNaN(arr.getTime())) return '';

    const depDay = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate());
    const arrDay = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate());
    const diffDays = Math.round((arrDay.getTime() - depDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `+${diffDays}`;
    return '';
  }

  /**
   * Salva os resultados de uma pesquisa de voos no histórico.
   * Salva TODOS os voos com informações completas.
   */
  async saveSearchResults(
    origin: string,
    destination: string,
    flightDate: string,
    provider: string,
    flights: any[],
  ) {
    if (!flights || flights.length === 0) return;

    // Calcula menor milhas/preço por classe e guarda o voo completo
    let economyMin: number | null = null;
    let premiumMin: number | null = null;
    let businessMin: number | null = null;
    let firstMin: number | null = null;
    let economyMinFlight: any = null;
    let premiumMinFlight: any = null;
    let businessMinFlight: any = null;
    let firstMinFlight: any = null;

    for (const f of flights) {
      const cost = f.miles || f.price || 0;
      if (cost <= 0) continue;

      const cls = this.classifyCabin(f.cabin);
      if (cls === 'first') {
        if (firstMin === null || cost < firstMin) { firstMin = cost; firstMinFlight = f; }
      } else if (cls === 'business') {
        if (businessMin === null || cost < businessMin) { businessMin = cost; businessMinFlight = f; }
      } else if (cls === 'premium') {
        if (premiumMin === null || cost < premiumMin) { premiumMin = cost; premiumMinFlight = f; }
      } else {
        if (economyMin === null || cost < economyMin) { economyMin = cost; economyMinFlight = f; }
      }
    }

    // Constrói JSON normalizado do voo mais barato (mesma shape que FlightSearchDetail)
    const buildMinJson = (f: any): object | undefined => {
      if (!f) return undefined;
      const depDateStr = f.departure?.date || null;
      const arrDateStr = f.arrival?.date || null;
      const depTime = this.extractTime(depDateStr);
      const dayOffset = this.getDayOffset(depDateStr, arrDateStr);
      const arrTime = this.extractTime(arrDateStr) + dayOffset;
      const route = this.buildRoute(f, origin, destination);
      const isDirect = f.stops === 0;
      let flightCode = f.departure?.flightCode || null;
      if (!isDirect && f.legs) {
        flightCode = f.legs.map((leg: any) => leg.flightCode).filter(Boolean).join(', ');
      }
      const cabinLetter = (f.cabin || 'Y').charAt(0).toUpperCase();
      const cabinClass = f.availableSeats != null ? `${cabinLetter}${f.availableSeats}` : null;
      return {
        flightCode,
        airline: f.airline || null,
        cabin: f.cabin || 'ECONOMIC',
        cabinClass,
        availableSeats: f.availableSeats || 0,
        stops: f.stops || 0,
        departureTime: depTime,
        departureAirport: f.departure?.airport || origin,
        arrivalTime: arrTime,
        arrivalAirport: f.arrival?.airport || destination,
        departureDate: depDateStr || null,
        arrivalDate: arrDateStr || null,
        durationHours: f.duration?.hours || 0,
        durationMinutes: f.duration?.minutes || 0,
        miles: f.miles || 0,
        price: f.price ? Number(f.price) : null,
        currency: f.currency || null,
        route,
      };
    };

    try {
      const searchResult = await this.prisma.flightSearchResult.create({
        data: {
          flightDate: new Date(flightDate + 'T00:00:00'),
          origin: origin.toUpperCase(),
          destination: destination.toUpperCase(),
          provider,
          economyMinMiles: economyMin,
          premiumMinMiles: premiumMin,
          businessMinMiles: businessMin,
          firstMinMiles: firstMin,
          economyMinJson: buildMinJson(economyMinFlight),
          premiumMinJson: buildMinJson(premiumMinFlight),
          businessMinJson: buildMinJson(businessMinFlight),
          firstMinJson: buildMinJson(firstMinFlight),
          details: {
            create: flights.map((f) => {
              const isDirect = f.stops === 0;
              const depDateStr = f.departure?.date || null;
              const arrDateStr = f.arrival?.date || null;

              const depTime = this.extractTime(depDateStr);
              const dayOffset = this.getDayOffset(depDateStr, arrDateStr);
              const arrTime = this.extractTime(arrDateStr) + dayOffset;

              const route = this.buildRoute(f, origin, destination);

              // Flight code
              let flightCode = f.departure?.flightCode || null;
              if (!isDirect && f.legs) {
                flightCode = f.legs.map((leg: any) => leg.flightCode).filter(Boolean).join(', ');
              }

              // Cabin class code (ex: E9 = Economy 9 seats)
              const cabinLetter = (f.cabin || 'Y').charAt(0).toUpperCase();
              const cabinClass = f.availableSeats != null
                ? `${cabinLetter}${f.availableSeats}`
                : null;

              // Datas completas
              const departureDate = depDateStr ? new Date(depDateStr) : null;
              const arrivalDate = arrDateStr ? new Date(arrDateStr) : null;

              return {
                uid: f.uid || null,
                flightCode,
                airline: f.airline || null,
                cabin: f.cabin || 'ECONOMIC',
                cabinClass,
                availableSeats: f.availableSeats || 0,
                stops: f.stops || 0,
                departureTime: depTime,
                departureAirport: f.departure?.airport || origin,
                arrivalTime: arrTime,
                arrivalAirport: f.arrival?.airport || destination,
                departureDate,
                arrivalDate,
                durationHours: f.duration?.hours || 0,
                durationMinutes: f.duration?.minutes || 0,
                miles: f.miles || 0,
                price: f.price ? f.price : null,
                currency: f.currency || null,
                route,
                legsJson: f.legs || null,
              };
            }),
          },
        },
      });

      this.logger.log(
        `Salvo ${flights.length} voos no historico: ${origin}->${destination} em ${flightDate} (${provider})`,
      );

      return searchResult;
    } catch (error: any) {
      this.logger.error(`Erro ao salvar historico de voos: ${error.message}`);
    }
  }

  /**
   * Lista todos os resultados de pesquisa com filtros.
   */
  async findAll(filter: FlightHistoryFilterDto) {
    const where: any = {};

    if (filter.origin) {
      where.origin = filter.origin.toUpperCase();
    }
    if (filter.destination) {
      where.destination = filter.destination.toUpperCase();
    }
    if (filter.provider) {
      where.provider = filter.provider;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.flightDate = {};
      if (filter.dateFrom) {
        where.flightDate.gte = new Date(filter.dateFrom + 'T00:00:00');
      }
      if (filter.dateTo) {
        where.flightDate.lte = new Date(filter.dateTo + 'T23:59:59');
      }
    }

    // Filtro por airline nos detalhes
    if (filter.airline) {
      where.details = {
        some: {
          airline: { contains: filter.airline, mode: 'insensitive' },
        },
      };
    }

    // Filtro por paradas
    if (filter.stops !== undefined && filter.stops !== null) {
      const stopsFilter = Number(filter.stops);
      where.details = {
        ...where.details,
        some: {
          ...(where.details?.some || {}),
          stops: stopsFilter,
        },
      };
    }

    // Filtro por cabin
    if (filter.cabin) {
      where.details = {
        ...where.details,
        some: {
          ...(where.details?.some || {}),
          cabin: { contains: filter.cabin, mode: 'insensitive' },
        },
      };
    }

    return this.prisma.flightSearchResult.findMany({
      where,
      orderBy: [{ flightDate: 'asc' }, { searchedAt: 'desc' }],
      include: {
        _count: {
          select: { details: true },
        },
      },
    });
  }

  /**
   * Busca um resultado específico com todos os detalhes dos voos.
   */
  async findOne(id: string) {
    return this.prisma.flightSearchResult.findUnique({
      where: { id },
      include: {
        details: {
          orderBy: [{ cabin: 'asc' }, { miles: 'asc' }],
        },
      },
    });
  }
}
