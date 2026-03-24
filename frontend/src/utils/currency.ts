export function formatCurrency(value: any): string {
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return Number(parsed || 0).toFixed(2);
}
