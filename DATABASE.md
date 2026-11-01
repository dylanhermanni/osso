# Database

Alle migraties staan in `supabase/migrations`, in oplopende volgorde. Gebruik een nieuw Supabase-project. Een bestaande productieomgeving moet altijd eerst een back-up en een gecontroleerde migratie krijgen.

## Hoofdstructuur

| Domein      | Tabellen                                                                        |
| ----------- | ------------------------------------------------------------------------------- |
| Identiteit  | profiles, households, household_members, household_invitations                  |
| Ruimtes     | rooms, room_photos                                                              |
| Inspiratie  | ideas, idea_photos, idea_comments                                               |
| Werk        | tasks, task_assignees, task_subtasks, task_comments, task_photos                |
| Projecten   | projects, project_phases, project_photos, suppliers                             |
| Financiën   | expenses, expense_payments, expense_shares, settlements, settlement_allocations |
| Budget      | budgets, savings_goals                                                          |
| Aankopen    | wishlist_items                                                                  |
| Agenda      | calendar_events                                                                 |
| Onderhoud   | maintenance_items, maintenance_history                                          |
| Dossier     | documents, private storage.objects                                              |
| Samenwerken | activity_log, notifications                                                     |

UUID's vormen de primary keys. Kindtabellen hebben een huishoudkolom en samengestelde foreign keys. De tabellen met bewerkbare hoofdrecords hebben `created_at`, `updated_at` en `version`; append-only historie heeft alleen een aanmaaktijd. Lidmaatschappen zijn koppelingen met een samengestelde sleutel.

## RPC's

- `create_household`, `create_invitation`, `accept_invitation`: veilige bootstrap, e-mailgebonden uitnodigingen met SHA-256-tokenhash, geldigheid en eenmalig gebruik.
- `record_expense`: betalings- en kostenaandelen, idempotentiesleutel, optionele aankoop.
- `record_refund`: gedeeltelijke of volledige retour met resterend bedrag/aandeel als bovengrens.
- `member_balance`: betalingen minus aandelen plus betaalde verrekeningen minus ontvangen verrekeningen, met tekenomkering voor retouren.
- `record_settlement`: actuele saldo-check onder huishoudlock.
- `reverse_financial`: auditbare correctie zonder verwijderen.
- `link_purchase`: product aan bestaande actieve uitgave koppelen.
- `complete_maintenance`: uitvoering en volgende datum atomair.
- `convert_idea`: idee één keer in taak of project omzetten.

`security definer`-functies hebben een vaste `search_path`, expliciete lidmaatschapschecks en beperkte execute-grants. Triggerfuncties zijn geen publiek uitvoerbare API.

## Opslag

`home-files/<household uuid>/<random uuid>` is een private objectnamespace. Uploads: JPEG, PNG, WebP en PDF, maximaal 3 MB. De server controleert de magic bytes. Downloadlinks verlopen na 60 seconden. Documentmetadata kan gekoppeld zijn aan kamer, project, taak, uitgave of onderhoud. Voor projecten hebben foto's een Voor/Tijdens/Na-label.

## Nog niet volledig gebruikt

`task_assignees` ondersteunt toekomstige meervoudige toewijzingen; de eerste UI gebruikt één verantwoordelijke of Samen. `settlement_allocations` is voorbereid maar het saldo wordt uit het volledige grootboek afgeleid; de UI deelt verrekeningen niet over specifieke uitgaven toe. `notifications` is voorbereid; de huidige herinneringenweergave wordt uit taken en agenda afgeleid. Projecten hebben voorlopig één primaire kamer, geen UI voor meerdere kamers tegelijk.
