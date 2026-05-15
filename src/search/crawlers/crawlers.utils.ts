import { ParsedFlight } from '../search.interfaces';

export function filterAndSortFlights(
  flights: ParsedFlight[],
  cabin?: string,
  orderBy?: string,
  costField: 'miles' | 'price' = 'miles',
): ParsedFlight[] {
  let filtered = flights;
  if (cabin && cabin !== 'ALL') filtered = flights.filter((f) => f.cabin === cabin);
  if (orderBy === 'preco') {
    filtered.sort((a, b) => (a[costField] || 0) - (b[costField] || 0));
  } else if (orderBy === 'custo_beneficio') {
    filtered.sort((a, b) => {
      const dA = a.duration.hours * 60 + a.duration.minutes;
      const dB = b.duration.hours * 60 + b.duration.minutes;
      return (
        (dA > 0 ? (a[costField] || 0) / dA : Infinity) -
        (dB > 0 ? (b[costField] || 0) / dB : Infinity)
      );
    });
  }
  return filtered.slice(0, 3);
}
