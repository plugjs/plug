# Working on cov8

This file records the architecture, decisions, and verification workflow established
while improving cov8. It applies to this workspace; run the commands below from the
repository root. Recheck the current implementation before relying on historical
test counts or coverage figures.

## Collaboration preferences

- Keep responses and progress updates terse.
- When asked to explain a change before implementing it, describe the concrete
  approach and wait for the user's go-ahead.
- Prefer top-level helpers with explicit arguments over functions nested in
  `Coverage.pipe()`. This is a preference, not a ban on all local functions.
- Use meaningful regression tests. Remove unreachable code instead of adding
  coverage-ignore comments to reach a percentage.
- Preserve unrelated user edits. Commit only when requested; inspect the current
  diff because the user frequently commits between turns.

## Architecture

- `src/index.ts`: public options, `Pipe` augmentation, and registration of the
  `.coverage()` plug.
- `src/cli.ts`: parses CLI options, optionally runs a command with V8 coverage
  collection, selects sources, and invokes `Coverage`. It can also process an
  existing coverage directory. CLI code is excluded from measured coverage.
- `src/analysis.ts`: reads Node.js `coverage-*.json` files, converts V8 ranges into
  execution counts indexed by UTF-16 offsets, maps source positions to generated
  positions, and combines results across scripts and coverage files.
- `src/report.ts`: parses original sources with Babel, walks AST nodes, applies
  ignore/skip rules, and builds per-file and aggregate coverage results.
- `src/coverage.ts`: coordinates analysis, checks thresholds, emits console
  messages, and optionally writes report files. HTML comes from `@plugjs/cov8-html`.

Coverage percentages measure **AST nodes**, not lines or characters. Each counted
node queries the analyser at its starting position. Character coverage is painted
over node spans; children can overwrite parent spans. Comments are marked skipped
after traversal. This order matters.

## Coverage representation and reporting

`CoverageResult` contains original `code`, `codeCoverage`, `uncoveredLines`, and
`nodeCoverage`.

- `codeCoverage` has one entry per UTF-16 code unit: `-2` means skipped, `-1` means
  explicitly ignored, `0` means uncovered, and positive values are execution counts.
- Skipped nodes do not enter node totals. Ignored nodes enter the total but are
  excluded from the percentage denominator.
- Coverage is `floor(100 * coveredNodes / (coveredNodes + missingNodes))`.
  It is `null` when no counted, non-ignored nodes remain, including empty files.
- `uncoveredLines` contains unique, one-based, ascending line numbers, including
  partially uncovered lines. Compute it from the **final** character coverage after
  comment cleanup, selecting only values equal to zero.
- Collect lines in a `Set<number>` while scanning source order. Do not use default
  `.sort()` or `.toSorted()`: these sort lexicographically (`1, 10, 2`). No sorting
  is needed because insertion order is already numeric source order.
- LF advances the line counter; CR is excluded as a coverage-bearing character.
  Current handling supports LF and CRLF, not every JavaScript line terminator.
- Do not derive uncovered lines directly from raw V8 coverage or generated line
  lengths: those lack AST exclusions and can describe generated rather than original
  source. A final linear scan is intentional.
- The top-level `reportUncovered` helper formats consecutive lines as ranges using
  an ellipsis, e.g. `12…15, 20, 25…28`. It suppresses empty lists. Callers gate it
  on `reportUncoveredLines` and pass the file's ERROR/WARN/NOTICE severity.

Report output consists of `report.json`, `index.html`, and `report.js`. JSON uses
absolute source paths; JSONP uses paths relative to the input file set and includes
a directory tree. Every directory-tree node must use `Object.create(null)` so names
such as `constructor`, `toString`, and `__proto__` remain ordinary directory keys.

## Source maps, aliases, and analyser lifetime

- Positions use source URLs, one-based lines, and zero-based columns.
- The plug defaults to `least_upper_bound` for original-to-generated lookups.
  Passing `undefined` directly to `createAnalyser` leaves the source-map library's
  default bias in effect; do not document those defaults as interchangeable.
- Bias `none` requires exact original positions. One original position can map to
  multiple generated locations: retain all locations and sum their execution
  counts. Keeping only the last mapping can turn covered code into uncovered code.
- `hasMapping()` checks mapping availability independently of execution count.
  A mapped but unexecuted location must still return true. Direct script analysers
  treat all positions in their matching source as mapped.
- Node can provide a source-map cache entry with `data: null` when a map is missing.
  Only use the source-map branch when `mapping?.data` exists; otherwise allow direct
  script coverage to match.
- Canonicalize paths for matching, but preserve requested source paths in reports.
  Node normally records real paths; callers may select symlinked files/directories.
  Pass the recorded source URL into the underlying analyser, not its requested alias.
- Canonicalization falls back to the original URL if realpath fails. Coverage may
  include temporary or unrelated scripts that have since been deleted.
- Shared analysers must be initialized and destroyed once even when several aliases
  or source-map sources refer to them. Do not duplicate execution counts for aliases.
- `Coverage.pipe()` destroys the initialized analyser in `finally` around report
  generation, including when source parsing fails.
- `combineCoverage()` always receives a `Set`; its old undefined-input branch was
  unreachable and was removed.

## TypeScript and ignore directives

