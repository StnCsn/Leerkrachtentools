# Braces: lokale mitigatie en resterende auditmelding

Begincommit op opnieuw opgehaalde actuele `main`:
`36f2caa69ad62d39e853e82dadf36cf7809e7bbe`.
Branch: `codex/fix-braces-advisory-2026-10-03`. Definitieve geteste commit en
GitHub-CI-uitkomst staan in de PR. Geen merge of deployment.

## Actuele officiële bronnen

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) /
CVE-2026-93687 treft `braces <=3.0.3`: recursieve AST-walkers missen een
dieptelimiet. Diep geneste patronen onder de tekenlimiet kunnen stack-exhaustion
en een ongehanteerde RangeError veroorzaken. Dit is **braces**, niet
`brace-expansion`, en niet de oudere braces-advisory GHSA-grv7-fg5c-xmjg.
De officiële advisory noemt op 3 oktober **geen gepatchte versie**.
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
is geen officiële gepatchte release. Auditcode, uitzonderingen, drempels en
CI-workflow zijn ongewijzigd. CI stopt daardoor bij de audit; verdere remote
stappen worden niet als geslaagd voorgesteld. Lokale volledige controles hieronder
zijn wel uitgevoerd. Tijdelijk: patch met scripts installeren, CLI/config-globs
alleen uit vertrouwde bronnen gebruiken, validatiefouten afhandelen en een
officiële release afwachten. Geen onnodige devtools in productie installeren.

## Actueel testbewijs

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
