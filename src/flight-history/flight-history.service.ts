import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FlightHistoryFilterDto } from './flight-history.dto';

@Injectable()
export class FlightHistoryService {
  private readonly logger = new Logger(FlightHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private buildRoute(f: any, origin: string, destination: string): string {
    if (!f.legs || f.legs.length === 0) {
      return `${f.departure?.airport || origin}/${f.arrival?.airport || destination}`;
    }

    const airports: string[] = [];
    for (const leg of f.legs) {
      const dep = leg.departure?.airport;
      const arr = leg.arrival?.airport;
      if (dep && !airports.includes(dep)) airports.push(dep);
      if (arr && !airports.includes(arr)) airports.push(arr);
    }

    if (airports.length === 0 || airports[0] !== (f.departure?.airport || origin)) {
      airports.unshift(f.departure?.airport || origin);
    }
    const lastAirport = airports.at(-1);
    if (lastAirport !== (f.arrival?.airport || destination)) {
      airports.push(f.arrival?.airport || destination);
    }

    return airports.join('/');
  }

  private extractTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '00:00';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '00:00';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private getDayOffset(depStr: string | null, arrStr: string | null): string {
    if (!depStr || !arrStr) return '';
    const dep = new Date(depStr);
    const arr = new Date(arrStr);
    if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return '';

    const depDay = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate());
    const arrDay = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate());
    const diffDays = Math.round((arrDay.getTime() - depDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `+${diffDays}`;
    return '';
  }

  private extractFlightDates(f: any): { depDateStr: string | null; arrDateStr: string | null } {
    return {
      depDateStr: f.departure?.date || null,
      arrDateStr: f.arrival?.date || null,
    };
  }

  private buildFlightBase(f: any, origin: string, destination: string) {
    const { depDateStr, arrDateStr } = this.extractFlightDates(f);
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
    const cabinClass = f.availableSeats == null ? null : `${cabinLetter}${f.availableSeats}`;

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
      durationHours: f.duration?.hours || 0,
      durationMinutes: f.duration?.minutes || 0,
      miles: f.miles || 0,
      price: f.price ? Number(f.price) : null,
      currency: f.currency || null,
      route,
    };
  }

  private buildMinJson(f: any, origin: string, destination: string): object | undefined {
    if (!f) return undefined;
    const { depDateStr, arrDateStr } = this.extractFlightDates(f);
    return {
      ...this.buildFlightBase(f, origin, destination),
      departureDate: depDateStr,
      arrivalDate: arrDateStr,
    };
  }

  private buildDetailData(f: any, origin: string, destination: string) {
    const { depDateStr, arrDateStr } = this.extractFlightDates(f);
    return {
      uid: f.uid || null,
      ...this.buildFlightBase(f, origin, destination),
      departureDate: depDateStr ? new Date(depDateStr) : null,
      arrivalDate: arrDateStr ? new Date(arrDateStr) : null,
      legsJson: f.legs || undefined,
    };
  }

  private findCabinMinimals(flights: any[]) {
    const cabins = { ECONOMY: { min: null as number | null, flight: null as any }, PREMIUM: { min: null as number | null, flight: null as any }, BUSINESS: { min: null as number | null, flight: null as any }, FIRST: { min: null as number | null, flight: null as any } };
    for (const f of flights) {
      const cost = f.miles || f.price || 0;
      if (cost <= 0) continue;
      const cabin = (f.cabin === 'FIRST' || f.cabin === 'BUSINESS' || f.cabin === 'PREMIUM') ? f.cabin : 'ECONOMY';
      if (cabins[cabin].min === null || cost < cabins[cabin].min) {
        cabins[cabin].min = cost;
        cabins[cabin].flight = f;
      }
    }
    return cabins;
  }

