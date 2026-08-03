# Security review — FAIL

- Reviewed commit: `af82bf6271ac28c8adb172aea8ed9f9b1ffb52ab`
- Scope: tracked source at `/tmp/jiraman-review-af82-security`; read-only review.
- Result: `BLOCK` / `REQUEST_CHANGES`.

## Skill-perspective check

Loaded and applied `omo:remove-ai-slops` and `omo:programming` before judging tests and maintainability. The shared secret matching module is a reasonable reuse seam and does not introduce an untyped escape hatch, needless parsing, or needless abstraction. The new test is relevant, but it is incomplete: it tests token *formats* and the unprefixed exact credential keys, while missing realistic generic/provider-prefixed environment variable names. This violates the remove-ai-slops requirement to lock the observable security behavior, and the programming perspective rejects the resulting brittle/implementation-shaped coverage.

## Findings

### CRITICAL

None.

### HIGH

1. Generic/provider-prefixed secret assignments bypass both CI redaction and archive scanning.

   - Locations: `scripts/sensitive-content.mjs:9`, consumed by `scripts/sanitize_ci_log.sh:17` and `scripts/scan_package_sensitive.sh:26`.
   - Cause: the credential-assignment expression only recognizes a word-boundary followed by a short exact key such as `access_token` or `client_secret`. In identifiers such as `GITHUB_TOKEN`, the underscore before `TOKEN` is a word character, so no word boundary exists; `token` itself is also absent from the accepted keys.
   - Safe reproduction, using a generated non-real 32-character marker and never printing it: a line named `GITHUB_TOKEN` remains byte-identical after `sanitize_ci_log.sh`; `scan_package_sensitive.sh` exits `0` for a package containing only that line. The same probe with an Authorization header redacts and makes the scanner exit `1`, confirming the harness.
   - Impact: a common CI environment-variable-style credential can be printed to the GitHub Actions raw log, then copied to the supposedly sanitized artifact because `.github/workflows/ci.yml:22-26` relies exclusively on this sanitizer. The package scanner also admits such content.
   - Required fix: make the assignment detection cover generic `token` plus provider-prefixed credential variable names (for example `GITHUB_TOKEN`, `SLACK_TOKEN`, `AZURE_CLIENT_SECRET`) without relying on an internal word boundary immediately before the final component. Apply it in the shared matcher, then add adversarial tests proving both sanitizer redaction and package-scan rejection for generic/provider-prefixed names. Keep test data dynamically generated or otherwise excluded from the repository secret scan.

### MEDIUM

None.

### LOW

None.

## Verification and audit notes

- `./verify.sh --source-tree` passed.
- `git diff --check` passed for the reviewed commit.
- `npm test` could not run because this isolated checkout has no installed `vitest` binary; no dependency installation was performed in the read-only review.
- Inspected the CI workflow: it captures release-gate output privately, sanitizes before `cat` and artifact upload, and removes the raw log on exit. The high finding defeats that otherwise-correct pre-output boundary.
- Inspected the installer: staging and backup directories are mode `0700`; state directories/files are forced to `0700`/`0600`; managed-boundary symlink rejection and staged atomic swaps address the tested symlink/race path. No separate blocker found there.
- Inspected action state and prompt contracts: canonical action hashing, complete approval checks, state map-key binding, non-replay transitions, MCP external ownership, schema-compatible unambiguous tool selection, and `ask`-permission requirements are present. No separate blocker found there.

## Blockers

- Fix the HIGH secret-matcher bypass and add end-to-end sanitizer/package-scanner regression coverage before approval.
