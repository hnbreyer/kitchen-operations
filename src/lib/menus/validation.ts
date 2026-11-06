export class MenuError extends Error {}
export function text(
  value: unknown,
  label: string,
  max = 10000,
  required = false,
) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new MenuError(
      `${label} ${required ? "is required and " : ""}must be at most ${max} characters.`,
    );
  return value.trim();
}
export function readJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.length > 500000)
    throw new MenuError("The submitted menu is missing or too large.");
  try {
    return JSON.parse(value);
  } catch {
    throw new MenuError("The submitted menu is invalid.");
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MenuError("Invalid menu item.");
  return value as Record<string, unknown>;
}
export function array(value: unknown, label: string, max: number) {
  if (!Array.isArray(value) || !value.length || value.length > max)
    throw new MenuError(`${label} must contain 1–${max} items.`);
  return value as unknown[];
}
export function versionDate(value: string | null) {
  const date = new Date(value ?? "");
  if (!Number.isFinite(date.getTime()))
    throw new MenuError("Reload this page before saving.");
  return date;
}
export function nextVersion(date: Date) {
  return new Date(Math.max(Date.now(), date.getTime() + 1));
}
export function normalizedName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}
