\set ON_ERROR_STOP on
begin;
create temporary table results(name text);
grant all on results to authenticated;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;insert into results values(label);end$$;
create function pg_temp.expect_error(statement text,pattern text,label text) returns void language plpgsql as $$declare failed boolean=false;begin begin execute statement;exception when others then if sqlerrm not ilike '%'||pattern||'%' then raise exception 'Unexpected failure in %: %',label,sqlerrm;end if;failed=true;end;if not failed then raise exception 'FAIL (no exception): %',label;end if;insert into results values(label);end$$;
insert into auth.users values('11111111-1111-4111-8111-111111111111','dylan@example.test'),('22222222-2222-4222-8222-222222222222','floor@example.test'),('33333333-3333-4333-8333-333333333333','other@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.email','dylan@example.test',true);
select create_household('Ons Huis','Dylan') h1 \gset
select pg_temp.assert_true((select count(*)=1 from households),'Huishouden aanmaken');
select create_invitation(:'h1','floor@example.test') invitation \gset
select pg_temp.expect_error(format('select create_household(%L,%L)','Nog een','Dylan'),'al een huishouden','Dubbel huishouden voorkomen');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claim.email','other@example.test',true);
select create_household('Ander huis','Ander') h2 \gset
select pg_temp.assert_true((select count(*)=1 from households),'Huishoudenscheiding bij lezen');
select pg_temp.expect_error(format('select accept_invitation(%L,%L)',:'invitation','Ander'),'ander e-mailadres','Uitnodiging controleert e-mailadres');
select pg_temp.expect_error(format('insert into rooms(household_id,title) values(%L,%L)',:'h1','Verboden'),'row-level security','RLS blokkeert schrijven in ander huis');
select pg_temp.expect_error(format('select create_invitation(%L,%L)',:'h1','x@example.test'),'Geen toegang','Geen uitnodiging voor ander huis');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claim.email','floor@example.test',true);
select accept_invitation(:'invitation','Floor');
select pg_temp.assert_true((select count(*)=2 from household_members),'Partner sluit aan');
select pg_temp.expect_error(format('select accept_invitation(%L,%L)',:'invitation','Floor'),'ongeldig','Uitnodiging eenmalig');
select pg_temp.assert_true((select count(*)=2 from profiles),'Profielen alleen voor medebewoners');
insert into rooms(household_id,title,width_cm,length_cm) values(:'h1','Woonkamer',500,400) returning id room \gset
select pg_temp.assert_true((select width_cm*length_cm=200000 from rooms where id=:'room'),'Kamer bewaren');
insert into projects(household_id,title,room_id,budget_cents) values(:'h1','Nieuwe vloer',:'room',250000) returning id project \gset
insert into tasks(household_id,title,room_id,project_id) values(:'h1','Vloer kiezen',:'room',:'project') returning id task \gset
update tasks set status='Afgerond' where id=:'task' and version=1;
select pg_temp.assert_true((select version=2 and status='Afgerond' from tasks where id=:'task'),'Taak afronden en versienummer verhogen');
with changed as(update tasks set status='Bezig' where id=:'task' and version=1 returning id) select pg_temp.assert_true((select count(*)=0 from changed),'Verouderde versie kan niet overschrijven');
select pg_temp.expect_error(format('update tasks set household_id=%L where id=%L',:'h2',:'task'),'Onveranderlijke eigenaar','Verhuizen tussen huishoudens verboden');
insert into ideas(household_id,title,room_id) values(:'h1','Groene muur',:'room') returning id idea \gset
insert into idea_comments(household_id,idea_id,body) values(:'h1',:'idea','Mooi!');
select pg_temp.assert_true((select count(*)=1 from idea_comments),'Reactie opslaan');
select convert_idea(:'h1',:'idea','projects',1) converted \gset
select pg_temp.assert_true((select status='Uitgevoerd' and project_id=:'converted' from ideas where id=:'idea'),'Idee transactioneel omzetten');
select pg_temp.expect_error(format('select convert_idea(%L,%L,%L,1)',:'h1',:'idea','tasks'),'gewijzigd','Idee niet dubbel omzetten');
select record_expense(:'h1',jsonb_build_object('title','Verf','amount_cents',1001,'expense_date','2026-11-01','category','Verf','project_id',:'project'), '[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":1001}]','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":501},{"user_id":"22222222-2222-4222-8222-222222222222","amount_cents":500}]','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') expense \gset
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=500,'Dylan ontvangt exact 500 cent');
select pg_temp.assert_true(member_balance(:'h1','22222222-2222-4222-8222-222222222222')=-500,'Floor betaalt exact 500 cent');
select pg_temp.assert_true((select sum(amount_cents)=1001 from expenses where project_id=:'project'),'Projectkosten tellen één keer');
select record_expense(:'h1','{}','[]','[]','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') same_expense \gset
select pg_temp.assert_true(:'same_expense'=:'expense','Idempotente uitgave');
select pg_temp.expect_error(format('select record_expense(%L,%L,%L,%L,%L)',:'h1','{"title":"Fout","amount_cents":100,"expense_date":"2026-11-01","category":"Test"}','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":90}]','[{"user_id":"22222222-2222-4222-8222-222222222222","amount_cents":100}]','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'exact overeenkomen','Verkeerde betaalsom geweigerd');
select pg_temp.expect_error(format('insert into expenses(household_id,title,amount_cents,expense_date,category,idempotency_key) values(%L,%L,100,current_date,%L,gen_random_uuid())',:'h1','Bypass','Test'),'permission denied','Direct schrijven om financiële transactie heen verboden');
select record_settlement(:'h1','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',500,'cccccccc-cccc-4ccc-8ccc-cccccccccccc') settlement \gset
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=0 and member_balance(:'h1','22222222-2222-4222-8222-222222222222')=0,'Verrekening brengt beide saldi op nul');
select pg_temp.assert_true((select sum(amount_cents)=1001 from expenses),'Verrekening telt niet als huisuitgave');
select record_settlement(:'h1','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',500,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select pg_temp.assert_true((select count(*)=1 from settlements),'Dubbele verrekening met zelfde sleutel voorkomen');
select pg_temp.expect_error(format('select record_settlement(%L,%L,%L,500,gen_random_uuid())',:'h1','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'),'Saldo gewijzigd','Tweede verrekening kan schuld niet nogmaals afboeken');
select reverse_financial(:'h1',:'settlement','settlements');
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=500,'Verrekening terugdraaien herstelt saldo');
select reverse_financial(:'h1',:'expense','expenses');
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=0,'Uitgave terugdraaien herstelt saldo');
insert into wishlist_items(household_id,title,price_cents) values(:'h1','Lamp',1000) returning id product \gset
select pg_temp.expect_error(format('update wishlist_items set status=%L where id=%L','Gekocht',:'product'),'aankooptransactie','Aankoop vereist transactie');
select record_expense(:'h1','{"title":"Lamp","amount_cents":1000,"expense_date":"2026-11-01","category":"Verlichting"}','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":1000}]','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":500},{"user_id":"22222222-2222-4222-8222-222222222222","amount_cents":500}]','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'product') purchase_expense \gset
select pg_temp.assert_true((select status='Gekocht' and expense_id=:'purchase_expense' from wishlist_items where id=:'product'),'Aankoop en uitgave atomair gekoppeld');
select pg_temp.expect_error(format('select record_expense(%L,%L,%L,%L,gen_random_uuid(),%L)',:'h1','{"title":"Dubbel","amount_cents":1000,"expense_date":"2026-11-01","category":"Test"}','[]','[]',:'product'),'exact overeenkomen','Ongeldige aankoop rollback');
select pg_temp.expect_error(format('select link_purchase(%L,%L,%L,1)',:'h1',:'product',:'purchase_expense'),'al gekoppeld','Gekocht product niet opnieuw koppelen');
select record_refund(:'h1',:'purchase_expense','{"title":"Retour lamp","amount_cents":200,"expense_date":"2026-11-02"}','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":200}]','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":100},{"user_id":"22222222-2222-4222-8222-222222222222","amount_cents":100}]','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') refund \gset
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=400,'Gedeeltelijke terugbetaling corrigeert saldo');
select pg_temp.assert_true((select sum(amount_cents*case when refund_of is null then 1 else -1 end)=800 from expenses where reversed_at is null),'Terugbetaling vermindert netto-uitgaven');
select pg_temp.expect_error(format('select record_refund(%L,%L,%L,%L,%L,gen_random_uuid())',:'h1',:'purchase_expense','{"title":"Te veel retour","amount_cents":801,"expense_date":"2026-11-02"}','[]','[]'),'hoger dan resterende','Niet meer retourneren dan betaald');
select reverse_financial(:'h1',:'refund','expenses');
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=500,'Terugbetaling terugdraaien herstelt saldo');
select record_refund(:'h1',:'purchase_expense','{"title":"Retour lamp","amount_cents":400,"expense_date":"2026-11-02"}','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":400}]','[{"user_id":"11111111-1111-4111-8111-111111111111","amount_cents":200},{"user_id":"22222222-2222-4222-8222-222222222222","amount_cents":200}]','ffffffff-ffff-4fff-8fff-ffffffffffff');
select reverse_financial(:'h1',:'purchase_expense','expenses');
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111')=0,'Correctie van oorspronkelijke uitgave corrigeert ook retouren');
select pg_temp.assert_true((select expense_id is null from wishlist_items where id=:'product'),'Teruggedraaide aankoop maakt product weer beschikbaar');
insert into maintenance_items(household_id,title,frequency_months,due_date) values(:'h1','Filters',1,'2026-01-31') returning id maintenance \gset
select complete_maintenance(:'h1',:'maintenance',1,'2026-01-31',2500);
select pg_temp.assert_true((select due_date='2026-02-28' from maintenance_items where id=:'maintenance'),'Onderhoud herhaalt correct bij maandgrens');
select pg_temp.assert_true((select count(*)=1 from maintenance_history where maintenance_id=:'maintenance'),'Onderhoudshistorie bewaard');
select pg_temp.expect_error(format('select complete_maintenance(%L,%L,1,%L,2500)',:'h1',:'maintenance','2026-01-31'),'gewijzigd','Dubbele uitvoering met oude versie geweigerd');
select pg_temp.expect_error(format('insert into documents(household_id,title,storage_path,filename,mime_type,bytes) values(%L,%L,%L,%L,%L,100)',:'h1','Onveilig',:'h2'||'/secret','test.pdf','application/pdf'),'document_folder','Document kan niet verwijzen naar ander huishouden');
insert into storage.objects(bucket_id,name) values('home-files',:'h1'||'/private-test');
select pg_temp.assert_true((select count(*)=1 from storage.objects),'Eigen privébestand zichtbaar');
select pg_temp.assert_true((select count(*)>0 from activity_log),'Audittrail voor mutaties');
insert into task_comments(household_id,task_id,body,user_id) values(:'h1',:'task','Een opmerking','11111111-1111-4111-8111-111111111111');
select pg_temp.assert_true((select user_id=auth.uid() from task_comments where task_id=:'task'),'Commentaar kan auteur niet vervalsen');
insert into suppliers(household_id,title,project_id,email) values(:'h1','Vakman',:'project','vakman@example.test');
select pg_temp.assert_true((select count(*)=1 from suppliers),'Leverancier bij project bewaard');
insert into documents(household_id,title,project_id,storage_path,filename,mime_type,bytes) values(:'h1','Voorfoto',:'project',:'h1'||'/photo','voor.png','image/png',100) returning id document \gset
insert into project_photos(household_id,project_id,storage_path,caption) values(:'h1',:'project',:'h1'||'/photo','Voor');
select pg_temp.assert_true((select count(*)=1 from project_photos),'Project voorfoto gekoppeld');
select delete_document(:'h1',:'document',1);
select pg_temp.assert_true((select count(*)=0 from project_photos),'Document verwijderen ruimt galerijkoppeling op');
select pg_temp.assert_true((select count(*)=0 from documents where id=:'document'),'Documentmetadata transactioneel verwijderd');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select pg_temp.assert_true((select count(*)=0 from storage.objects),'Privébestanden gescheiden');
select pg_temp.assert_true((select count(*)=0 from expenses),'Financiële gegevens gescheiden');
select pg_temp.expect_error(format('insert into tasks(household_id,title,room_id) values(%L,%L,%L)',:'h2','Kruislink',:'room'),'foreign key','Cross-household foreign key geweigerd');
select pg_temp.assert_true(member_balance(:'h1','11111111-1111-4111-8111-111111111111') is null,'Geen saldo-inzage via RPC buiten huishouden');
select count(*) as passed_database_assertions from results;
rollback;
