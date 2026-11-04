import { serverCopy } from "@/lib/site-copy/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      id: "/",
      name: await serverCopy("Cheese the Rooster"),
      short_name: await serverCopy("Cheese"),
      description: await serverCopy("Alles voor ons thuis, op één plek."),
      lang: "nl",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#faf9f6",
      theme_color: "#66539d",
      icons: [
        {
          src: "/rooster-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/rooster-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/rooster-icon-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
