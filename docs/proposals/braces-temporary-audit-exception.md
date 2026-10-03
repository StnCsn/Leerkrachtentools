# Voorstel: tijdelijke, gecontroleerde braces-audituitzondering

**TER BEOORDELING — NIET ACTIEF.** Dit voorstel bij PR #34 verandert geen
auditbeslissing. `npm run security:audit -- --all` blijft foutstatus 1 geven voor
GHSA-vfj7-8cjw-p6xm. De bestaande `quality`-job, auditstap en branchbescherming
blijven behouden. Geen merge of deployment.

Begin-/reviewcommit: `185b549b111ae512cdfa65d495cfb03c1785e67d` op
`codex/fix-braces-advisory-2026-10-03`. Dit voorstel bouwt voort op de
[backportbeoordeling](../braces-security-review-2026-10-03.md), inclusief de
764 oorspronkelijke upstreamtests en de negen security/glob/installerregressies.
Definitieve voorstelcommit en GitHub-uitkomst worden in PR #34 vermeld.

## Exacte scope en vervaldatum

Alleen de combinatie **braces / 3.0.3 / GHSA-vfj7-8cjw-p6xm** mag na afzonderlijk
akkoord als *tijdelijk gemitigeerd* worden geclassificeerd, uitsluitend als alle
onderstaande voorwaarden op de werkelijk geïnstalleerde bestanden slagen.
Dit is geen officiële herstelrelease en geen generieke allowlist.

Vervalmoment: **17 oktober 2026, 00:00:00 UTC**, exclusief.
Op `2026-10-16T23:59:59.999Z` kan het voorstel nog voldoen; vanaf
`2026-10-17T00:00:00.000Z` faalt het onvoorwaardelijk. De live integratie moet de
echte klok gebruiken, zonder CLI-/omgevingsoverride, grace period, fallback naar
cached bewijs of automatische datumverlenging. Tests injecteren uitsluitend een
synthetische klok. Verlenging is niet onderdeel van dit voorstel.
De datum wordt zowel vóór bewijsverzameling als vlak vóór de beslissing getoetst;
een lopende metadatacontrole die de deadline passeert geeft geen uitzondering.

De drie toegestane ketens zijn exact:

| DevDependency | Geïnstalleerde keten |
| --- | --- |
| eslint-config-next 16.3.6 | @next/eslint-plugin-next 16.3.6 → fast-glob 3.3.1 → micromatch 4.0.8 → braces 3.0.3 |
| shadcn 4.21.0 | shadcn/node_modules/fast-glob 3.3.3 → micromatch 4.0.8 → braces 3.0.3 |
| shadcn 4.21.0 | ts-morph 26.0.0 → @ts-morph/common 0.27.0 → eigen fast-glob 3.3.3 → micromatch 4.0.8 → braces 3.0.3 |

Alle tien betrokken pakketlocaties moeten `dev: true` blijven in het lockfile.
Alle ketens eindigen op de ene installatie `node_modules/braces`. Nieuwe roots,
andere versies/specs/locaties, extra instanties of een productieclassificatie
vereisen herbeoordeling en geven geen uitzondering.

## Uitvoerbare, inactieve referentie

- `scripts/proposals/braces-exception-policy.json`: onafhankelijk vastgelegde
  SHA-256 van alle tien braces-bestanden, het bestaande patchmanifest, de tien
  keten-package.json-bestanden en hun volledige lockrecords; één hash van de
  genormaliseerde actuele `npm explain braces --json`-boom; vaste vervaldatum.
- `scripts/proposals/braces-audit-exception.mjs`: leest de werkelijke bestanden,
  voert verse lokale `npm explain` uit en toetst de voorwaarden. Export is
  `assessBracesExceptionProposal`; er is geen CLI of activatievlag.
- `scripts/braces-audit-exception-proposal.test.mjs`: synthetische wegwerpkopieën
  van werkelijk geïnstalleerde packagebestanden; providers worden gemockt.

De module wordt **niet** geïmporteerd door de actieve audit, package-scripts,
postinstall, applicatie of workflow. Alleen de nieuwe tests gebruiken hem.
Een positief resultaat bevat altijd `reviewOnly: true` en
`wouldPassAfterSeparateApproval`, plus de zichtbare waarschuwing **NIET ACTIEF**.
Het wijzigt geen proces-exitcode of actuele auditfinding.

