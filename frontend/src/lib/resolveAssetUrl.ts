export function resolveAssetUrl(input?: string | null): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  if (raw === "null" || raw === "undefined") return null;

  const lower = raw.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:")
  ) {
    return raw;
  }

  // If backend stores a relative path (e.g. /uploads/x.jpg),
  // serve it from the API origin (NEXT_PUBLIC_API_URL).
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

  if (raw.startsWith("/")) {
    return apiOrigin ? `${apiOrigin}${raw}` : raw;
  }

  // bare path like "uploads/x.jpg"
  return apiOrigin ? `${apiOrigin}/${raw}` : `/${raw}`;
}
