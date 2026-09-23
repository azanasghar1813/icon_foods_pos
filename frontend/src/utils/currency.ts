export function formatCurrency(amount: number): string {
  // Using en-US ensures commas for thousands, e.g., 239,493
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}
