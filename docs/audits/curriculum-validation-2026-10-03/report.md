# Aanvullende scraper- en corpuscontrole — 3 oktober 2026

## Reviewaanvulling — 4 oktober 2026

Reviewbasis PR #35: `89855a1acc7daf82276017e95947367958e340f5`.
De onderstaande resultaten van 3 oktober blijven historisch bewijs. Deze aanvulling
beschrijft de twee nieuwe reviewbevindingen en de actuele Pythoncontrole; de volledige
GitHub-resultaten op de definitieve head worden in de PRbeschrijving vastgelegd.

**Overlappende pagina's.** De concrete pagina's `[A, B]` en `[B, C]`, beide met
`totalItems=4`, kwamen vóór de fix als vier records terug ondanks slechts drie unieke
doelen. De nieuwe regressie faalde op de reviewbasis. Ook een duplicaat binnen één pagina
en dezelfde code/context met gewijzigde tekst konden het totaal ten onrechte vullen.
Alle drie negatieve regressies falen vóór de fix en slagen daarna.

`fetch_all_goals` weigert nu overlap vóór het tellen/retourneren. Identiteit gebruikt
`code`, het volledige `onderwijsdoelenset`-object (inclusief onderwijsstructuur en
sleutelcompetentie), `onderwijsdoel_type` en `_dataset`, canoniek met gesorteerde objectkeys.
Doeltekst, notities en losse top-level responsemetadata zijn geen nieuwe identiteit.
Ontbreekt een code, dan gebruikt de controle het volledige ruwe record als conservatieve
fallback. Er worden geen doelcodes of contextvelden verzonnen of genormaliseerd.
Positieve regressies behouden dezelfde code in verschillende doelensets, opleidingsvormen,
doeltypes en datasets. Veldvolgorde maakt een doel niet uniek. Een overlappende of tussentijds
gewijzigde fetch moet opnieuw consistent worden opgehaald; er volgt geen stilzwijgende
deduplicatie die onvolledigheid als succes presenteert. De actuele bronschema's blijven
onbevestigd door de netwerkblokkade; geneste context is daarom volledig behouden.

**Redirects met API-keys.** De standaard urllib-opener kopieerde `x-api-key` naar een andere
host en bij HTTPS-naar-HTTP. Eigen loopbackservers ontvingen de synthetische key daadwerkelijk
vóór de fix. Er zijn ook lekpaden bevestigd bij POV-list, POV-detail en de oudere raw
minimumdoelen-API. Geen echte credentials of externe bestemming gebruikt.

| Curriculum-fetchpad | Header | Controle na reviewfix |
| --- | --- | --- |
| `onderwijsdoelen_api_client._get_json` | `x-api-key` | Echte urllib-opener met redirect-handler die vóór elke vervolgaanvraag weigert; 3xx blijft HTTPfout en wordt niet opnieuw geprobeerd |
| `SecondaryMinimumGoalsFetcher.run` | `apikey` | Bestaande `allow_redirects=False` en origincontrole behouden; nu ook met echte requests/servers bewezen |
| `PovCurriculumFetcher.run`, list én detail | `api-key` | Beide aanvragen `allow_redirects=False`; 3xx expliciet geweigerd |
| `MinimumdoelenFetcher._fetch_api` | `apikey` | `allow_redirects=False`; 3xx als mislukte bronaanvraag, geen export |
| Publieke `CurriculumDownloader` PDF/HTML | Geen API-key | Bestaande publieke redirects behouden; APIheader blijft per request en staat niet op de gedeelde downloader-session |

Alle 301/302/303/307/308-paden zijn getest met eigen lokale servers; ook same-origin redirects
worden door urllib geweigerd. De HTTPS-downgradetest gebruikt een echte opener/errorprocessor
met uitsluitend de eerste HTTPS-transportresponse synthetisch; de eventuele HTTPbestemming
is een echte loopbackserver. Dit is transportmocking, geen bewijs van TLSconfiguratie op een
live bron. Na de fix ontvingen redirectbestemmingen **geen request**, dus ook geen key.
Er zijn 31 redirectscenario's verdeeld over vijf testmethoden, plus positieve echte
JSON/list/detail-verwerking voor alle vier APIclients. Proxy-, CA- en TLSdefaults blijven
behouden; geen globale urllib-opener vervangen en geen TLScontrole uitgeschakeld.

