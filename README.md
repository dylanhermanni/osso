# Ons Huis

Alles voor ons thuis, op één plek. Een Nederlandse Next.js-app voor Dylan en Floor, met een gedeeld huishouden, kamers, inspiratie, taken, projecten, financiën, verlanglijst, kalender, onderhoud en privébestanden.

## Ontwikkelen

Node.js 22 of 24 en npm. Gebruik de bestaande checkout; iedere cloudtaak is al geïsoleerd. Maak geen extra worktree.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Zonder Supabase toont de app een expliciete configuratiemelding en lege overzichten. Er zijn geen fictieve huisgegevens en wijzigingen worden niet in localStorage nagebootst.

## Supabase koppelen

1. Maak een Supabase-project aan. Kopieer de **Project URL** en de **publishable key** (de oudere publieke anon-key wordt ook geaccepteerd) naar `.env.local`. Gebruik **nooit** de service-role key voor een `NEXT_PUBLIC_`-variabele.
2. Voer alle SQL-bestanden in `supabase/migrations` in bestandsvolgorde uit met de SQL-editor, of koppel de CLI (`npx supabase link`) en gebruik `npx supabase db push`. De migraties zijn bedoeld voor een nieuw Supabase-project.
3. Zet bij Authentication → URL Configuration de Site URL op de echte app-URL. Activeer e-mailbevestiging en configureer een eigen SMTP-provider voor productie. De app gebruikt Supabase e-mail/wachtwoordauthenticatie; de bevestigingslink leidt terug naar de app, waarna je inlogt.
4. Start Next.js opnieuw nadat publieke omgevingsvariabelen gewijzigd zijn; voor een productiebuild moet je opnieuw bouwen.
5. Dylan maakt een account en daarna een huishouden aan. Via het profiel → instellingen maakt hij een uitnodiging op Floors e-mailadres. Deel die link zelf met Floor. Floor maakt een eigen account, logt in en accepteert de uitnodiging. Codes zijn eenmalig en zeven dagen geldig.

De bucket `home-files` wordt privé aangemaakt. RLS en samengestelde foreign keys beschermen de huishoudenscheiding. Er is geen service-role key nodig voor de applicatie.

## Volledig lokaal met Supabase

Docker moet beschikbaar zijn. De CLI is opgenomen in de lockfile.

```bash
npm run backend:start
npx supabase migration up --local
npm run dev
```

De cloudhelper start de officiële Supabase-images via Docker Hub en schrijft uitsluitend de publieke lokale API-instellingen naar `.env.local` wanneer dat bestand nog niet bestaat. Een bestaand bestand blijft intact. Er wordt geen privileged key naar de app gekopieerd.

In deze cloudomgeving negeert de BusyBox-healthcheck `no_proxy`. De helper plaatst daarom in de twee lokale containers een wrapper die **uitsluitend** verzoeken naar de eigen loopback-healthcheck rechtstreeks uitvoert. Externe verbindingen blijven via de ingestelde proxy lopen; TLS-verificatie blijft aan. De helper is tweemaal te gebruiken zonder bestaande gegevens of configuratie te resetten.

Buiten deze beheerde Linux-omgeving kun je de normale `npx supabase start` gebruiken en zelf de lokale publieke API-instellingen overnemen. Lokale e-mailbevestiging staat uit in `supabase/config.toml`; zet deze voor productie aan in de hosted instellingen. `npx supabase stop` stopt alleen de lokale services; gebruik geen destructieve reset op gegevens die je wilt bewaren.

## Controles

```bash
npm run lint
npm run typecheck
npm test
npm run test:database # aparte tijdelijke PostgreSQL-container
npm run build
npm run test:e2e
```

De standaard browsertests controleren de configuratiestand zonder Supabase. Een aanwezig systeem-Chromium wordt automatisch gebruikt; elders: `npx playwright install chromium`. Database-integratietests staan in `tests/database`: de bootstrap is **alleen** voor een lege tijdelijke PostgreSQL-testdatabase. Het nabootsen van `auth.uid()` daarin test databaseautorisatie, niet de echte Supabase Auth-service.

Met een build die de lokale Supabase-configuratie gebruikt:

```bash
npm run build
npm run test:connected
```

Dit zijn vier echte browserflows (twee scenario's op desktop en mobiel) met afzonderlijke testaccounts, realtime-updates, financiële mutaties, private uploads, onderhoud, aankopen en kalender. Testaccounts gebruiken uitsluitend synthetische `example.com`-adressen en eigen afgeschermde testhuishoudens. De tests zijn voor een **wegwerpbare lokale backend**, niet voor productie.

De configuratiestand kun je ondanks een lokale `.env.local` apart testen:

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run test:e2e -- app.spec.ts
# Bouw daarna opnieuw met de gewone lokale instellingen.
npm run build
```

Zie [PROGRESS.md](PROGRESS.md) voor actuele resultaten, beperkingen en aanvullende volledige-backendtests.

## Publiceren op Vercel

Importeer deze repository als Next.js-project. Stel de drie variabelen uit `.env.example` in voor de gewenste omgeving, met de hosted Supabase-URL en de publieke key. Voer de migraties uit vóór de eerste echte gebruikerssessie. Stel dezelfde productie-URL in bij Supabase Auth. Bouw met `npm run build`; Vercel gebruikt de standaard Next.js-instellingen.

Uploads zijn beperkt tot **3 MB** voor JPG, PNG, WebP en PDF, met controle op bestandssignaturen en een private bucket. Dit houdt Server Action-verzoeken onder Vercels requestlimiet. Voor grotere bestanden is een aparte directe uploadflow nodig.

De PWA is installeerbaar met manifest en PNG-iconen. Offline wordt uitsluitend een statische verbindingsmelding getoond. Geauthenticeerde pagina's en gegevens worden niet offline gecachet. Push, e-mailherinneringen en volledige offline synchronisatie zijn niet geïmplementeerd.

De code is gepubliceerd op `main` van `dylanhermanni/osso`. De app is nog niet op Vercel gepubliceerd. De publicatie-API’s van Supabase en Vercel worden in de huidige cloudomgeving nog geblokkeerd; de benodigde domeinen staan klaar in de conceptconfiguratie en moeten via de omgevingsinstellingen worden geactiveerd.
