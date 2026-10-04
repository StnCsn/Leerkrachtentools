# Echte publieke curriculumvalidatie — 4 oktober 2026

Begincommit, na `git fetch origin main`: `390e5a2cfd495127116f6ba91a9a1f810b7d1ff0`.
Geteste codecommit: `feef4bcfe2df917ca8714dd535849a1e47682a9c`.
Branch: `codex/public-corpus-validation-2026-10-04`. De definitieve rapportcommit en PR-link
worden in de oplevering en PR-beschrijving vastgelegd; die commit verandert alleen auditdocumentatie.

**Echte brondata is ditmaal opgehaald.** Alle twaalf gepubliceerde GO!-Exceldoelensets
leveren 3.490 records. Twee secundaire documenten leveren samen 381 records. Dat bewijst
geen volledige curriculumdekking: twaalf van de veertien verwachte datasetbestanden ontbreken.
Het secundaire corpus is een gecontroleerde steekproef, geen volledige dataset.

## Omgeving en grenzen

Cloudconfiguratieversie:
`d9e391dd-e7fa-4ce6-adc7-74d8fdb20b4a~cecfgver_6ac254cda774819d8e0f97043547aa45`.
Gewenste en waargenomen revision: **7**; observations current, omgeving running/connected.
Statusdienst: netwerkmodus **unrestricted**, handhavingsstatus **unknown**. Het lokale
`/etc/codex/network-policy.json` heeft versie 1, `http_network_policy.type=unrestricted`,
proxy `http://proxy:8080`, geen VPN. De status is dus geen bewijs van enforced-policy;
de echte HTTPS-responses bewijzen praktische bereikbaarheid. Geen configuratie gewijzigd.

De eerste GO!-aanvraag gebruikte curl, normale proxy/CA/TLS, geen redirect-following of
retry, maximaal vijf seconden en 64 KiB. Resultaat: CONNECT **200**, bronresponse **200**,
317 bytes, 0,838 seconden, geen redirect. Geen CONNECT-403. Latere 404-responses op
API-robots zijn bron-/HTTPresponses, geen bewijs van proxyblokkade. Data Onderwijs en
het API-portaal gaven bij hun begrensde robotscontrole HTTP 503; geen herhaalde probes.

Geen toepasselijke AGENTS.md gevonden in repository of bovenliggende werkmappen.
README, CONTRIBUTING, actuele CI, deploymenthandleiding, runtime/networking-instructies en
het rapport van 3 oktober zijn gelezen. De checkout was schoon. Geen eerdere private
onboardingbestanden, resultaten, dependencies of datasets zijn als bewijs gebruikt.

Nieuwe Python 3.12.14-venv met alle requirements; Node **22.23.3** afzonderlijk geïnstalleerd
voor aansluiting op CI (hostdefault was Node 24). Nieuwe wrapper buiten Git, aparte test-DB's,
synthetische accounts, onafhankelijke testsecrets, analytics/telemetrie uit. Geen email,
productieaccount, externe upload, betaalde AI of Discovery Engine gebruikt. De openbare
onderwijsdoelen-front-endconfiguratie bevat een API-key; deze is **niet gebruikt** of gecommit.

Alle bronrequests zijn sequentieel, zonder retries, met 15-secondenlimiet, vaste bytecaps
(robots 64 KiB, HTML 2 MiB, documenten 8–12 MiB, onderzochte publieke API maximaal 16 MiB)
en korte tussenruimte. Redirects zijn gelogd zonder automatisch aanvullende hosts te crawlen.
Robotsverboden blijven gerespecteerd. Geen loginhosts benaderd.

## Bronnen, aantallen en rechten

Ruwe bronnen: `/workspace/corpus-validation-2026-10-04/raw/`.
Afgeleide corpora: `/workspace/corpus-validation-2026-10-04/corpora/`.
Logs, bronspotchecks, requests, parsercontroles en lokale runners: sibling `evidence/`.
Alles buiten Git. [observations.json](observations.json) bevat URL, ophaaltijd, status,
byteaantal en SHA-256 per gelogde request, corpus-hashes, aantallen en hashes van bewijsstukken.
Er staan geen volledige corpora of responsebodies in Git.