De huidige volledige Python-suite telt **64 geslaagde tests**, met syntaxcontrole van
**43 Python-bestanden**. De bestaande 48 tests blijven behouden. De vóór-fix-run had drie
nieuwe overlapfailures en 26 redirect-subtestfailures; de reeds beschermde secundaire
API slaagde ook vóór de wijzigingen. Reproduceerbaar met de bestaande venv/wrapper:

```bash
bash /workspace/.onboarding/run-test-env.sh timeout 60 /workspace/.onboarding/corpus-validation-2026-10-03/venv/bin/python -m unittest discover -s scripts/tests -v
```

Lokale sockets vereisen in deze cloud de normale escalatieroute. De tests starten uitsluitend
twee eigen loopbackservers, doen sequentiële aanvragen en sluiten servers/sessions af.
Private vóór/na-logs en key-receiptbewijs zonder keywaarden staan in
`/workspace/.onboarding/pr35-review-2026-10-04/`; `review-evidence.json` bewaart de hashes.
De tests zijn in de bestaande quality-job opgenomen, zonder gewijzigde controles, audit,
drempels, branchbescherming, merge of deployment. De tijdelijke braces-mitigatie blijft
ongewijzigd, zichtbaar en verloopt op `2026-10-17T00:00:00.000Z`.

## Oorspronkelijke uitvoering — 3 oktober 2026

Begincommit actuele main: `9359f8031b8e45445875a17936de776f432bf543`.
Branch: `codex/scraper-corpus-validation-2026-10-03`.
De definitieve headcommit en GitHub-resultaten staan in de bijbehorende PRbeschrijving.
Deze controle levert scraperfixes en reproduceerbare regressies op. **Echte corpusvalidatie
is GEBLOKKEERD:** geen curriculumbron kon door de enforced cloudallowlist worden bereikt.
Historische corpusversies en synthetische fixtures zijn geen bewijs voor actuele bronnen.

## Bevestigde fouten en gerichte fixes

| Trigger / codepad | Effect vóór de wijziging | Fix en regressie |
| --- | --- | --- |
| Python parse van `fetch_all_curriculum.py`, regel 107 op begincommit | `IndentationError`; de volledige batch en zelfs `--help` starten niet | Inspringing hersteld; ASTcontrole van alle scripts en begrensde `--help`-subprocesscontrole |
| Batch met `--domains-only` | Start ook de Op.stap-scraper | Op.stap alleen buiten domains-only; commandolijst gecontroleerd met gemockte subprocessen. Baseline apart gereproduceerd met uitsluitend de syntaxfout gecorrigeerd |
| Vier kernmodules aanwezig, maar Playwright/openpyxl/pandas afwezig | Dependencyhelper retourneert ten onrechte “alles aanwezig” | Alle zeven bestaande requirements gecontroleerd; negatieve importtest |
| `fetch_all_goals`: paginalimiet, voortijdig lege pagina, herhaalde pagina of gewijzigd totaal | Onvolledig/duplicaat corpus kan als geslaagd terugkomen | Schema-, totaal- en paginacontroles; geen succes bij afbreken. 404 blijft een HTTPfout. Positieve complete en onbekend-totaal-paginering behouden |
| `SecondaryMinimumGoalsFetcher`: volgendepagina blijft bestaan bij limiet/cyclus | `_write` publiceert gedeeltelijke doelen | Fout vóór extractie/publicatie; regressies controleren ook dat output niet wordt geschreven |
| Secundaire API: volgende link naar andere origin of HTTPredirect | Custom API-key kan met volgende aanvraag worden doorgestuurd | Andere origin geweigerd; automatische HTTPredirects uit; geen volgende aanvraag/publicatie. Uitsluitend synthetische keys en gemockte HTTP gebruikt |
| Portaalcollector ziet alleen eerste pagina of dubbel ontvangen records | Capture wordt zonder volledigheidsbewijs teruggegeven | Geldig, consistent `totalItems` en evenveel unieke records vereist; onvolledige/onbekende capture faalt. Complete captures met retries behouden; browser sluit ook bij navigatiefout |