### Installatie- en ketenbewijs

De checker vergelijkt de geïnstalleerde bytes met de onafhankelijk gepinde
hashes, niet met ter plaatse uit het patchmanifest berekende verwachte hashes.
Hij controleert ook `index.js`, `lib/utils.js`, package.json, README en licentie;
een geldig manifest met ongewijzigde, ongepatchte lib-bestanden wordt afgewezen.
Ontbrekende/extra bestanden, symlinked patchbestanden, een afwijkende pakketnaam
of versie, of een extra/nested/aliased braces-installatie falen.

De manifests van de ketenpakketten en hun lockrecords moeten hun gepinde hashes
behouden. Daarna wordt **de huidige geïnstalleerde boom** via een begrensde
`npm explain braces --json` gelezen: 10 seconden, maximaal 1 MiB uitvoer.
De boom inclusief edge-types/specs en flags wordt gecanonicaliseerd:
project-rootlocatie naar `.`, objectkeys gesorteerd, arrays recursief gesorteerd
op hun canonieke JSON; locaties/versies worden niet weggefilterd. Alleen npm's
berekende uitvoerbit `devOptional` wordt uitgesloten: npm 10.9.9 retourneert voor
dezelfde installatie `true` en npm 11.9.0 `false`. Die afwijking is lokaal met
beide echte CLI-versies gereproduceerd; alle overige boomvelden zijn gelijk.
`devOptional` en alle overige flags in de **lockrecords** blijven wel gepind,
evenals dev/prod/optional/peer-edge-types in de actuele boom. Nieuwe optional
edges en gewijzigde lockflags worden afzonderlijk negatief getest. De resulterende
SHA-256 moet exact overeenkomen. Geen opgeslagen npm-explain-uitvoer als bewijs.
Een gewijzigde tree/schema faalt gesloten, ook na een npm-toolingwijziging.

Hashbindings mogen niet automatisch worden ververst om een mislukte controle
groen te maken. Een wijziging is een afzonderlijke inhoudelijke herbeoordeling.

### Productie en standalone

Voorgeschreven activatieflow: maak in dezelfde quality-job een nieuwe lege
wegwerpmap, kopieer package.json, package-lock.json en uitsluitend de bestaande
postinstall-toepasser/patchdata; voer **volledige `npm ci --omit=dev` met scripts**
uit. Gebruik een subprocess met 180 seconden limiet; verwijder de map in `finally`
bij succes of fout. Geen hergebruik van een oude map of extern attestatiebestand.
Native buildheaders mogen volgens de bestaande Node 22-wrapper worden gebruikt.

De checker verlangt een aparte productiemap met identieke package-/lockbytes en
een geïnstalleerde Next-package. Hij scant de werkelijke productie-node_modules
en de complete standalone-output van de verse build in dezelfde job:

- geen `braces`-directory of package.json met naam `braces`, ook onder aliases of
  nested node_modules en ook wanneer een braces-manifest ontbreekt;
- geen bekende braces-imports/require-verwijzingen of `node_modules/braces`-paden
  in JavaScript, JSON en Next-tracebestanden; dit omvat trace- en bundlereferenties;
- standalone package.json identiek, server.js aanwezig en BUILD_ID gelijk aan de
  huidige build; een ontbrekende of oude build geeft geen uitzondering.

Next's interne directorylinks worden één keer gevolgd zolang ze binnen de
geïnspecteerde boom blijven. Links naar buiten, onleesbare bestanden of overschreden
scanlimieten falen. Grenzen: 64 mapniveaus, 200.000 entries, 32 MiB per geïnspecteerd
code-/tracebestand; referentieproef draait met 60 seconden en 256 MiB heap.
Dit is concrete pakket-/import-/tracecontrole, geen algemene bewijsvoering tegen
willekeurig hernoemde, zelfgeschreven of verborgen code. Nieuwe bundelwijze of
runtimegebruik moet afzonderlijk worden onderzocht; niet blind de hashes vernieuwen.