  private summaryDiffers(
    existing: {
      economyMinMiles: number | null;
      premiumMinMiles: number | null;
      businessMinMiles: number | null;
      firstMinMiles: number | null;
      economyMinJson: unknown;
      premiumMinJson: unknown;
      businessMinJson: unknown;
      firstMinJson: unknown;
    },
    next: {
      economyMinMiles: number | null;
      premiumMinMiles: number | null;
      businessMinMiles: number | null;
      firstMinMiles: number | null;
      economyMinJson: unknown;
      premiumMinJson: unknown;
      businessMinJson: unknown;
      firstMinJson: unknown;
    },
  ): boolean {
    if (
      existing.economyMinMiles !== next.economyMinMiles ||
      existing.premiumMinMiles !== next.premiumMinMiles ||
      existing.businessMinMiles !== next.businessMinMiles ||
      existing.firstMinMiles !== next.firstMinMiles
    ) {
      return true;
    }
    return (
      JSON.stringify(existing.economyMinJson ?? null) !== JSON.stringify(next.economyMinJson ?? null) ||
      JSON.stringify(existing.premiumMinJson ?? null) !== JSON.stringify(next.premiumMinJson ?? null) ||
      JSON.stringify(existing.businessMinJson ?? null) !== JSON.stringify(next.businessMinJson ?? null) ||
      JSON.stringify(existing.firstMinJson ?? null) !== JSON.stringify(next.firstMinJson ?? null)
    );
  }

  private detailsFingerprint(details: any[]): string {
    const items = (details ?? []).map((d) => ({
      uid: d.uid ?? null,
      flightCode: d.flightCode ?? null,
      airline: d.airline ?? null,
      cabin: d.cabin ?? null,
      cabinClass: d.cabinClass ?? null,
      availableSeats: d.availableSeats ?? 0,
      stops: d.stops ?? 0,
      departureTime: d.departureTime ?? null,
      departureAirport: d.departureAirport ?? null,
      arrivalTime: d.arrivalTime ?? null,
      arrivalAirport: d.arrivalAirport ?? null,
      durationHours: d.durationHours ?? 0,
      durationMinutes: d.durationMinutes ?? 0,
      miles: d.miles ?? 0,
      price: d.price != null ? Number(d.price) : null,
      currency: d.currency ?? null,
      route: d.route ?? null,
      legs: d.legsJson ?? null,
    }));
    items.sort((a, b) => {
      const ka = `${a.uid ?? ''}|${a.flightCode ?? ''}|${a.cabin ?? ''}|${a.departureTime ?? ''}`;
      const kb = `${b.uid ?? ''}|${b.flightCode ?? ''}|${b.cabin ?? ''}|${b.departureTime ?? ''}`;
      return ka.localeCompare(kb);
    });
    return JSON.stringify(items);
  }

