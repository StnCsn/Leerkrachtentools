# Braces: lokale mitigatie en resterende auditmelding

Begincommit op opnieuw opgehaalde actuele `main`:
`36f2caa69ad62d39e853e82dadf36cf7809e7bbe`.
Branch: `codex/fix-braces-advisory-2026-10-03`. Definitieve geteste commit en
GitHub-CI-uitkomst staan in de PR. Geen merge of deployment.

Aanvulling ter beoordeling: [tijdelijk audituitzonderingsvoorstel](proposals/braces-temporary-audit-exception.md).
De referentie en negatieve tests zijn afzonderlijk toegevoegd; **de uitzondering
is niet actief**. Het huidige auditcommando blijft deze GHSA blokkeren.

## Actuele officiële bronnen

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) /
CVE-2026-93687 treft `braces <=3.0.3`: recursieve AST-walkers missen een
dieptelimiet. Diep geneste patronen onder de tekenlimiet kunnen stack-exhaustion
en een ongehanteerde RangeError veroorzaken. Dit is **braces**, niet
`brace-expansion`, en niet de oudere braces-advisory GHSA-grv7-fg5c-xmjg.
De officiële advisory noemt ook bij de hercontrole op 3 oktober 2026
**geen gepatchte versie**. Npm-registry en upstream-PR zijn opnieuw opgevraagd;
latest blijft 3.0.3 en PR #72 blijft open en niet gemerged.
Het actuele OSV-bronrecord staat in `audit-evidence/2026-10-03/braces-advisory.json`.