De synthetische unitfixtures modelleren deze gate; zij installeren niet per test
alle productiepakketten. Daarnaast is de checker werkelijk uitgevoerd met een
verse `npm ci --omit=dev` (290 pakketten), de echte geïnstalleerde backport en de
bestaande standalone met ongewijzigde appbron. Die proef slaagt. Bij latere
activatie is de **verse job-build/installatie** verplicht, niet deze historische proef.

### Upstream en overige advisories

Na lokaal bewijs worden opnieuw het officiële OSV-record voor deze GHSA en
`https://registry.npmjs.org/braces/latest` opgevraagd, met 30 seconden timeout.
Onbeschikbare/ongeldige metadata geeft geen uitzondering. Een `fixed`-event,
gewijzigde affected range, ingetrokken advisory of andere nieuwste release
stopt de uitzondering voor gerichte herbeoordeling. De checker doet geen upgrade.

Reviewcorrectie op begincommit `fa01a4f59acacf623c1fd83224d2ef7779283b57`:
de relevante npm/braces affected-records zijn nu **volledig en exact** gebonden
aan `upstreamAffected` in de beoordeelde policy. Het huidige record bevat één
`SEMVER`-range met exact de geordende events `introduced: "0"` en
`last_affected: "3.0.3"`. Alle velden van het relevante record blijven onderdeel
van de vergelijking, ook package/purl, eventuele versions en aanvullende velden.
Er worden geen records, ranges of events samengevoegd of weggefilterd om een
overeenkomende grens te vinden. Ontbrekende, extra, gewijzigde of verkeerd
gevormde records/ranges/events en een ander range-type vereisen herbeoordeling.
Niet-lege records/arrays en één bekend event-key met stringwaarde worden vóór
de vergelijking gevalideerd. Een officieel `fixed`-event blijft afzonderlijk
de gerichte vervanging van de backport afdwingen.

Alleen object-keyvolgorde wordt genormaliseerd; record-, range- en eventvolgorde
blijven exact. Wijzigingstijd, summary en andere beschrijvende metadata **buiten**
de relevante affected-records bepalen deze binding niet. Nieuwe velden binnen
een relevant record worden niet stilzwijgend als irrelevante metadata genegeerd.
Een positief geval met gewijzigde modified/summary en andere object-keyvolgorde
bewijst dat deze encoding-/prosewijzigingen de controle niet laten falen.
Bij een officiële herstelrelease: officiële advisory/versies onderzoeken,
gericht bijwerken, oorspronkelijke suite/glob/securityregressies en volledige
quality uitvoeren, daarna backport en uitzondering verwijderen. Geen verlenging
als vervanging van dat onderzoek.

De huidige volledige OSV-query, retries, responsevalidatie en scan van **alle**
prod/dev/build package-versiecombinaties blijven behouden. Exact de bovenstaande
triple kan apart worden geteld; iedere andere advisory, versie of pakketnaam
blijft blokkerend. Herhaalde meldingen mogen alleen voor diezelfde triple worden
geclassificeerd en blijven zichtbaar; geen wildcard, CVE-aliasmatch of naamfilter.

## Noodzakelijke wijzigingen uitsluitend ná afzonderlijk akkoord

1. Review de policy/referentie en wijzig de expliciete reviewstatus naar een
   beoordeelde status in een afzonderlijke codewijziging. Verwijder review-only
   labeling dan pas. Geen env-flag of CLI-vlag die vandaag activatie mogelijk maakt.
2. Voeg de hierboven beschreven tijdelijke productie-installatie/cleanup-helper
   toe aan de volledige auditflow, na de bestaande job-build/browserchecks.
   Laat de **bestaande auditstap als laatste staan**, met hetzelfde commando
   `npm run security:audit -- --all` en dezelfde verplichte `quality`-check.
3. In `scripts/audit-production-dependencies.mjs`, uitsluitend voor `--all`:
   na de bestaande volledige scan en validatie de runtime-checker aanroepen op de
   echte installatie, verse productie-installatie en verse standalone. Geen
   uitzonderingspad in de productie-only audit. Iedere guard-/netwerkfout houdt
   de oorspronkelijke finding blokkerend; vang hem alleen voor duidelijke diagnose.
