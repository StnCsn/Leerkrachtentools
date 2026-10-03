# Lokale braces-backport

`braces-3.0.3-depth.json` past uitsluitend de securitywijzigingen in vijf lib-bestanden toe uit
[upstream-PR #72](https://github.com/micromatch/braces/pull/72), commit
`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`, op de npm-release 3.0.3.
Dit is een **lokale backport van een nog niet gemerged voorstel**, geen officiële
gepatchte release. Braces behoudt versie 3.0.3 en de oorspronkelijke lock-integrity.
De MIT-licentie staat in `braces-LICENSE`.

`npm ci` voert `scripts/apply-braces-security-patch.mjs` via `postinstall` uit.
Die controleert pakketnaam/versie en SHA-256 van alle bronbestanden vóór schrijven,
verifieert de resulterende hashes en accepteert reeds gepatchte bytes. Onbekende
versies/bytes stoppen de installatie. Geen nieuwe patchtool of dependency nodig.
Bij `npm ci --omit=dev` ontbreekt braces en wordt de dev-only patch overgeslagen.

De patch begrenst brace-/haakjesnesting op 100, inclusief caller-supplied ASTs en
striktere `maxDepth`-waarden. Cyclic parent-chains worden afgewezen. Normale glob-
functies blijven behouden. Een te diep patroon geeft een gerichte fout; callers
moeten die fout nog steeds afhandelen. Dit is geen algemeen CPU-/outputbudget.

Installaties met `--ignore-scripts` passen deze mitigatie **niet** toe en zijn
hiervoor ongeschikt. Regressies testen de daadwerkelijk geïnstalleerde bytes;
de normale CI gebruikt `npm ci` met scripts. De OSV-audit blijft actief en meldt
`GHSA-vfj7-8cjw-p6xm` zolang 3.0.3 als getroffen bekendstaat. Na afzonderlijk
akkoord voor voorstelcommit `e15d93d` kan uitsluitend de volledige `--all`-audit
de exacte triple tijdelijk als gemitigeerd accepteren, na verificatie van alle
beoordeelde geïnstalleerde hashes, ketens, verse productie-installatie, standalone
én live upstreammetadata. De waarschuwing blijft zichtbaar; andere findings en
iedere guardfout geven exit 1. Vervalt **17 oktober 2026 om 00:00 UTC**, zonder
verlenging. Geen officiële herstelreleaseclaim of verlaagde auditdrempel.
Zie `docs/proposals/braces-temporary-audit-exception.md` voor de exacte policy.

Zodra een officiële herstelrelease beschikbaar is: controleer advisory en
compatibiliteit, update gericht, verwijder de postinstall-hook/backport en behoud
de functionele regressies. Zie `docs/braces-security-review-2026-10-03.md` voor
bereikbaarheid en actuele testresultaten.
