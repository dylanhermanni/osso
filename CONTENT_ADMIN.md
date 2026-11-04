# Tekstbeheer

Open `/admin/teksten`, of kies **Alle websiteteksten aanpassen** in de profielinstellingen. Log eerst in met het bestaande account van de site-eigenaar. Alleen de gebruiker in `site_content_admins` heeft publicatierechten; normale accounts en anonieme bezoekers kunnen uitsluitend de gepubliceerde teksten lezen.

## Gebruik

- Zoek op de bestaande of aangepaste tekst en filter op onderdeel.
- Selecteer een tekst en wijzig het veld **Jouw tekst**. Het voorbeeld is een concept; **Opslaan** publiceert de wijziging voor alle bezoekers.
- Dezelfde standaardtekst wordt overal tegelijk vervangen. Bewaar invulvelden zoals `{1}` en `{2}` precies één keer; de app vult hier de actuele naam of waarde in.
- **Standaard herstellen** zet één tekst terug. Onder **Vorige versies** kun je een oudere tekst als concept terughalen en opnieuw opslaan.
- Andere geopende tabbladen halen teksten bij focus en iedere 30 seconden opnieuw op. Een verse pagina haalt ze direct op. Geïnstalleerde appnamen en iconen kunnen door het besturingssysteem gecachet blijven.

Tekstbeheer omvat de vaste interface, velden, knoppen, menu's, meldingen, kalenderlabels, browsertitel, appmanifest en offlinepagina. Eigen kamernamen, taken, uitgaven, accountgegevens en andere huishoudinhoud blijven in hun bestaande modules te bewerken. Technische identificatoren, financiële bedragen, interne statuswaarden en formulierwaarden worden niet gewijzigd door tekstbeheer. De beheerinterface zelf houdt vaste labels, zodat herstel altijd bereikbaar blijft.

## Ontwikkeling en beveiliging

- Voer `202611040009_site_copy.sql` uit. De productie-initialisatie verwijst uitsluitend naar de bestaande gebruikers-ID van de site-eigenaar. Voor een andere installatie moet de databasebeheerder bewust de juiste gebruiker toevoegen.
- `scripts/extract-copy.mjs` bouwt bij iedere productiebuild de tekstcatalogus. Nieuwe eigen React-componenten gebruiken `CopyScope` rond hun gerenderde inhoud; externe componenten krijgen vertaalde labels via hun API.
- Er wordt gewone React-tekst gerenderd, nooit HTML uit de database. Enumwaarden en invoerwaarden blijven intact. De server valideert bekende sleutels, lengte en invulvelden; de database controleert de beheerder onafhankelijk.
- Een opgeslagen wijziging krijgt een versienummer en geschiedenis. Een concept bewaart zijn oorspronkelijke versie; verouderde wijzigingen worden geweigerd in plaats van overschreven.
- `.env.local` bevat uitsluitend de bestaande publieke projectconfiguratie en blijft buiten Git.

Verificatie: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. `tests/database/site-copy.sql` controleert anonieme toegang, niet-beheerders, eigenaar, versies, herstel en geschiedenis binnen één teruggedraaide transactie. Die databasecontrole simuleert gebruikersclaims; zij vervangt geen browsercontrole van het echte inloggen.
