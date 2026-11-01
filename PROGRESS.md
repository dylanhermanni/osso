# Voortgang · Ons Huis

Bijgewerkt op 1 november 2026 (Europe/Amsterdam).

De applicatie werkt met een echte lokale Supabase-stack: PostgreSQL, Auth, private Storage en Realtime. De omgeving bevat geïsoleerde, synthetische testhuishoudens; er worden geen voorbeeldgegevens als jullie eigen huisgegevens gepresenteerd. Maak voor echt gebruik eigen accounts en een eigen huishouden.

## Geïmplementeerd

- Warme responsive interface, vaste desktopzijbalk, mobiele navigatie, lokale DM Sans/Fraunces-fonts en interieurillustraties, dialogs, skeletons, leesbare formulieren, foutmeldingen, lege staten en toastmeldingen.
- Afzonderlijke accounts, inloggen/uitloggen, huishoudbootstrap en eenmalige uitnodigingen op het e-mailadres van de partner.
- Kamers met maten, verf, materialen, sorteerpositie, archivering en gekoppelde gegevens.
- Inspiratie met statussen, tags, favorieten, reacties, privéfoto's en transactionele conversie naar taak/project.
- Taken met prioriteit, deadline, verantwoordelijke of Samen, tijdsinschatting, subtaken, opmerkingen, foto's/bijlagen en lijst/kanban/per kamer/per persoon/kalender.
- Projecten met budget, automatisch afgeleide kosten, taken/fases, berekende voortgang, leveranciers, documenten en Voor/Tijdens/Na-galerij.
- Uitgaven in integer centen, meerdere betalers, gelijke/gewogen/eigen percentages/vaste/persoonlijke aandelen, idempotentie, verrekeningen, terugdraaien, gedeeltelijke retouren, budgetten, spaardoelen en beveiligde CSV-export.
- Uitgavengrafieken per maand, categorie, kamer en project, betaald per persoon en budgetwaarschuwingen.
- Verlanglijst met winkels, links, prijzen, aantallen en atomaire aankoopregistratie of koppeling aan een bestaande uitgave.
- Kalender in maand/week/dag/lijst, gekoppelde taken/projecten en Amsterdamse tijdzone. Niet-bestaande of dubbele overgangstijden worden expliciet afgewezen.
- Onderhoud met uitvoeringshistorie en automatisch berekende volgende datum op basis van kalendermaanden.
- Privédocumenten en bijlagen, controle op MIME-type én bestandssignatuur, maximaal 3 MB. Documentverwijdering ruimt galerijkoppelingen op.
- Globaal zoeken, filters, daadwerkelijk geauthenticeerde realtime-abonnementen, versiecontrole, activiteitenlog en afgeleide in-app herinneringen.
- PWA-manifest, PNG-iconen en statische offlinepagina. Geen offline opslag van privégegevens of ongecontroleerde offline mutaties.
- Reproduceerbare migraties, installatie/starthelpers, CI-workflow en gescheiden domein-, database- en browsertests.

## Aangetoond

| Controle                       | Resultaat en grens                                                                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installatie uit lockfile       | `npm ci --no-audit --no-fund` geslaagd                                                                                                                                                                                                                                              |
| Lint en TypeScript strict      | Geslaagd                                                                                                                                                                                                                                                                            |
| Domein/validatie               | 29 tests geslaagd; centen, afronding, saldi, CSV, invoer en zomer/wintertijd                                                                                                                                                                                                        |
| Schone PostgreSQL-testdatabase | 53 asserties geslaagd via `npm run test:database`; migraties, RLS, uitnodigingen, samengestelde FK's, conflicten, transacties, retouren, aankopen, onderhoud, auteurschap en documentverwijdering                                                                                   |
| Zonder backend                 | 10 browsercases op desktop en mobiele Chromium-emulatie; navigatie, lege staten, configuratiemelding, modals, kalenderweergaven, PWA-assets en geen horizontale overflow                                                                                                            |
| Met echte Supabase-services    | 4 browsercases geslaagd: twee scenario's op desktop en mobiel, met accounts, uitnodigingen, live partnerupdates, gegevens na herladen, uitgaven/verrekening, privéuploads, toegang buiten het huishouden, opnieuw inloggen, foto's, projectvoortgang, aankopen, onderhoud en agenda |
| Negatieve uploadflow           | HTML met PDF-mimetype wordt afgewezen met een begrijpelijke melding, ook in productiebuild; daarna slaagt een echte PDF-upload                                                                                                                                                      |
| Productiebuild                 | Geslaagd met lokale Supabase-instellingen en afzonderlijk zonder backend                                                                                                                                                                                                            |
| Dependencies                   | `npm audit --omit=dev`: geen bekende kwetsbaarheden ten tijde van de controle                                                                                                                                                                                                       |
| Herstart backend               | Herhaald gestart met behoud van `.env.local` en gegevens                                                                                                                                                                                                                            |