- Runtime namespaces skip declaration syntax and names but traverse their bodies,
  including nested/dotted namespaces. Ambient namespaces/modules remain skipped.
- Runtime enums count members and initializer expressions, not the declaration
  wrapper/name. Enum export wrappers are skipped so erased declarations do not
  leave a counted export node behind.
- A `const enum` can be erased by `tsc` or preserved by compiler/transpiler options.
  Do not blindly count or skip all const enums. Current detection requires an exact
  mapping at at least one member's starting position before visiting its members.
  This is evidence from recorded mappings, not knowledge of compiler settings;
  missing mappings cannot establish whether an unobserved enum was preserved.
- Interfaces, type aliases, overload signatures, type references, and declarations
  explicitly marked `import type`/`export type` are skipped by the relevant rules.
- Both `coverage ignore` and `istanbul ignore` are supported. Targets are `test`,
  `if`, `else`, `try`, `catch`, `finally`, `next`, `prev`, and `file`.
- File-ignore detection examines leading comments on
  `tree.program.directives[0] ?? tree.program.body[0]`. Babel stores directives such
  as `"use strict"` separately from body statements. Do not revert to checking only
  the first body statement or broaden this to arbitrary comments later in the file.
- Preserve coverage-ignore directive syntax when editing comments: those comments
  affect execution of the analyser, not just documentation.

## Public options and CLI details

- Overall minimum defaults to 50%; per-file minimum defaults to the overall minimum.
- Overall optimum defaults to `round((100 + minimumCoverage) / 2)`; per-file optimum
  defaults to `round((100 + minimumFileCoverage) / 2)`. Both are 75% with default minima.
- Below-minimum results fail; below-optimum results warn.
- `reportUncoveredLines` defaults to false. CLI `--lines`/`-l` is a boolean option;
  honor its parsed value so `--no-lines` and `--lines=false` disable it.
- Put the `CoverageReportOptions` overload before the broader `CoverageOptions`
  overload. A typed report-options variable must return `Pipe`, allowing chaining;
  calls without report output are typed as `Promise<undefined>`.
- Default source directory is `src`. The glob matches `.js`, `.cjs`, `.mjs`, `.ts`,
  `.cts`, and `.mts`, excluding `.d.ts`, `.d.cts`, and `.d.mts`.
- Keep inline documentation and CLI help aligned with implementation. Avoid stale
  descriptions of cov8 as a test runner, source maps as sitemaps, or `createAnalyser`
  as returning a report. It returns an initialized analyser.

## Verification

Run from the repository root:

```sh
npm run test workspace=cov8 reportUncovered=true
node_modules/.bin/eslint workspaces/cov8/src/*.ts workspaces/cov8/test/test.ts
node_modules/.bin/tsd test-d --files 01-cov8.test-d.ts
git diff --check
```

The build properties use `workspace=cov8`, not `--workspace cov8`. The test command
transpiles the workspaces, checks test types, runs the cov8 suite, and prints source
coverage with uncovered lines. Wait for completion and inspect the final report.
It cleans generated output during rebuilding: do not run commands against `dist/`
concurrently with that rebuild.

The last full functional verification in this session passed **39 specs** and
reported **100% for every measured cov8 source file**; `cli.ts` was `n/a`. This is
a historical baseline, not a claim about future edits or completeness of behavior.
Subsequent documentation edits passed lint and a CLI help smoke test, and core
transpiled output was compared with comments removed to confirm no logic changes.

Tests live in `test/test.ts`; public overload regression tests live in
`../../test-d/01-cov8.test-d.ts`. Useful patterns established here:

- Generate real V8 coverage by executing fixture scripts with the project's `exec`
  helper and a temporary `coverageDir`.
- Use real source maps for integration tests. `transpileModule` preserves const
  enums; use `createProgram` with explicit `preserveConstEnums` to test erasure too.
- Use `SourceMapGenerator` and two generated copies of one original location to
  test exact mapping aggregation: first only, second only, both, and neither.
- Resolve temporary directories with `realpath` unless testing aliases intentionally
  (macOS `/var` versus `/private/var` can otherwise obscure the intended test).
- Destroy analysers and remove temporary directories in `finally`; restore mocks.
- Test serialized JSONP directory trees, not only helper calculations.
- Exercise CLI booleans with actual commands after the build completes. CLI source
  is excluded from the measured coverage target, so 100% does not verify its behavior.
- Avoid merging unrelated temporary and repository file sets just to trigger a
  parsing failure: merging can fail before the plug runs and invalidate the test.

## Known limitations explicitly left unchanged

The user reviewed and declined fixes for the following. Do not quietly expand scope
to fix them unless asked:

1. Repeated `--sources` options: the parser returns an array but the CLI pushes it
   as one element; this can select no files. CLI help no longer promises repeated use.
2. Specifier-level type modifiers, such as `import { type Foo } from "./types"`,
   can count erased syntax as executable. Mixed import/export specifiers are not
   fully handled. The user considers this unsupported usage; no new rejection was added.
3. Bare CR, U+2028, and U+2029 line terminators can produce incorrect coverage offsets
   and uncovered-line numbers. The user explicitly accepted leaving this limitation.

Do not turn these accepted limitations into new warnings, validation, or fixes
without a new request.