Npm publiceert nog braces 3.0.3 (21 mei 2024). De nieuwste micromatch 4.0.8,
fast-glob 3.3.3 en shadcn 4.21.1 houden dezelfde dependencyketen in stand.
[Upstream-issue #70](https://github.com/micromatch/braces/issues/70) staat open;
[upstream-PR #72](https://github.com/micromatch/braces/pull/72) is niet gemerged.
De onderzochte patchhead is `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`.
Geen officiële release of geaccepteerde fix suggereren.

## Alle geïnstalleerde ketens

Er is één gededupliceerde braces-installatie; `npm explain braces` toont drie
ketens die een gewone `npm ls braces`-boom niet volledig toont:

| Directe devDependency | Ketens naar micromatch 4.0.8 → braces 3.0.3 |
| --- | --- |
| shadcn 4.21.0 | shadcn/node_modules/fast-glob 3.3.3 |
| shadcn 4.21.0 | ts-morph 26.0.0 → @ts-morph/common 0.27.0 → fast-glob 3.3.3 |
| eslint-config-next 16.3.6 | @next/eslint-plugin-next 16.3.6 → fast-glob 3.3.1 |

Alle verwijzen naar `node_modules/braces`; het lockrecord is `dev: true`.

| Omgeving / invoer | Concrete controle en conclusie |
| --- | --- |
| Ontwikkeltools | `node_modules/fast-glob/out/utils/pattern.js:expandBraceExpansion` roept `micromatch.braces(..., {expand:true})` aan. `node_modules/shadcn/dist/index.js` geeft CLI `--path`-globs aan fast-glob door. `node_modules/@ts-morph/common/dist/ts-morph-common.js` gebruikt fast-glob voor projectbestandpatronen. Kwaadwillende CLI-/projectpatronen kunnen de walker bereiken. |
| Lint / CI | `node_modules/@next/eslint-plugin-next/dist/utils/get-root-dirs.js` geeft `settings.next.rootDir` door aan `fast-glob.globSync`. `eslint.config.mjs` configureert geen dergelijke rootDir. `.github/workflows/ci.yml` voert `npm ci`, de volledige audit en lint uit, geen shadcn-CLI. Gemodificeerde repoconfiguratie kan tooling beïnvloeden; dit is geen HTTP-invoerpad. |
| App / uploads | Geen braces/micromatch/fast-glob-imports gevonden in app/lib/components of applicatiescripts. `app/api/import-lesson-document/route.ts` geeft bytes en bestandsnaam door aan `lib/documents/extractText.ts` → `parserWorker.ts`, zonder globverwerking. Ook prompts/lesdoelen worden niet aan deze devtools doorgegeven. Geen aantoonbaar pad van HTTP-gebruikersinvoer naar braces. |
| Productie-installatie | Echte `npm ci --omit=dev` in een opgeruimde wegwerpmap: 290 pakketten, Next/SQLite-modules laden; braces, micromatch, fast-glob, shadcn en eslint-config-next ontbreken. `npm ls braces --omit=dev --all` geeft een lege boom. Productie-only OSV-audit: 317 combinaties, 0 meldingen. |
| Nieuwe standalone-output | Recursieve scan van alle package-manifests na `npm run build`: 0 braces/micromatch/fast-glob-installaties. Ook geen `next/dist/compiled/micromatch` of braces-module; Next's gebundelde globcode betreft minimatch/brace-expansion, een andere implementatie. Standalone/browserchecks testen echte HTTP-routes en documentverwerking. |

Shadcn verwijderen is niet verantwoord: `app/globals.css:3` importeert
`shadcn/tailwind.css`, gebruikt door `app/layout.tsx`. ESLint is eveneens actief.
Brace-expansion en picomatch missen de braces compile/expand/stringify-API en
zijn geen drop-in vervanging; fast-glob's braceExpansion uitschakelen verliest
normale globfunctionaliteit. Geen brede upgrade of dergelijke vervanging toegepast.

## Gerichte lokale backport

`patches/braces-3.0.3-depth.json` bevat uitsluitend de securitywijzigingen in vijf
lib-bestanden uit de gepinde upstream-PR. `postinstall` past deze met een kleine
Node-toepasser toe: naam/versie, oorspronkelijke SHA-256, exacte teksthunks en
resulterende SHA-256 worden gecontroleerd vóór schrijven. Reeds gepatchte bytes
zijn idempotent; onbekende bytes/versies stoppen installatie. Geen patchtool of
nieuwe dependency. Het lockfile wijzigt alleen root `hasInstallScript`; **alle
dependencyversies en integrities blijven ongewijzigd**.

De backport begrenst braces/haakjes tot 100 niveaus, beschermt parse/compile/
expand/stringify en caller-supplied ASTs, respecteert lagere/fractionele limieten
en weigert cyclic parent-chains. Syntax-/RangeErrors voor te diepe patronen moeten
door callers worden afgehandeld; dit is geen garantie tegen alle CPU-/output-DoS.
`--ignore-scripts` past deze mitigatie niet toe en is ongeschikt. Onderhoud en
verwijdering bij een officiële release staan in `patches/README.md`.

**De OSV-audit blijft MISLUKT met één melding voor braces 3.0.3.** De backport
is geen officiële gepatchte release. Auditcode, uitzonderingen en drempels
blijven ongewijzigd. Alleen de bestaande volledige auditstap is verplaatst naar
het einde van de bestaande `quality`-job, na alle browsercommando's. Commando
`npm run security:audit -- --all`, foutstatus, jobnaam en verplichte check zijn
ongewijzigd; geen `continue-on-error`, extra voorwaarde of branchbeschermingswijziging.
Quality blijft rood bij deze melding. Tijdelijk: patch met scripts installeren, CLI/config-globs
alleen uit vertrouwde bronnen gebruiken, validatiefouten afhandelen en een
officiële release afwachten. Geen onnodige devtools in productie installeren.

## Oorspronkelijke release-suite opnieuw uitgevoerd

De npm-tarball publiceert alleen `index.js` en `lib`, geen tests. Daarom zijn de
12 oorspronkelijke testbestanden opgehaald van de door npm geregistreerde
releasecommit `74b2db2938fad48a2ea54a9c8bf27a37a62c350d`, niet van de actuele
upstreambranch. Alle vijf oorspronkelijke lib-bestanden matchen de bronhashes
van gepubliceerde 3.0.3. De tests blijven byte voor byte ongewijzigd; alleen de
vijf lib-bestanden in een tweede wegwerpkopie zijn vervangen door de werkelijk
geïnstalleerde, lokaal gepatchte bestanden. Alle vijf patchhashes zijn gecontroleerd.

Een afzonderlijke tijdelijke runner gebruikt Mocha 6.2.3 (binnen de originele
`^6.1.1`), bash-path 2.0.1 en dezelfde runtime fill-range 7.1.1. Geen runnerdeps
zijn aan het project of lockfile toegevoegd. De oorspronkelijke standaardselectie
van Mocha is gebruikt, zonder filter, gewijzigde fixtures of nieuwe skips:

| Uitvoering | Geslaagd | Mislukt | Overgeslagen/pending |
| --- | ---: | ---: | ---: |
| Officiële releasebestanden, oorspronkelijke suite | 764 | 0 | 0 |
| Lokale backport, dezelfde oorspronkelijke suite | 764 | 0 | 0 |
| Eigen diepte/cyclus/glob- en installerregressies | 9 | 0 | 0 |

De suite controleert normale parse/compile/expand, ranges, escaping en de
bestaande compile-gevallen met `escapeInvalid`. Eigen regressies controleren
ook stringify met `escapeInvalid`, alle drie geïnstalleerde fast-glob-consumers,
de 100/101-grens, lagere/fractionele limieten, Infinity en cyclische ASTs/parents.
De backport is hiermee getest, niet veranderd in een officiële upstreamrelease.

Compact bewijs met archive-/testhashes en werkelijke Mocha-statistieken:
`audit-evidence/2026-10-03/braces-upstream-suite.json`.
Reproductie: haal de gepinde codeload-archive uit dat bewijs op, controleer SHA-256,
pak veilig uit, maak een tweede kopie en vervang daar uitsluitend de vijf bestanden
uit het patchmanifest door `node_modules/braces/lib/*`. Installeer de drie gepinde
runnerdeps uitsluitend in een tijdelijke directory en link diens `node_modules`
in beide fixtures. Voer vanuit elke fixture via de bestaande Node 22-wrapper uit:

```sh
timeout 60 node --max-old-space-size=256 /pad/naar/runner/node_modules/mocha/bin/_mocha --reporter json
```

De volledige lokale JSON-uitvoer en runner-lockfile blijven buiten Git in
`/workspace/.onboarding/braces-pr34-followup/`; de runner voert alleen vertrouwde
upstreamfixtures uit, geen appproviders. Tijdslimiet 60 seconden, heap 256 MiB.

## GitHub-verificatie na herordening

De eerdere run [#241](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/37133877418)
op `8fb3938cf506626a8db729ece2ac2a42cf1648df` stopte na installatie bij de audit;
de daaropvolgende controles waren **OVERGESLAGEN**, niet geslaagd.
De nieuwe [run #242](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/37135009667)
op implementatiecommit `3761a6c132d4898e73a2b0659d9da3269e172b08` is volledig
uitgevoerd. `quality` is **MISLUKT uitsluitend bij de laatste volledige audit**.
Compact API-stapbewijs en logregels staan in
`audit-evidence/2026-10-03/braces-ci-242.json`.

| GitHub-stap / exact commando | Werkelijk resultaat #242 |
| --- | --- |
| Checkout / Setup Node.js | GESLAAGD |
| Install dependencies: `npm ci` | GESLAAGD; gecontroleerde postinstall toegepast |
| Generate Next.js route types: `npx next typegen` | GESLAAGD |
| Lint: `npm run lint` | GESLAAGD |
| Typecheck: `npm run typecheck` | GESLAAGD |
| Test: `npm test`, `NODE_ENV=test` | GESLAAGD; 153 bestanden, 690 geslaagd, 1 corpusafhankelijke test OVERGESLAGEN |
| Build: `npm run build` | GESLAAGD |
| Standalone smoke test: `node scripts/check-standalone.mjs` | GESLAAGD |
| Linux parser isolation and kernel limits: `sudo "$(command -v node)" scripts/check-linux-isolation.mjs` | GESLAAGD op GitHub-runner; denied host files/writes/network, CPU deadline, native OOM limit en standalone parsing |
| Install browser: `npx playwright install --with-deps chromium firefox webkit` | GESLAAGD |
| Browser: `node scripts/check-client-session.mjs` | GESLAAGD; Chromium |
| Browser: `node scripts/check-analytics-privacy.mjs`, ook `PREVIEW_BROWSER=firefox` en `webkit` | Alle drie GESLAAGD; toestemming/weigering/intrekking en onderschept netwerk |
| Browser: `node scripts/check-preview-security.mjs`, ook `PREVIEW_BROWSER=firefox` en `webkit` | Alle drie GESLAAGD; DOCX/CSS/resources/scripts/navigatie |
| Browser: `node scripts/check-standalone.mjs --browser` | GESLAAGD; Chromium, twee tabbladen/accountwissel/storage denial |
| Audit production and build dependencies: `npm run security:audit -- --all` | MISLUKT; 960 combinaties, exact GHSA-vfj7-8cjw-p6xm, exit 1 |
| Post Setup Node.js | OVERGESLAGEN; action-cache-opslag na mislukte job, geen inhoudelijke controle |
| Post Checkout / Complete job | GESLAAGD |

Geen inhoudelijke quality-stap is overgeslagen. De bestaande corpus-skip is geen
nieuw ingevoerde uitzondering. De lokale cloudbeperking voor hostroot/systemd/
cgroups blijft **GEBLOKKEERD**; de GitHub-runner heeft deze acceptatie daadwerkelijk
uitgevoerd zonder wijziging van rootguard of checks. Dit is geen operationele
DigitalOcean-acceptatie.

Rapportcommit `185b549b111ae512cdfa65d495cfb03c1785e67d` voegde alleen dit
gemeten rapport/bewijs toe. Het latere voorstel voegt uitsluitend inactieve
referentiecode en tests toe; de audit blijft blokkeren. De **definitieve
geteste PR-headcommit en herhaalde GitHub-run op die commit** worden in de
[PR-beschrijving #34](https://github.com/tibodepauw/Leerkrachtentools/pull/34)
na afronding vermeld; er wordt niet gestopt bij bewijs van een oudere head.
Er wordt geen volledig groene audit geclaimd.

## Lokaal testbewijs van de backport

De standaard Node 22-stack liep op compile én expand vast bij 4.990 braceparen
(9.983 tekens, onder MAX_LENGTH 10.000). `braces-depth-regressions.test.mjs` bevat
zes tests die alle falen op oorspronkelijke 3.0.3 en na de patch slagen:
braces/haakjes/mixed nesting, vier publieke methoden, 100/101-grens, Infinity,
fractionele limiet, handmatige/cyclische ASTs en normale globverwerking via alle
drie fast-glob-installaties. Patronen/cycli draaien uitsluitend in subprocessen
met 512 KiB stack, 64 MiB JS-heap en 3 seconden timeout. Fixtures zijn synthetisch
en worden opgeruimd. Drie extra installer-tests verifiëren reproduceerbaarheid,
idempotentie, onbekende bronbytes vóór schrijven en een afwijkende pakketversie.

| Exacte controle | Actuele uitkomst |
| --- | --- |
| `env npm_config_nodedir=/workspace/.onboarding/node22/node_modules/node/node_modules/node-linux-x64 npm ci --no-audit --no-fund` | GESLAAGD; 862 pakketten, postinstall en overige lifecycle-scripts actief |
| Wegwerpinstallatie `npm ci --omit=dev --no-audit --no-fund` | GESLAAGD; 180 seconden limiet, cleanup; geen braces/dev-consumers |
| `npm run security:audit -- --all` | MISLUKT; 960 combinaties, dezelfde ene GHSA vóór/na de patch |
| `npm run security:audit` | GESLAAGD; 317 productiecombinaties, 0 bekende meldingen |
| `npm run lint` | GESLAAGD |
| `npx next typegen` / `npm run typecheck` | GESLAAGD |
| `npm test -- scripts/braces-depth-regressions.test.mjs scripts/apply-braces-security-patch.test.mjs` | GESLAAGD; 9 tests; zes functionele regressies rood vóór de patch |
| `env NODE_ENV=test npm test -- --maxWorkers=4` | GESLAAGD; 153 bestanden, 690 tests geslaagd, 1 corpusafhankelijke test overgeslagen |
| `npm run build` | GESLAAGD; nieuwe productie-/standalone-output, CSS-import behouden |
| `node scripts/check-standalone.mjs --browser` | GESLAAGD; auth/CSRF op 25 endpoints, accountscheiding, PDF, DOCX-export/herimport, avatar en koude restore |
| `node scripts/check-client-session.mjs` | GESLAAGD; Chromium |
| `node scripts/check-preview-security.mjs` | GESLAAGD; Chromium |
| `node scripts/check-analytics-privacy.mjs` | GESLAAGD; Chromium, onderschept netwerk |
| `scripts/check-linux-isolation.mjs` | Lokaal GEBLOKKEERD; geen echte hostroot/systemd/schrijfbare cgroups; rootguard ongewijzigd |

Projectcommando's gebruiken `bash /workspace/.onboarding/run-test-env.sh` met
Node 22.23.3; browsercommando's gebruiken de bestaande `run-browser-env.sh`.
Volledige lokale logs: `/workspace/.onboarding/braces-2026-10-03/`. De patch en
regressietests zijn reproduceerbaar zonder productiegegevens of betaalde APIs.
Deze controle claimt geen volledige appveiligheid, corpusrechten of operationele
VM-/firewall-/TLS-/backupacceptatie.
