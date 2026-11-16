export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      for (const key of ["error", "message", "detail"]) {
        const value = (data as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}
export const errorStatus = (error: unknown) =>
  error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