De bestaande 20 scrapertests zijn vóór wijzigingen geslaagd. Nieuwe negatieve pagineringtests
faalden op de oorspronkelijke paden; de private vóór-logs leggen dit vast. De huidige suite
heeft **48 geslaagde tests**, inclusief bestaande parser-, normalisatie- en exporttests.
CI voert deze suite voortaan in een aparte Python-venv uit binnen de bestaande quality-job.
Alle bestaande stappen, de audit aan het einde en branchbescherming blijven behouden.

Het portaal wordt niet automatisch volledig doorgeklikt door deze fix. Een gedeeltelijke
capture wordt nu zichtbaar geweigerd. Een servergerapporteerd totaal is bovendien geen bewijs
dat de juiste actuele doelensets zijn geselecteerd; dat vereist de geblokkeerde broncontrole.
De compatibiliteit van deze strengere controle met de actuele publieke API/portalpayloads
is nog niet vastgesteld. Geen bronversie of bronlink is als geverifieerd voorgesteld.

## Werkelijke uitvoering

Alle Nodecommando's gebruiken `/workspace/.onboarding/run-test-env.sh` (Node 22.23.3).
Browsers gebruiken `/workspace/.onboarding/run-browser-env.sh` via de normale goedkeuringsroute.
Wrappers zijn vooraf gelezen: synthetische configuratie, aparte testdatabase, analytics en
telemetrie uit. Geen echte sleutels, betaalde AI/Discovery Engine, accounts of clouduploads.

| Controle | Uitkomst |
| --- | --- |
| Alle Python-scripts AST/syntax | GESLAAGD; 42 bestanden |
| Bestaande scrapertests vóór wijzigingen | GESLAAGD; 20 tests |
| Volledige huidige Python-suite | GESLAAGD; 48 tests |
| Aparte venv, volledige `requirements-curriculum.txt` | GESLAAGD; packageversies in private `venv-freeze.txt` |
| Python Playwright echte browserstart | GESLAAGD; Chromium 153.0.8010.12, HTML/JScheck; extern verkeer afgebroken |
| Volledige `npm ci` met scripts | GESLAAGD; bestaande lokale backport daadwerkelijk toegepast |
| `npx next typegen`, lint, typecheck | GESLAAGD |
| `NODE_ENV=test npm test` | GESLAAGD; 155 bestanden, 765 tests geslaagd, 1 bestaande echte-corpus-skip |
| Verse `npm run build` | GESLAAGD |
| `node scripts/check-standalone.mjs` | GESLAAGD; o.a. scheiding, restore en DOCX-export/herimport |
| `node scripts/check-client-session.mjs` via browserwrapper | GESLAAGD |
| `npm run security:audit -- --all`, na build | GESLAAGD met bestaande tijdelijke braces-mitigatie: 960 packages, 1 raw finding, 1 tijdelijk gemitigeerd, 0 overige blokkerende findings |
| Publieke bronprobes | GEBLOKKEERD; alle 16 echte publieke hosts geven proxy CONNECT 403 |
| `check:corpora` op afzonderlijke echte-datamap | MISLUKT, exit 1; alle 14 datasets ontbreken door de netwerkblokkade |
| Echte corpusloader zonder fixturemap | Lege loadercontrole uitgevoerd; 8 niveaus en limiet 1–5 geven 0 records/resultaten; runner exit 1 omdat echte data ontbreekt |
| Representatieve echte zoekvragen, filters, codes, bronverificatie, zoekroutes | GEBLOKKEERD; geen echte data, geen fixturefallback als vervangend bewijs |
| Koude/warme prestaties en geheugen met echte corpora | GEBLOKKEERD; metingen op de lege loader zijn geen prestatiebewijs voor echte corpora |
| Lokale `scripts/check-linux-isolation.mjs` | GEBLOKKEERD; geen hostroot/systemd/schrijfbare cgroups; rootguard behouden |

