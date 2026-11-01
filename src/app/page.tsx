import { loadSnapshot } from "@/lib/data";
import { DateTime } from "luxon";
import { App } from "@/components/app";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [data, params] = await Promise.all([loadSnapshot(), searchParams]);
  return (
    <App
      data={data}
      initialView={typeof params.view === "string" ? params.view : "home"}
      initialToken={typeof params.invite === "string" ? params.invite : ""}
      weekEnd={DateTime.now()
        .setZone("Europe/Amsterdam")
        .plus({ days: 7 })
        .toISODate()!}
    />
  );
}