  async saveSearchResults(
    origin: string,
    destination: string,
    flightDate: string,
    provider: string,
    flights: any[],
  ) {
    if (!flights || flights.length === 0) return;

    const { ECONOMY: economyData, PREMIUM: premiumData, BUSINESS: businessData, FIRST: firstData } = this.findCabinMinimals(flights);

    const normalizedOrigin = origin.toUpperCase();
    const normalizedDest = destination.toUpperCase();
    const parsedDate = new Date(flightDate + 'T00:00:00');
    const detailsData = flights.map((f) => this.buildDetailData(f, origin, destination));

    const summaryData = {
      economyMinMiles: economyData.min,
      premiumMinMiles: premiumData.min,
      businessMinMiles: businessData.min,
      firstMinMiles: firstData.min,
      economyMinJson: this.buildMinJson(economyData.flight, origin, destination),
      premiumMinJson: this.buildMinJson(premiumData.flight, origin, destination),
      businessMinJson: this.buildMinJson(businessData.flight, origin, destination),
      firstMinJson: this.buildMinJson(firstData.flight, origin, destination),
    };

    // Chamado pelo ResultsConsumerService quando o worker termina o crawler.
    // Falhas aqui são logadas pelo consumer e a UserSearch vira `error`.
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.flightSearchResult.findUnique({
        where: {
          origin_destination_flightDate_provider: {
            origin: normalizedOrigin,
            destination: normalizedDest,
            flightDate: parsedDate,
            provider,
          },
        },
        include: { details: true },
      });

      // Snapshot do registro antigo se houver mudança real (ignora searchedAt)
      // Compara summary E fingerprint dos details — qualquer voo que mudou (preço/seats/etc) dispara
      const changed =
        existing &&
        (this.summaryDiffers(existing, summaryData) ||
          this.detailsFingerprint(existing.details) !== this.detailsFingerprint(detailsData));

      if (existing && changed) {
        await tx.flightSearchResultHistory.create({
          data: {
            originalResultId: existing.id,
            flightDate: existing.flightDate,
            searchedAt: existing.searchedAt,
            origin: existing.origin,
            destination: existing.destination,
            provider: existing.provider,
            economyMinMiles: existing.economyMinMiles,
            premiumMinMiles: existing.premiumMinMiles,
            businessMinMiles: existing.businessMinMiles,
            firstMinMiles: existing.firstMinMiles,
            economyMinJson: existing.economyMinJson ?? undefined,
            premiumMinJson: existing.premiumMinJson ?? undefined,
            businessMinJson: existing.businessMinJson ?? undefined,
            firstMinJson: existing.firstMinJson ?? undefined,
            details: {
              create: existing.details.map((d) => ({
                uid: d.uid,
                flightCode: d.flightCode,
                airline: d.airline,
                cabin: d.cabin,
                cabinClass: d.cabinClass,
                availableSeats: d.availableSeats,
                stops: d.stops,
                departureTime: d.departureTime,
                departureAirport: d.departureAirport,
                arrivalTime: d.arrivalTime,
                arrivalAirport: d.arrivalAirport,
                departureDate: d.departureDate,
                arrivalDate: d.arrivalDate,
                durationHours: d.durationHours,
                durationMinutes: d.durationMinutes,
                miles: d.miles,
                price: d.price,
                currency: d.currency,
                route: d.route,
                legsJson: d.legsJson ?? undefined,
              })),
            },
          },
        });
      }

      await tx.flightSearchDetail.deleteMany({
        where: {
          searchResult: {
            origin: normalizedOrigin,
            destination: normalizedDest,
            flightDate: parsedDate,
            provider,
          },
        },
      });

      return tx.flightSearchResult.upsert({
        where: {
          origin_destination_flightDate_provider: {
            origin: normalizedOrigin,
            destination: normalizedDest,
            flightDate: parsedDate,
            provider,
          },
        },
        update: {
          searchedAt: new Date(),
          ...summaryData,
          details: { create: detailsData },
        },
        create: {
          flightDate: parsedDate,
          origin: normalizedOrigin,
          destination: normalizedDest,
          provider,
          ...summaryData,
          details: { create: detailsData },
        },
      });
    });
  }

  private buildWhereClause(filter: FlightHistoryFilterDto) {
    const where: any = {};
    if (filter.origin) where.origin = filter.origin.toUpperCase();
    if (filter.destination) where.destination = filter.destination.toUpperCase();
    if (filter.provider) where.provider = filter.provider;

    if (filter.dateFrom || filter.dateTo) {
      where.flightDate = {};
      if (filter.dateFrom) where.flightDate.gte = new Date(filter.dateFrom + 'T00:00:00');
      if (filter.dateTo) where.flightDate.lte = new Date(filter.dateTo + 'T23:59:59');
    }

    const detailsSome: Record<string, any> = {};
    if (filter.airline) detailsSome.airline = { contains: filter.airline, mode: 'insensitive' };
    if (filter.stops !== undefined && filter.stops !== null) detailsSome.stops = Number(filter.stops);
    if (filter.cabin) detailsSome.cabin = { contains: filter.cabin, mode: 'insensitive' };
    if (Object.keys(detailsSome).length > 0) where.details = { some: detailsSome };

    return where;
  }

  async findAll(filter: FlightHistoryFilterDto) {
    const take = Math.min(filter.take ? Number.parseInt(filter.take, 10) : 20, 100);
    const where = this.buildWhereClause(filter);

    const rows = await this.prisma.flightSearchResult.findMany({
      take: take + 1,
      skip: filter.cursor ? 1 : 0,
      cursor: filter.cursor ? { id: filter.cursor } : undefined,
      where,
      orderBy: [{ searchedAt: 'desc' }, { id: 'asc' }],
      include: { _count: { select: { details: true } } },
    });

    const hasMore = rows.length > take;
    return {
      data: hasMore ? rows.slice(0, take) : rows,
      nextCursor: hasMore ? (rows[take]?.id ?? null) : null,
      hasMore,
    };
  }

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