De auditwaarschuwing blijft zichtbaar: `braces@3.0.3 / GHSA-vfj7-8cjw-p6xm`, lokale backport,
**geen officiële herstelrelease**, vervalt `2026-10-17T00:00:00.000Z`. Deze PR wijzigt geen
dependencies, uitzondering, drempel of beveiligingscontrole. Geen “geen kwetsbaarheden”-claim.
Overige browser- en Linuxchecks worden in GitHub CI uitgevoerd; hun actuele uitkomsten worden
apart in de PR vastgelegd en niet uit eerdere runs overgenomen.

## Broninventaris en netwerkblokkade

De eerste probes waren onderwijsdoelen.be en GO!. Daarna volgde één `robots.txt`-probe per
overige publieke bronhost: maximaal 5 seconden per request, 64 KiB body, geen retry, totale
60-secondentijdbegroting en een buitenste proceslimiet. Geen loginhost werd benaderd.
De actuele cloudconfiguratie was revision 26, current/enforced, zonder credentials.
Een gevonden regexfragment `www` is uit de inventaris verwijderd; het is geen bronhost.

Alle onderstaande exacte hosts ontbreken in de allowlist:

```text
assets.vlaanderen.be
cached-api.katholiekonderwijs.vlaanderen
classid.io
data-onderwijs.vlaanderen.be
onderwijs-api-portaal.vlaanderen.be
onderwijs-vlaanderen-portaalov.apigee.io
onderwijs.api.vlaanderen.be
opstap.katholiekonderwijs.vlaanderen
pov.classid.io
pro.g-o.be
pro.katholiekonderwijs.vlaanderen
www.onderwijsdoelen.be
www.ovsg.be
www.vlaanderen.be
zill-selector.katholiekonderwijs.vlaanderen
zill.katholiekonderwijs.vlaanderen
leerlokaal.ovsg.be
leerlokaalupdate.ovsg.be
```

De laatste twee zijn loginhosts: **geen toestemming voor credentials of login**, ook niet
na allowlisting. APIhosts kunnen afzonderlijke toegangsrechten/keys verlangen; openbare
documentatie geeft geen toestemming om een account of key te gebruiken. De inventaris
legt concrete bestanden vast; na bereikbaarheid kunnen nieuwe redirect-/asset/CDNhosts blijken.
Geen proxyomweg of automatische wijziging van de cloudconfiguratie uitgevoerd.

## Datasetuitkomsten en provenance

| Dataset | Opgehaald | Structureel / inhoudelijk | Beschikbaarheid / beperking | Commercieel hergebruik |
| --- | --- | --- | --- | --- |
| OPSTAP | Nee | GEBLOKKEERD / GEBLOKKEERD | Publieke app/API niet bereikbaar | Niet vastgesteld |
| OVSG | Nee | GEBLOKKEERD / GEBLOKKEERD | LeerLokaal-login niet toegestaan; publieke OVSG-documenten ook netwerkgeblokkeerd | Niet vastgesteld |
| GO_NIEUW | Nee | GEBLOKKEERD / GEBLOKKEERD | Publieke hub/Excel/PDF niet bereikbaar | Niet vastgesteld |
| GO_OUD | Nee | GEBLOKKEERD / GEBLOKKEERD | Publieke hub/PDF niet bereikbaar | Niet vastgesteld |
| ZILL | Nee | GEBLOKKEERD / GEBLOKKEERD | Selector en documenten niet bereikbaar | Niet vastgesteld |
| SECUNDAIR_LEERPLANNEN | Nee | GEBLOKKEERD / GEBLOKKEERD | GO/KOV-documenten niet bereikbaar; volledige OVSG-dekking niet publiek bewezen | Niet vastgesteld |
| SECUNDAIR_MINIMUMDOELEN | Nee | GEBLOKKEERD / GEBLOKKEERD | Publiek portaal niet bereikbaar; APItoegang afzonderlijk vereist | Niet vastgesteld |
| POV | Nee | GEBLOKKEERD / GEBLOKKEERD | Classid-hosts niet bereikbaar; rechten/keyvereiste niet geverifieerd | Niet vastgesteld |
| OKAN | Nee | GEBLOKKEERD / GEBLOKKEERD | Publiek portaal niet bereikbaar | Niet vastgesteld |
| BUBAO | Nee | GEBLOKKEERD / GEBLOKKEERD | Code meldt geen complete publieke portalsets; APIkey niet gebruikt | Niet vastgesteld |
| BUSO | Nee | GEBLOKKEERD / GEBLOKKEERD | Publiek portaal niet bereikbaar | Niet vastgesteld |
| DKO | Nee | GEBLOKKEERD / GEBLOKKEERD | Publiek portaal niet bereikbaar | Niet vastgesteld |
| VOLWASSENEN | Nee | GEBLOKKEERD / GEBLOKKEERD | Publieke kandidaatsets niet bereikbaar; volledige domeindekking onbekend | Niet vastgesteld |
| HOGER | Nee | GEBLOKKEERD / GEBLOKKEERD | Publieke kandidaatsets niet bereikbaar; volledige domeindekking onbekend | Niet vastgesteld |

