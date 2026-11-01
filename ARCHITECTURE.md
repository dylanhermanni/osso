# Architectuur

## Technische keuzes

- Next.js App Router, React, TypeScript strict en Tailwind 4.
- `src/components/ui` bevat het shadcn-patroon met Radix Dialog, Slot en CVA. Lucide verzorgt iconen; React Hook Form en Zod de basisformulieren en servervalidatie.
- Supabase SSR-clients gebruiken sessiecookies. `src/proxy.ts` vernieuwt authenticatiecookies; iedere serveractie verifieert de gebruiker opnieuw.
- `src/lib/data.ts` laadt de snapshot via de **gebruikerssessie**, gepagineerd zodat Supabases standaardrijlimiet financiële totalen niet stil afkapt.
- `src/app/actions.ts` scheidt mutaties van presentatie. Entiteiten zijn expliciet toegestaan; financiële acties zijn uitsluitend RPC-transacties.
- `src/lib/domain` bevat onafhankelijk testbare logica voor centbedragen, kostenverdeling, saldi en Amsterdamse tijdzones.
- `src/components/app.tsx` verbindt navigatie en modules. Moduleoverzichten zijn via `?view=...` deelbaar. Details houden gerelateerde taken, documenten en uitgaven bij dezelfde kamer of hetzelfde project.
- FullCalendar wordt apart geladen; Recharts presenteert uitgaven. SVG-illustraties en fonts zijn lokaal beschikbaar.

## Beveiligingsgrenzen

1. De browser ontvangt uitsluitend publieke Supabase-configuratie.
2. Serveracties controleren authenticatie, lidmaatschap en invoer.
3. PostgreSQL RLS beschermt ook directe API-toegang.
4. Samengestelde foreign keys bevatten `household_id` en blokkeren links tussen verschillende huishoudens.
5. Financiële tabellen zijn niet rechtstreeks schrijfbaar voor appgebruikers. RPC's vergrendelen het huishouden om gelijktijdige verrekeningen/aankopen te serialiseren.
6. Bestandsbucket en downloadlinks zijn privé. Downloads hebben korte geldigheid. Geen SVG-, HTML- of uitvoerbare uploads.

## Samenwerking

Een Realtime-kanaal per huishouden met expliciete tabelabonnementen vernieuwt de snapshot. Het kanaal krijgt een kortlevend JWT uit een serveractie die de sessie en het lidmaatschap controleert. Dit token blijft alleen in clientgeheugen en wordt elke tien minuten vernieuwd; de service-role key komt nooit in de browser. Verwachte invoer- en autorisatiefouten worden als getypeerd actieresultaat teruggegeven, zodat Next.js-productiebuilds nuttige meldingen niet door een generieke foutdigest vervangen.

Mutaties bevatten een verwacht versienummer; een verouderde versie levert een fout op. De audittrigger voegt ook bij verwijderingen een huishoudelijk activiteitenrecord toe, zodat dat event de andere client kan vernieuwen. Voor subtaken/fases wordt de verwachte oude boolean gecontroleerd.

## Geld en correcties

Bedragen zijn integer eurocenten. Het grootste-restalgoritme verdeelt afrondingscenten deterministisch. Betalingen en aandelen zijn aparte rijen en moeten exact op het uitgavetotaal sluiten. Een product en de bijbehorende uitgave worden in één transactie geschreven. Retouren zijn aparte positieve databaserecords met `refund_of`; de domeinpresentatie maakt bedragen en allocaties negatief. Retouren mogen samen de oorspronkelijke uitgave of iemands oorspronkelijke kostenaandeel niet overschrijden.

Verrekeningen zijn een eigen grootboek, tellen niet als huisuitgave, en worden begrensd door het actuele saldo. Terugdraaien bewaart de audittrail. Het terugdraaien van een oorspronkelijke uitgave draait ook de bijbehorende retouren terug.

## Afwegingen

Geen achtergrondworker of pushdienst zolang die niet is ingericht. Herinneringen worden uit actuele afspraken/deadlines/onderhoud afgeleid. Een onderhoudsuitvoering plant de volgende datum transactioneel; een verlopen taak wordt niet automatisch als uitgevoerd beschouwd. Gevoelige data wordt niet offline opgeslagen.

De eerste UI gebruikt een gecombineerde client-shell en laadt alle huishoudgegevens. Bij omvangrijke dossiers is verdere opsplitsing in servergestuurde modulepagina's en gerichte realtime-invalidation wenselijk. Verificatie van de financiële database gebeurt los van browserchecks en daadwerkelijke Supabase-servicechecks.
