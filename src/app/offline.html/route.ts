import { serverCopy } from "@/lib/site-copy/server";
export const dynamic = "force-dynamic";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export async function GET() {
  const [title, heading, description, retry] = await Promise.all([
    serverCopy("Cheese the Rooster · offline"),
    serverCopy("Even offline."),
    serverCopy(
      "Maak verbinding met internet om je huisgegevens veilig te bekijken en te wijzigen.",
    ),
    serverCopy("Opnieuw proberen"),
  ]);
  return new Response(
    `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>body{font:18px system-ui;background:#faf9f6;color:#253129;max-width:500px;margin:20vh auto;padding:24px}a{color:#356148}</style><h1>${escape(heading)}</h1><p>${escape(description)}</p><a href="/">${escape(retry)}</a></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
