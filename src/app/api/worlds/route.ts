import { loadWorldData } from "@/lib/world-data";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await loadWorldData(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(
      "Station could not read a valid world snapshot. Check STATION_DATA_FILE and the data format.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
