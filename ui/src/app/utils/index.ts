export function parseString(value: unknown): string {
  return typeof value === "string" ? value.toString() : "";
}
