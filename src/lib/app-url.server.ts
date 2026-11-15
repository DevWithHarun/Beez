// Stable public address of the published Beez app, used for provider callbacks and message links.
export function publicAppUrl(): string {
  return (
    process.env["APP_PUBLIC_URL"]?.trim().replace(/\/+$/, "") ||
    "https://project--224ff9e4-b294-4f8d-a431-00bc61f61da3.lovable.app"
  );
}
