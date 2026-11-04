import { loadSiteCopy } from "@/lib/site-copy/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const { records, ready } = await loadSiteCopy();
  // Only published, public website text. No account, history or household data.
  return Response.json(
    { records, ready },
    { headers: { "Cache-Control": "no-store" } },
  );
}
