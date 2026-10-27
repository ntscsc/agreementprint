const amountFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatReceiptAmount(amount: number): string {
  return amountFormatter.format(amount);
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
}

export function receiptPeriods(firstDate: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const paymentDate = addMonthsClamped(firstDate, index);
    const periodEndDate = addMonthsClamped(firstDate, index + 1);
    // Periods use inclusive calendar dates: end the day before the next starts.
    periodEndDate.setDate(periodEndDate.getDate() - 1);
    return { paymentDate, periodEndDate };
  });
}