4. Print altijd eerst de volledige bekende findings. Bij geldige tijdelijke
   mitigatie print tevens naam, versie, GHSA, backportstatus en vervaldatum;
   eindig met raw-/tijdelijk-gemitigeerde-/overige-blokkerende aantallen.
   Kies exit 1 bij overige findings of guardfout; alleen exact deze triple kan
   na akkoord exit 0 toelaten. Bij mitigatie nooit de tekst "Geen bekende
   kwetsbaarheden gevonden" gebruiken.
5. Voeg bij die integratie subprocess-tests van het **actieve auditcommando** toe:
   intact bewijs/alleen target geeft waarschuwing+exit 0; ontbrekende/gewijzigde
   patch, nieuwe keten, productie-/standalone-braces, extra advisory, verlopen
   datum en onvolledige upstreammetadata geven exit 1. Geen verzwakking van huidige
   parser-/netwerk-/browser-/Linux-tests of branchbescherming.

Deze vijf activatiewijzigingen zijn **niet toegepast**. Het huidige voorstel
maakt uitsluitend de geschiktheidsvoorwaarden en negatieve tests reviewbaar.

Voorbeeld van beoogde uitvoer *na goedgekeurde activatie* (nu niet actief):

```text
OSV controleerde 960 productie- en buildpackages.
1 bekende kwetsbaarheid gevonden:
- braces@3.0.3: GHSA-vfj7-8cjw-p6xm
TIJDELIJK GEMITIGEERD: geïnstalleerde backport en dev/build-ketens geverifieerd;
geen officiële herstelrelease; vervalt 2026-10-17T00:00:00.000Z.
1 finding; 1 tijdelijk gemitigeerd; 0 overige blokkerende findings.
```

Een extra advisory maakt het laatste aantal 1 en exit 1. Bij afloop/guardfout
blijft ook braces zelf blokkerend. De datum is niet automatisch verlengbaar.

## Uitgevoerde voorsteltests

| Scenario | Verwachte en gemeten uitkomst |
| --- | --- |
| Werkelijke gepatchte bytes en drie oorspronkelijke ketens | Alleen review-geschiktheid; waarschuwing NIET ACTIEF |
| Originele releasebytes met geldig patchmanifest | Afgewezen |
| Gewijzigde parse/stringify/utils/index; ontbrekende compile | Afgewezen |
| Gewijzigd manifest, andere versie, symlinked patchfile | Afgewezen |
| Extra braces-instance, extra echte rootketen, gewijzigd consumer-manifest | Afgewezen |
| Lockketen heringedeeld als productie, andere lock devOptional-flag of nieuwe optional-edge | Afgewezen |
| Braces-package onder alias in productie of standalone | Afgewezen |
| Braces-reference in standalone / oude BUILD_ID / externe directorylink | Afgewezen |
| Veilige interne Next-directoryalias | Volledig geïnspecteerd, aanvaard als reviewbewijs |
| Extra GHSA, andere braces-versie of brace-expansion met dezelfde GHSA | Blijft blokkerend; wouldPass=false |
| Eén milliseconde vóór / exact op / na vervaldatum, ook tijdens lopende requests | Voorstel mogelijk / afgewezen / afgewezen |
| Nieuwe release, officieel fixed-event of metadata-uitval | Afgewezen, gerichte herbeoordeling vereist |
| Ontbrekend/gewijzigd introduced-event; ontbrekend/extra record of range | Afgewezen, herbeoordeling vereist |
| Lege/missende/ongeldige ranges/events, verkeerde eventwaarde, multi-key event | Afgewezen, herbeoordeling vereist |
| Andere/missende/ongeldige range-type; omgekeerde events; toegevoegde versions | Afgewezen, herbeoordeling vereist |
| Alleen modified/summary en object-keyvolgorde gewijzigd | Ongewijzigde binding, alleen review-geschiktheid |

Node 22-wrapper: 57 voorsteltests + 9 bestaande backport/installertests +
6 bestaande auditvalidatietests: **72 geslaagd, 0 mislukt, 0 overgeslagen**.
Lint is geslaagd. De actuele actieve audit en volledige GitHub-uitkomst worden
in PR #34 vermeld; er wordt geen groene audit of geactiveerde uitzondering geclaimd.
