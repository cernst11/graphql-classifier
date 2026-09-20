# graphql-classifier

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

Scan a GraphQL schema and get a lint-style report of what's risky, sensitive,
or poorly named — powered by an LLM classifier, not regexes.

`graphql-classifier` walks a GraphQL SDL schema (a directory or glob of
`.graphql`/`.gql` files) and runs it through pluggable **analyses**, each
asking a single fast yes/no judgment per field via
[TypeSafe](https://typesafe.ai)'s Jev model. Out of the box it flags:

- **PII / sensitive data** — credit cards, SSNs, emails, credentials, precise geolocation
- **Authorization gaps** — root fields that look privileged but carry no auth directive
- **N+1 / expensive-field risk** — relation fields prone to unbounded fetches or per-item resolution
- **Documentation & naming** — seven independent lint rules (casing, boolean prefixes, plural collections, redundant prefixes, vague names, verbNoun mutations, argument naming) based on [Apollo's GraphQL naming guide](https://github.com/apollographql/skills/blob/main/skills/graphql-schema/references/naming.md)

Every finding carries a probability score, is tunable via `--threshold`, and
a full run typically finishes in a couple of seconds even on a 100+ field
schema, thanks to batched classification calls.

## Contents

- [Quickstart](#quickstart)
- [Analyses](#analyses)
- [Usage](#usage)
- [Example schemas](#example-schemas)
- [Development](#development)
- [License](#license)

## Quickstart

```sh
git clone https://github.com/cernst11/graphql-classifier.git
cd graphql-classifier
npm install
cp .env.example .env   # then set TYPESAFE_API_KEY
npm run build

node dist/cli.js examples/schema --threshold 0.5
```

`TYPESAFE_API_KEY` is read automatically by the TypeSafe SDK. If your `.env`
still uses the older `JEV` variable name, the CLI falls back to it with a
one-time warning — rename it to `TYPESAFE_API_KEY` to silence that.

## Analyses

| Analysis | id | Flags |
| --- | --- | --- |
| PII / Sensitive Data | `pii` | Fields that likely represent PII or other sensitive data — credit card numbers, SSNs, emails, health data, credentials, precise geolocation, biometrics. |
| Authorization Gaps | `auth-gap` | Root `Query`/`Mutation`/`Subscription` fields that look like they need authorization but have no auth-related directive (`@auth`, `@authenticated`, `@hasRole`, `@requiresScope`, `@permission`, `@policy`, `@isAdmin`, etc.) detected in the schema. Bare `@scopes` (a scope listing with no implied enforcement) does **not** count as coverage. **Heuristic** — it only sees the SDL, not resolver-level or middleware auth, so treat findings as triage signals, not ground truth. |
| Expensive Fields (N+1 Risk) | `expensive-field` | Relation fields at risk of the classic GraphQL N+1 problem or unbounded fetches: lists of related types with no pagination arguments, and to-one relations on types that themselves commonly appear inside a list elsewhere in the schema. **Heuristic** — combines a structural pre-filter (candidates only) with an LLM severity judgment; cannot see actual resolver batching (e.g. DataLoader) or database indexes. |

**Documentation & Naming** (per [Apollo's GraphQL schema naming guide](https://github.com/apollographql/skills/blob/main/skills/graphql-schema/references/naming.md)) is a *family* of seven narrowly-scoped lint rules rather than one opaque flag, so a report says *which* convention a field violates:

| id | Flags |
| --- | --- |
| `doc-description` | Missing, vague, or unhelpful description whose purpose isn't self-evident. |
| `doc-naming-style` | Casing not camelCase, Hungarian-notation prefixes (`strX`, `intY`, `TUser`), or unclear abbreviations. |
| `doc-naming-clarity` | Name redundantly repeats its own parent type (`userId` on `User`), is vague/getter-style (`data`, `getFullName`), or leaks implementation details (`mysql_id`). |
| `doc-boolean-prefix` | Boolean-typed field not prefixed with `is`/`has`/`can`/`should`. Only evaluates Boolean fields. |
| `doc-plural-collection` | List-typed field using a singular noun. Only evaluates list fields. |
| `doc-mutation-verb-noun` | Mutation-type field not following a clear `verbNoun` pattern. Only evaluates fields on the schema's actual Mutation type. |
| `doc-argument-naming` | Generic/unclear argument names (e.g. `filter`/`options` typed as a raw blob). Only evaluates fields that have arguments. |

By default all ten analyses run; pick a subset with `--analysis`, including
the whole doc-quality family at once with the wildcard `"doc-*"`.

## Usage

```sh
npm run build
node dist/cli.js "examples/schema/**/*.graphql"
# or point at a directory (defaults to **/*.{graphql,gql} under it)
node dist/cli.js examples/schema --threshold 0.5 --out report.json

# run a subset of analyses
node dist/cli.js examples/schema --analysis pii
node dist/cli.js examples/schema --analysis pii,auth-gap

# the whole doc-quality lint rule family, or just one rule from it
node dist/cli.js examples/schema --analysis "doc-*"
node dist/cli.js examples/schema --analysis doc-boolean-prefix

# see what's available
node dist/cli.js --list-analyses
```

During development, skip the build step:

```sh
npm run dev -- examples/schema
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `<source>` (positional) | — | Glob pattern or directory of `.graphql`/`.gql` files. Required unless `--list-analyses` is given. |
| `--analysis <ids>` | `all` | Comma-separated analysis ids to run, or `all`. A token ending in `*` (e.g. `"doc-*"`) matches every id with that prefix — quote it so your shell doesn't glob-expand it. See tables above for ids. |
| `--list-analyses` | — | Print available analyses (id, label, description) and exit. |
| `--threshold <0-1>` | `0.6` | Probability at/above which a field is flagged (applies to every analysis run). |
| `--out <file>` | none | Also write the full JSON report to this path. |
| `--format <table\|json>` | `table` | stdout rendering. |
| `--concurrency <n>` | `4` | Max concurrent classification batch calls, **per analysis** (running `all` — 10 analyses — can peak at up to `10 × concurrency` calls in flight across analyses). |
| `--model <name>` | SDK default | Optional Jev model override. |

### Exit codes

- `0` — ran successfully, nothing flagged by any analysis run.
- `1` — ran successfully, at least one field flagged by at least one analysis
  (useful for CI gating).
- `2` — execution error (bad glob, no matching files, missing/invalid API key,
  unknown `--analysis` id, request errors).

### Output

Table mode prints one section per analysis, e.g.:

```
== PII / Sensitive Data (pii) ==
┌─────────────┬───────┬──────────────┬─────────────┬─────────────┐
│ Parent Type │ Field │ GraphQL Type │ Probability │ Description │
├─────────────┼───────┼──────────────┼─────────────┼─────────────┤
│ ...
└─────────────┴───────┴──────────────┴─────────────┴─────────────┘

== Authorization Gaps (auth-gap) ==
...
```

A one-line summary (printed to `stderr`, so it never corrupts `--format json`
or `--out` output) reports per-analysis flag counts, total API calls, and a
load/extraction/classification timing breakdown, e.g.:

```
Ran 4 analysis(es) [pii: 63/128 flagged, doc-description: 0/128 flagged, auth-gap: 6/9 flagged, expensive-field: 1/13 flagged],
via 14 API call(s) in 1.65s (schema load 34ms, extraction 0ms, classification 1.62s).
```

The JSON report (`--format json` or `--out report.json`) has one entry per
analysis in `analyses[]`, each with its own `model`, `totalFieldsScanned`,
`flaggedCount`, `apiCallCount`, and sorted `fields[]` — plus top-level
`totalApiCallCount` and `timing`.

## Example schemas

`examples/schema/` contains two example GraphQL schemas:

**Small fixture** (`users.graphql`, `billing.graphql`): A basic two-file setup
with an `extend type User` demonstrating schema merging. Includes obviously-sensitive
fields (`ssn`, `email`, `creditCardNumber`) and benign ones (`id`, `createdAt`).
Quick sanity check after setup:

```sh
npm run build
node dist/cli.js examples/schema --threshold 0.5
echo $?          # 1, since sensitive fields were flagged
```

**Large example** (`users-large.graphql`): A comprehensive e-commerce schema
with 128 fields across User, Address, Location, PaymentMethod, BillingProfile,
Order, Product, and mutation input types, plus `Query`/`Mutation` root fields
useful for exercising `auth-gap`. Includes realistic sensitive data: credit
card numbers, CVVs, SSNs, passwords, API keys/tokens, precise geolocation
coordinates, phone numbers, addresses.

```sh
node dist/cli.js examples/schema --threshold 0.5 --out report.json
```

`examples/naming-issues/bad-naming.graphql` is a separate schema (own
directory, so it never merges with `examples/schema/`) seeded with one
deliberate violation per rule in the naming guide above — bad casing
(`user_name`, `UserEmail`, `PHONE_NUMBER`), missing boolean prefixes
(`active`), singular collections (`post`, `follower`), redundant type-name
prefixes (`userId`, `userEmail`), Hungarian notation (`strDisplayName`,
`intAge`, `bIsAdmin`), vague/getter names (`data`, `info`, `getFullName`,
`getData`), implementation leakage (`mysql_id`, `redis_cache_key`), an
unclear abbreviation (`crtAt`), and vague mutations/arguments
(`process(filter: String, options: String)`) — plus a handful of
well-named, undocumented-but-self-evident fields (`id`, `createdAt`,
`email`) that should stay unflagged, for contrast:

```sh
node dist/cli.js examples/naming-issues --analysis "doc-*" --threshold 0.5
```

## Development

```sh
npm run typecheck
npm test
```

Architecture: each analysis implements the `Analysis` interface
(`src/analyses/types.ts`) — `selectFields` (which fields it evaluates, given
the extracted fields and the schema; a deterministic pre-filter that also
keeps API calls down, e.g. `doc-boolean-prefix` only ever looks at
Boolean-typed fields) and `buildQuestion` (the per-field Noul
instructions/criteria). `pii.ts`, `auth-gap.ts`, and `expensive-field.ts`
each stand alone; the `doc-quality/` directory holds a *family* of small,
single-concern rule modules (one file per rule) plus `doc-quality/index.ts`,
which exports them as a flat array — this is the pattern to follow when a
concern decomposes into several independently-reportable checks rather than
one broad judgment. `src/analyses/registry.ts` registers every analysis
(spreading the doc-quality family in) and resolves `--analysis` input,
including the `id*` prefix-wildcard. `src/classifier.ts` is analysis-agnostic:
it batches fields, builds the shared-`state` Jev request from whichever
analysis it's given, and maps responses back by field path.
`src/analysis-runner.ts` runs a list of analyses concurrently over their own
candidate subsets. `src/report.ts` renders one section per analysis result
(table) or one entry per analysis (JSON) — so running the whole doc-quality
family produces seven separate, individually-labeled sections instead of one
merged one.

`field-extractor.ts` and `schema-loader.ts` are tested against real/inline
GraphQL SDL with no network calls. `classifier.ts` and `analysis-runner.ts`
take an injectable `ClassifierClient`, so their tests — and each analysis's
own `selectFields`/`buildQuestion` tests — use fakes rather than the real Jev
API.

## License

MIT — see [LICENSE](LICENSE).
