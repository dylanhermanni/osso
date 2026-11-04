import Link from "next/link";
import { CopyScope } from "@/components/content-provider";
export default function NotFound() {
  return (
    <CopyScope>
      <main className="copy-access">
        <p className="eyebrow">PAGINA NIET GEVONDEN</p>
        <h1>Hier zijn we de weg even kwijt.</h1>
        <p>Deze pagina bestaat niet of is verplaatst.</p>
        <Link className="button button-primary" href="/">
          Terug naar het overzicht
        </Link>
      </main>
    </CopyScope>
  );
}
