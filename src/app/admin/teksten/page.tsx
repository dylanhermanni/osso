import Link from "next/link";
import { loadSiteCopy } from "@/lib/site-copy/server";
import { ContentAdmin } from "@/components/content-admin";
export const dynamic = "force-dynamic";
export default async function TextAdminPage() {
  const data = await loadSiteCopy();
  if (!data.canEdit)
    return (
      <main className="copy-access">
        <h1>Tekstbeheer</h1>
        <p>
          {!data.ready
            ? "Tekstbeheer is nog niet aangesloten op de database."
            : data.signedIn
              ? "Dit account heeft geen toegang tot tekstbeheer."
              : "Log in met je beheerdersaccount om de websiteteksten aan te passen."}
        </p>
        <Link className="button button-primary" href="/">
          Naar de website
        </Link>
      </main>
    );
  return <ContentAdmin />;
}
