export function formatPrice(value: number): number {
  return `$${value.toFixed(2)}`;
}

export function calculateDiscount(price: number, percent: number): number {
  const multiplier = percent / 100;
  return price - price * multiplier;
}
