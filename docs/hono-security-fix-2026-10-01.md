# Gerichte Hono-securityfix — 1 oktober 2026

Begincommit op actuele `main`: `245406d900db58a4f9a80afb41739105563944ec`.
Branch: `codex/fix-hono-advisories-2026-10-01`. Definitieve geteste commit en
GitHub-CI-run staan in de PR-beschrijving. Geen merge of deployment.

## Adviesbronnen en versiekeuze

| Officiële advisory | Getroffen versie/range | Eerste fix | Gekozen versie |
| --- | --- | --- | --- |
| [GHSA-hxh3-vqpv-xpqv](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv) | Hono 4.13.5; `<4.13.7` | 4.13.7 | **4.13.12** |
| [GHSA-5r4p-p66f-jhc7](https://github.com/honojs/hono/security/advisories/GHSA-5r4p-p66f-jhc7) | Hono 4.13.5; `>=4.12.4 <4.13.11` | 4.13.11 | **4.13.12** |
| [GHSA-rmxm-3fg6-px4f](https://github.com/honojs/node-server/security/advisories/GHSA-rmxm-3fg6-px4f) | @hono/node-server 2.1.1; `>=1.19.10 <2.1.3` | 2.1.3 | **2.1.3** |

Actuele broncontrole: OSV bevatte 51 Hono-advisories. Geen daarvan treft 4.13.12;
de overige fixes zijn uiterlijk 4.13.5 beschikbaar. De twee officiële static-path
advisories waren nog niet geïndexeerd (OSV-advisorylookup: 404). Daarom is een
groene OSV-scan bij 4.13.7 onvoldoende. De officiële
[4.13.11-release](https://github.com/honojs/hono/releases/tag/v4.13.11) bevestigt
beide static-fixes; de
[4.13.12-release](https://github.com/honojs/hono/releases/tag/v4.13.12) bevat
aanvullend fixes voor consumer-types. Het centrale GitHub-advisory-API-endpoint
was door de cloudnetwerkpolicy onbereikbaar; individuele maintainer-advisories,
releasegegevens, npm-versies en OSV zijn wel gecontroleerd.

De SDK accepteert `hono ^4.11.4` en `@hono/node-server ^1.19.9 || ^2.0.5`;
de adapter accepteert `hono ^4`. Beide updates passen binnen deze ranges.
Exacte overrides en lock-integrities borgen de patchversies. Alleen de twee
betrokken lockfile-records wijzigen; geen brede upgrades of audituitzonderingen.

## Ketens en bereikbaarheid

```text
shadcn@4.21.0 (devDependency)
└─ @modelcontextprotocol/sdk@1.30.0
   ├─ hono@4.13.12
   └─ @hono/node-server@2.1.3 → hono@4.13.12 (deduplicated)
```

Dit is ontwikkeltooling. De SDK gebruikt de Node-adapter voor HTTP-conversie.
Geen Hono-import, Hono-JSX-rendering of Hono-static-middleware gevonden in
app/lib/components/scripts (behalve de nieuwe regressietest); de onderzochte
SDK-serverpaden gebruiken evenmin de getroffen JSX/static-helpers.
Exploitbaarheid via deze Next/React-app is niet aangetoond.
Hono en de Node-adapter ontbreken ook in de nieuw gebouwde standalone-output.

De JSX-fout vereist onbetrouwbare gewone strings op specifieke SSR-boundaries
(Suspense, ErrorBoundary, Context.Provider of server-render-root), en kan XSS
veroorzaken. De static-fout vereist een deels met prefixmiddleware beveiligde
static-root: malformed percent-encoding wordt tweemaal gedecodeerd, waardoor
authenticatiemiddleware wordt overgeslagen. Bestanden blijven binnen de root.

## Regressiebewijs

`scripts/hono-security-regressions.test.mjs` bevat zes functionele tests:
vier JSX-boundaries en twee static-middlewarevarianten (core/Node).
Alle zes falen op de oorspronkelijke geïnstalleerde versies, en slagen na de
patch. `/%7%30rivate/secret.txt` gaf vóór de fix HTTP 200 met synthetische
privé-inhoud, na de fix HTTP 404; een normale private URL blijft 401 en publieke
bestanden blijven leesbaar. Gewone lesinhoud behoudt correcte HTML-escaping.
Fixtures zijn klein, lokaal en worden opgeruimd; er zijn geen externe providers.

## Controles

Alle projectcontroles gebruiken de bestaande Node 22.23.3-wrapper; browserproeven
gebruiken de bestaande browserwrapper. Volledige `npm ci` omvat lifecycle-scripts
en native dependencies. De oorspronkelijke sandboxrun kon eigen subprocessen
en localhost-servers niet starten (`EPERM`); de volledige hertest gebruikt de
normale goedkeuringsroute, zonder gewijzigde assertions of beveiligingschecks.

| Exacte controle na de patch | Actuele uitkomst |
| --- | --- |
| `env npm_config_nodedir=/workspace/.onboarding/node22/node_modules/node/node_modules/node-linux-x64 npm ci --no-audit --no-fund` | GESLAAGD; 862 pakketten geïnstalleerd, scripts niet overgeslagen |
| `npm ls hono @hono/node-server @modelcontextprotocol/sdk shadcn` | GESLAAGD; compatibele ranges, alleen gekozen patchversies |
| `npm run security:audit -- --all` | GESLAAGD; 960 productie-/dev-/buildcombinaties, 0 bekende OSV-bevindingen (vóór fix: 1) |
| `npm run lint` | GESLAAGD |
| `npx next typegen` en `npm run typecheck` | GESLAAGD |
| `npm test -- scripts/hono-security-regressions.test.mjs` | GESLAAGD; 6/6, vóór patch 6/6 gefaald |
| `env NODE_ENV=test npm test -- --maxWorkers=4` | GESLAAGD; 151 bestanden, 681 tests geslaagd, 1 corpusafhankelijke test overgeslagen |
| `npm run build` | GESLAAGD; nieuwe productie-/standalone-output |
| `node scripts/check-client-session.mjs` | GESLAAGD; Chromium |
| `node scripts/check-analytics-privacy.mjs` | GESLAAGD; Chromium, onderschept netwerk |
| `node scripts/check-preview-security.mjs` | GESLAAGD; Chromium |
| `node scripts/check-standalone.mjs --browser` | GESLAAGD; HTTP/auth/CSRF, accountscheiding, browseropslag, PDF, DOCX-export/herimport en koude restore |
| `git diff --check` | GESLAAGD |

Projectcommando's hierboven krijgen het prefix
`bash /workspace/.onboarding/run-test-env.sh`; de vier browsercontroles krijgen
`bash /workspace/.onboarding/run-browser-env.sh`. Volledige ruwe uitvoer blijft
lokaal in `/workspace/.onboarding/hono-fix-2026-10-01/`; dit document en de tests
bewaren compact reproduceerbaar bewijs. De definitieve GitHub-CI-uitkomst wordt
apart vastgelegd in de PR, inclusief de gecontroleerde commit.

Linux/systemd/kernelacceptatie is lokaal **GEBLOKKEERD**: geen echte hostroot,
actieve systemd of schrijfbare cgroups. De rootguard blijft ongewijzigd en de
bestaande GitHub-CI-controle blijft actief op een geschikte runner. Deze fix
bevestigt geen operationele VM-/firewall-/TLS-/backupacceptatie of corpusrechten.