Er zijn **0 bronbestanden opgehaald**. Ophaaldatum, hash, versie en recordaantal per dataset
zijn daarom `null`, niet verzonnen. `observations.json` bevat geplande URL's uit bestaande code
en broninventaris, status per dataset en hashes van de private bewijsstukken. Deze URL's zijn
geen succesvolle downloads of geverifieerde actuele bronnen.

Private opslag, buiten Git en gescheiden van `test/fixtures`:

* `/workspace/.onboarding/corpus-validation-2026-10-03/raw/`: leeg.
* `/workspace/.onboarding/corpus-validation-2026-10-03/corpora/`: leeg.
* `/workspace/.onboarding/corpus-validation-2026-10-03/venv/`: aparte Pythonomgeving.
* `/workspace/.onboarding/corpus-validation-2026-10-03/evidence/`: vóór/na-logs, netwerkprobes,
  packageversies, loadercontrole en actuele projectcontroles.

Geen externe corpora, credentials of grote gegenereerde bestanden worden gecommit.
Bronbeschikbaarheid, robotsvoorwaarden, bronversies, volledigheid en commerciële rechten
blijven afzonderlijke vragen. Publiek toegankelijke data betekent geen vastgestelde hergebruiklicentie.

## Reproduceren en gericht hervatten

```bash
# In een eigen venv; geen globaal pip install.
python3 -m venv /tmp/curriculum-audit-venv
/tmp/curriculum-audit-venv/bin/python -m pip install --timeout 30 --retries 1 -r scripts/requirements-curriculum.txt
/tmp/curriculum-audit-venv/bin/python -m unittest discover -s scripts/tests -v

# Via bestaande Node 22-wrapper; inventory doet standaard geen requests.
bash /workspace/.onboarding/run-test-env.sh /tmp/curriculum-audit-venv/bin/python scripts/audit_curriculum_sources.py --output /tmp/curriculum-hosts.json
# Optioneel na ondersteunde allowlistwijziging: --probe, begrensd met timeout 70.

bash /workspace/.onboarding/run-test-env.sh npm run check:corpora -- --data-root /workspace/.onboarding/corpus-validation-2026-10-03/corpora
```

Na netwerktoegang eerst onderwijsdoelen of GO! opnieuw benaderen, robots/bronvoorwaarden
controleren en slechts één begrensde bron ophalen. Bewaar raw en JSONL apart; leg echte URL,
ophaaltijd, SHA256, expliciet bevestigde bronversie en volledigheidsstatus vast. Controleer
naast `check:corpora` de echte schema's, doelcodes/teksten, ontbrekende velden, duplicaten en
alle pagina's. Pas daarna loader en publieke zoekroutes op een eigen werkmap zonder
`test/fixtures` testen; limiet 1–5, filters, bronspotchecks en koude/warme RSS meten.
De private loaderprobe laat zien hoe `process.chdir` vóór dynamische imports de bestaande
loader naar deze afzonderlijke werkmap verwijst; er is geen productie-bypass toegevoegd.

Zonder deze vervolgstappen is inhoudelijke corpusvalidatie niet afgerond. Geen merge of
deployment uitgevoerd en geen operationele of inhoudelijke productieacceptatie geclaimd.
