export const businessTimezone =
  process.env.BUSINESS_TIMEZONE || "America/Sao_Paulo";
// Fail clearly on invalid configuration rather than silently using the host timezone.
new Intl.DateTimeFormat("en", { timeZone: businessTimezone }).format();
export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
export function formatMoney(centavos: number) {
  if (!Number.isSafeInteger(centavos))
    throw new Error("Money must be expressed in integer centavos.");
  return `R$ ${(centavos / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