| Dataset | Werkelijk onderzocht / opgehaald | Uitkomst en beperking |
| --- | --- | --- |
| GO_NIEUW | Live hub, 12 Excelbestanden, disclaimer | **GESLAAGD** voor de gepubliceerde Excelset: 3.490 bron-doelzinrijen = 3.490 records; actualiteit/goedgekeurde status beperkt, zie hieronder |
| SECUNDAIR_LEERPLANNEN | GO! A-stroom basisvorming 2024/1A/BAS, 89 pagina's, versiedatum 06/06/2024; KOV I-Ned-a oktober 24–november 25, Word | **GESLAAGD als steekproef**: 369 GO!-records + 12 reguliere KOV-doelen; geen volledige secundaire dekking |
| GO_OUD | Nederlands 2013/1, inspectienummer 2013/885/1, 114 pagina's | PDF en tekst opgehaald; geen geschikte bestaande omzetter naar GO_OUD-JSONL vastgesteld; corpusvalidatie **GEBLOKKEERD** |
| OVSG | Publieke hub; Nederlandse visie januari (2 pagina's) en actuele september 2026 (7 pagina's) | Visie is geen doelencorpus; volledige Leer Lokaal-toegang vereist login en is **GEBLOKKEERD** |
| ZILL | Publieke hub en Generieke doelen-PDF (36 pagina's); selector HTML/JS | Publieke PDF gecontroleerd als document. Selector-robots levert HTMLfallback; bulkmodel loopt via cached API met `Disallow: /`. Volledig ZILL-corpus **GEBLOKKEERD** |
| OPSTAP | Publieke app en robots | Cached API heeft `Disallow: /`; krcItems niet opgehaald. **GEBLOKKEERD** |
| POV | Publieke officiële API-documentatie | Documentatie vereist `api-key` via registratie. Geen key gebruikt; **GEBLOKKEERD** |
| SECUNDAIR_MINIMUMDOELEN | Publieke onderwijsdoelen-app/robots/front-endconfiguratie | API-key vereist voor front-endtransport; geen echte key toegestaan. **GEBLOKKEERD** |
| OKAN | Dezelfde publieke portaalinfrastructuur | Geen echte dataset opgehaald; **GEBLOKKEERD** door keygrens |
| BUBAO | Dezelfde publieke portaalinfrastructuur | Geen echte dataset; beschikbare complete doelensets bovendien onbevestigd; **GEBLOKKEERD** |
| BUSO | Dezelfde publieke portaalinfrastructuur | Geen echte dataset; **GEBLOKKEERD** door keygrens |
| DKO | Dezelfde publieke portaalinfrastructuur | Geen echte dataset; **GEBLOKKEERD** door keygrens |
| VOLWASSENEN | Dezelfde publieke portaalinfrastructuur | Geen echte dataset; volledige domeindekking onbevestigd; **GEBLOKKEERD** |
| HOGER | Dezelfde publieke portaalinfrastructuur | Geen echte dataset; volledige domeindekking onbevestigd; **GEBLOKKEERD** |

De Vlaamse assethost is bereikbaar maar heeft `Disallow: /`; de kandidaat minimumdoelen-PDF
is daarom niet gedownload. Onafhankelijke GO!, KOV en OVSG-documenten zijn wel onderzocht.
Niet elke openbare secundaire vakpagina of download is gevolgd: geen onbeperkte crawl.

GO!-Excelrijen per discipline: Nederlands 622, wiskunde 998, wetenschap en techniek 528,
geschiedenis 244, aardrijkskunde 276, burgerschap 148, muzische vorming 98,
lichamelijke opvoeding 189, Frans 112, ICT 93, sociale vaardigheden 68, leren leren 114.
Iedere werkbladrij met TYPE=doelzin is onafhankelijk geteld; codes/teksten, component,
leeftijdskolommen en verplichte velden zijn gecontroleerd. Geen lege codes/teksten/componenten/
leeftijdslijsten, geen dubbele codes of code/contextidentiteiten. Excelbestanden hebben geen
API-paginering: alle werkbladen en doelzinrijen zijn bezocht. Dit is geen vergelijking met
een onafhankelijke officiële actuele doelentelling.

De live GO!-hub noemt nog voorlopige versies, goedkeuring door de Raad van het GO! en een
nog vereiste overheidsgoedkeuring, met verwachte definitieve publicatie juni 2026. Daarom
geen claim dat deze Excelset op 4 oktober het definitieve actuele leerplan is. Een expliciete
Excelversie is niet vastgesteld. GO!-PDF's en KOV-Word hebben hierboven genoemde bronversies.
OVSG's documentatie-URL uit de repository verwijst nog naar januari; de live hub verwijst
naar september. Het KOV-document bevat naast 12 reguliere `Doel`-paragrafen ook één
`Doel: Extra`-paragraaf die de bestaande parser niet exporteert. De juiste codering/dekking van
uitbreidingsdoelen is **NIET VASTGESTELD**, dus geen volledige documentdekking geclaimd.

Bronrechten: GO! toont © 2026 Gemeenschapsonderwijs; de disclaimerlink levert een
privacy-/aansprakelijkheidspagina. OVSG- en KOV-privacypagina's zijn eveneens opgehaald.
Geen expliciete commerciële bulkhergebruiklicentie aangetroffen in de onderzochte pagina's.
Privacybeleid, publieke downloads en robots-toestemming geven die licentie niet.
Commerciële hergebruikrechten blijven voor alle bronnen **NIET VASTGESTELD**.

## Gereproduceerde fouten en fixes

| Fout | Bewijs vóór fix | Na fix |
| --- | --- | --- |
| GO!-PDFnummeringsvoorbeelden als doelen | Echte PDF: 373 records, inclusief introductieteksten voor BV1_01.02 en BV1_01.02.01; negatieve regressie faalt | GO!-blocks vereisen een leerlingzin; vier voorbeeldrecords vervallen, 369 echte records blijven |
| Enkelvoudige leerlingzinnen behouden tabelprefix | Echte BG-subdoelen beginnen met `Subdoel 1 De leerling...`; gerichte regressie faalt | Regex accepteert zowel `De leerling` als `De leerlingen`, waardoor het tabelprefix buiten de doelzin blijft |
| Deduplicatie verliest onderwijscontext | Synthetische drie gelijke codes/teksten in andere graden/stromen worden één record; regressie faalt | Volledige bestaande context en bron-URL in identiteit; drie contexten blijven, herhaling van dezelfde context blijft één |
| GO!-Excel verliest bron-URL per record | Echte zoekresultaten hebben lege `bronUrl`; regressie op `_parse_all_excel_files` faalt | Elk doel bewaart exacte Excel-URL en bronlabel; echte HTTP-resultaten hebben aantoonbaar bron-URL |

Alleen deze parser-/provenancefixes en gerichte synthetische regressies toegevoegd.
Geen bronrecords of volledige PDF-/Excelinhoud in tests opgenomen. In de echte GO!-Excelset
waren geen gedeelde codes tussen contexten; contextbehoud is daarom afzonderlijk met de
negatieve/positieve regressie bewezen, niet als waarneming van echte duplicaten voorgesteld.
Beveiligingsgrenzen, APIredirectbeveiliging, auth, quota, parserisolatie en audituitzondering
zijn ongewijzigd.

HTML als Excel geeft BadZipFile, HTML als PDF PdfStreamError; geen corpus gepubliceerd.
Corrupte JSONL is in de echte zoekhandler getest en levert lege resultaten/een corpusnotice,
zonder fixturefallback. Originele corpusbytes zijn daarna hersteld.

## Project- en appcontroles

| Controle | Uitkomst |
| --- | --- |
| Nieuwe venv + alle curriculumrequirements | **GESLAAGD**; versies in pip-freeze.txt |
| Pythonregressies en syntax | **GESLAAGD**: 68 tests; 45 Pythonbestanden inclusief de twee nieuwe testmodules |
| Volledige npm ci met scripts, Node 22 | **GESLAAGD**; braces-backport toegepast. Eerste poging mislukte door niet-schrijfbare cache; verse externe npm/node-gyp-cache loste dit op |
| Next typegen, lint, typecheck | **GESLAAGD** |
| Node-tests | **GESLAAGD**: 155 bestanden, 765 tests; 1 bestaande corpus-skip. Fixturesuite bewijst geen echte volledige corpora |
| Productiebuild + standalone | **GESLAAGD**; exports, restore, accountscheiding en parsercontroles |
| Chromium client-session, preview, analytics-privacy, standalone --browser | **GESLAAGD**; synthetische browserdata, analytics uit |
| Firefox/WebKit | **NIET ONDERZOCHT** in deze lokale run; volledige browsermatrix blijft CI-actie |
| dependency-audit --all | **GESLAAGD MET MITIGATIE**: 960 packages; 1 raw finding, 1 tijdelijk gemitigeerd, 0 overige blokkerende findings |
| Linux-isolatieacceptatie | **GEBLOKKEERD**; UID 1000, vereiste disposable root/systemd-host ontbreekt; rootguard weigert, niet aangepast |
| check:corpora, alle 14 | **MISLUKT**, exit 1: 2 aanwezige JSONL's geldig, 12 bestanden ontbreken |
| check:corpora per beschikbaar corpus | **GESLAAGD**: GO_NIEUW 3.490, SECUNDAIR_LEERPLANNEN 381 |
| Echte loader/search zonder fixturemap | **GESLAAGD**: 3.490 basisonderwijsrecords; 7 queries × limieten 1–5; andere niveaus geven voor GO_NIEUW nul |
| Echte routehandlers | **GESLAAGD**: 15 scenario's; synthetische toegelaten sessie, limieten, 400-validatie, 401 zonder sessie, KOV-filter, Pro zonder provider, ontbrekende minimumdoelen, corrupte bron |
| Echte HTTPzoekroutes | **GESLAAGD**: 10 aanvragen, GO!/KOV, limieten 1–5, echte bron-URL's; fixturemap fysiek afwezig; ongeldige origin 403 |
| Betaalde Pro/LLM, rewrites, semantische providers, Discovery Engine | **NIET ONDERZOCHT**; providers bewust niet geconfigureerd; Pro-terugval naar snelle kaarten gecontroleerd |
| Echte minimumdoelenmatching en overige ontbrekende corpora | **GEBLOKKEERD** door ontbrekende data; lege resultaten zijn geen inhoudelijke validatie |

De audit faalde aanvankelijk doordat Node fetch de proxy niet automatisch gebruikte.
Herhaling met de geïnstalleerde Undici EnvHttpProxyAgent als externe preload gebruikt de
normale geërfde proxy en CA/TLS, zonder audit- of repositorywijziging. De actuele waarschuwing
blijft **braces@3.0.3 / GHSA-vfj7-8cjw-p6xm**, lokale backport, geen officiële herstelrelease.
Vervalt **2026-10-17T00:00:00.000Z** (02:00 Brusselse tijd). Een gemitigeerde finding is aanwezig.

Prestaties zijn lokale steekproeven, geen operationele acceptatie. Loader-cold en proces-RSS,
iedere eerste/warme query en HTTPrequestduur staan in loader-results.json/http-results.json.
Laatste basisonderwijs-coldload circa 15 ms, RSS circa 134 MiB. Geen conclusies over volledige
corpusbelasting, gelijktijdige productiegebruikers of DigitalOcean getrokken. Nodechecks
gebruikten dezelfde ongewijzigde Nodebronnen als de geteste codecommit; na de laatste
Pythonfix zijn de volledige Python-suite, echte omzetting, loaders en HTTP/routes opnieuw uitgevoerd.

## Reproduceren en resterende acties

Nieuwe runners en volledige vóór/na-logs staan uitsluitend in
`/workspace/corpus-validation-2026-10-04/`; geen afhankelijkheid van de vorige chat.

```sh
/workspace/corpus-validation-2026-10-04/venv/bin/python -m unittest discover -s scripts/tests -v
bash /workspace/corpus-validation-2026-10-04/run-test-env.sh npm run check:corpora -- --data-root /workspace/corpus-validation-2026-10-04/corpora
bash /workspace/corpus-validation-2026-10-04/run-test-env.sh npm run check:corpora -- --data-root /workspace/corpus-validation-2026-10-04/corpora --required GO_NIEUW,SECUNDAIR_LEERPLANNEN
bash /workspace/corpus-validation-2026-10-04/run-test-env.sh node /workspace/corpus-validation-2026-10-04/http-probe.mjs
bash /workspace/corpus-validation-2026-10-04/run-test-env.sh env NODE_OPTIONS=--require=/workspace/corpus-validation-2026-10-04/proxy.cjs npm run security:audit -- --all
```

Resterende acties voor de eigenaar:

1. Review de draft-PR en actuele CI; geen merge, release of deployment is uitgevoerd.
2. Laat GO! bevestigen welke gepubliceerde Excel/PDFversies definitief en actueel zijn.
3. Verkrijg expliciete hergebruikrechten of beperk het aanbod tot aantoonbaar toegestane vormen;
   regel een toegestane bulkexport voor Op.stap/ZILL en OVSG, zonder robots/login te omzeilen.
4. Lever een geautoriseerde export van onderwijsdoelen/POV zonder echte keys in deze run;
   controleer alle datasets, totalen, pagina's en code/contextidentiteiten opnieuw.
5. Breid de secundaire steekproef uit naar alle aangeboden graden/finaliteiten/netwerken;
   bepaal apart de juiste codering/dekking van KOV-uitbreidingsdoelen. Lever een gecontroleerde
   GO_OUD-omzetter/export. Geen van deze ontbrekende corpora is productieklaar verklaard.
6. Voer Firefox/WebKit-CI en Linux-isolatie-/DigitalOceanacceptatie uit op geschikte hosts met
   de uiteindelijke corpora. Los de braces-finding vóór 17 oktober 00:00 UTC structureel op.
