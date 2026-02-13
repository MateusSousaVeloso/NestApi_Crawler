import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FlightHistoryFilterDto } from './flight-history.dto';

@Injectable()
export class FlightHistoryService {
  private readonly logger = new Logger(FlightHistoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Salva os resultados de uma pesquisa de voos no histórico.
   * Agrupa por cabin e calcula o menor custo por classe.
   */
  async saveSearchResults(
    origin: string,
    destination: string,
    flightDate: string,
    provider: string,
    flights: any[],
  ) {
    if (!flights || flights.length === 0) return;

    // Calcula menor milhas por classe
    let economyMin: number | null = null;
    let premiumMin: number | null = null;
    let businessMin: number | null = null;
    let firstMin: number | null = null;

    for (const f of flights) {
      const cost = f.miles || f.price || 0;
      if (cost <= 0) continue;

      const cabin = (f.cabin || '').toUpperCase();
      if (cabin.includes('FIRST') || cabin === 'F') {
        if (firstMin === null || cost < firstMin) firstMin = cost;
      } else if (cabin.includes('BUSINESS') || cabin.includes('EXECUTIVA') || cabin === 'J' || cabin === 'C') {
        if (businessMin === null || cost < businessMin) businessMin = cost;
      } else if (cabin.includes('PREMIUM') || cabin === 'W') {
        if (premiumMin === null || cost < premiumMin) premiumMin = cost;
      } else {
        // Economy / Economic / qualquer outro
        if (economyMin === null || cost < economyMin) economyMin = cost;
      }
    }

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
          details: {
            create: flights.map((f) => {
              const isDirect = f.stops === 0;
              const depDate = f.departure?.date ? new Date(f.departure.date) : null;
              const arrDate = f.arrival?.date ? new Date(f.arrival.date) : null;

              // Monta string de horário
              const depTime = depDate
                ? `${String(depDate.getHours()).padStart(2, '0')}:${String(depDate.getMinutes()).padStart(2, '0')}`
                : '00:00';

              let arrTime = arrDate
                ? `${String(arrDate.getHours()).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')}`
                : '00:00';

              // Verifica se é +1 dia
              if (depDate && arrDate && arrDate.toDateString() !== depDate.toDateString()) {
                arrTime += '+1';
              }

              // Monta a rota (ex: GRU/MIA ou GRU/BSB/MIA)
              let route = f.departure?.airport || origin;
              if (f.legs && f.legs.length > 0) {
                const stops = f.legs
                  .slice(0, -1)
                  .map((leg: any) => leg.arrival?.airport)
                  .filter(Boolean);
                if (stops.length > 0) {
                  route += '/' + stops.join('/');
                }
              }
              route += '/' + (f.arrival?.airport || destination);

              // Flight code
              let flightCode = f.departure?.flightCode || null;
              if (!isDirect && f.legs) {
                flightCode = f.legs.map((leg: any) => leg.flightCode).filter(Boolean).join(', ');
              }

              // Cabin class code (extrair da cabine, ex: T6, X9)
              const cabinClass = f.availableSeats
                ? `${(f.cabin || 'Y').charAt(0).toUpperCase()}${f.availableSeats}`
                : null;

              return {
                flightCode,
                airline: f.airline || null,
                cabin: f.cabin || 'Economy',
                cabinClass,
                availableSeats: f.availableSeats || 0,
                stops: f.stops || 0,
                departureTime: depTime,
                departureAirport: f.departure?.airport || origin,
                arrivalTime: arrTime,
                arrivalAirport: f.arrival?.airport || destination,
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
        `Salvo ${flights.length} voos no histórico: ${origin}->${destination} em ${flightDate} (${provider})`,
      );

      return searchResult;
    } catch (error: any) {
      this.logger.error(`Erro ao salvar histórico de voos: ${error.message}`);
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
