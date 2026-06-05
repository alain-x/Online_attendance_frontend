export function money(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}
