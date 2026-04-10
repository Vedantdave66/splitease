export function formatCurrency(value: any): string {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return "0.00";
    }
    const num = Number(value);
    // Rounding is only done at display level
    return num.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}