De minimale PostgreSQL-fixture bootst alleen de platformschemas na; daarom zijn de daadwerkelijke Supabase Auth-, Storage- en Realtime-services daarnaast apart in de browser getest. De browserchecks zijn Chromium en mobiele emulatie, geen fysieke iPhone/Safari-tests.

## Gevonden en hersteld tijdens integratie

- De lokale BusyBox-healthcheck negeerde `no_proxy`. Een gerichte, herbruikbare wrapper beperkt de uitzondering tot de eigen loopback-healthcheck; externe proxy en TLS blijven behouden.
- Supabase installeert pgcrypto in `extensions`; cryptografische uitnodigingsfuncties gebruiken nu expliciet die namespace.
- Realtime opende aanvankelijk anoniem. Abonnementen krijgen nu expliciet een token uit de geverifieerde eigen gebruikerssessie; de partnerupdate is daarna echt getest.
- Handmatige projectinvoer stuurde een onbestaande `project_id` naar `projects`; schema, formulier en een regressietest zijn gecorrigeerd.
- Het mobiele profielmenu wordt bij het openen van instellingen gesloten.
- Verwachte serveractiefouten worden als getypeerd resultaat teruggegeven; Next.js maskeert begrijpelijke validatiemeldingen daardoor niet in productie.

## Opstartconfiguratie

`install_script` en `start_skill` zijn opgeslagen in de conceptconfiguratie van deze cloudomgeving. Opslaan publiceert of activeert die configuratie niet; bekijk en bewaar haar in de omgevingsinstellingen en publiceer de omgeving om haar te activeren. Er wordt geen herstel van lokale, nog niet gepushte commits in een nieuwe taak geclaimd.

De ontwikkelserver is gestart met `npm run dev`; een echte HTTP-aanvraag gaf status 200 met het verwachte Ons Huis-scherm. Werkende processen moeten na een nieuwe omgevingstaak opnieuw gestart worden.

## Voor productie nog nodig

1. Een **hosted Supabase-project** met uitgevoerde migraties, publieke appconfiguratie, juiste netwerktoegang tot het project en een eigen backupbeleid.
2. De echte productie-URL, Supabase Auth Site URL en eigen SMTP-instellingen, met e-mailbevestiging actief.
3. Eigen accounts voor Dylan en Floor en een uitnodiging naar het echte e-mailadres van de partner. Lokale testaccounts zijn uitsluitend testfixtures.
4. De code staat op GitHub (`dylanhermanni/osso`, branch `main`). Vercel-publicatie en een nieuwe controle tegen die hosted omgeving zijn nog nodig. Er is nog geen Vercel-deployment.
5. Installatie/downloadgedrag op fysieke iPhone/Android controleren. De downloadflow opent het tabblad vóór het ophalen van een verse ondertekende URL om Safari-popupblokkades te vermijden, maar Safari is hier niet uitgevoerd.

## Bewuste grenzen en vervolgwerk

- Uitnodigingslinks worden zelf gedeeld; geen automatische uitnodigingsmail.
- Herinneringen zijn in-app; geen e-mail/push of achtergrondworker.
- De eerste interface opent één huishouden en één primaire kamer per project. Meerdere huishoudens zijn wel door het datamodel gescheiden.
- Geen drag-and-drop; kamerordening gaat via een positieveld en taakstatus via een keuzelijst.
- Geen voor/na-schuifvergelijker of vrij moodboardcanvas; wel gelabelde privéfotogalerijen.
- Meervoudige taaktoewijzing, persistente notificatie-inbox, uitgebreide projecttijdlijn, recent bekeken geschiedenis en grotere directe uploads zijn nog niet uitgewerkt.
- Verrekeningen worden op het actuele totaalsaldo gebaseerd; `settlement_allocations` wordt nog niet gebruikt om één verrekening aan individuele uitgaven toe te rekenen.
- Alle huishoudgegevens worden gepagineerd geladen, maar de eerste UI houdt één gezamenlijke snapshot. Verdere splitsing in gerichte modulequeries is nuttig bij zeer grote dossiers.

De betrouwbare kern is functioneel en getest. Dit is geen verklaring dat iedere aanvullende wens uit de masterprompt of de volledige hosted productieacceptatie al is afgerond.

## Publicatiestatus · 1 november 2026

De geteste implementatie is naar de eerder lege GitHub-repository gepusht en de remote `main` is gecontroleerd. Publicatie is door de gebruiker opgedragen. De daadwerkelijke Supabase- en Vercel-beheerrequests worden momenteel door de beheerde netwerkproxy met HTTP 403 geweigerd. `api.supabase.com` en `api.vercel.com` staan al in de opgeslagen conceptconfiguratie, maar die netwerktoegang is nog niet actief in de draaiende omgeving. Het activeren/publiceren van de omgevingsinstellingen vereist een handeling in de productinterface; daarvoor is hier geen uitvoerbare tool beschikbaar. Er is geen toegangstoken in broncode, commits of deze documentatie opgenomen.
