# External Review Package Log

## Elemental Survivor V0.1

- Created: 2026-07-31
- Version: Playable Core V0.1
- Commit baseline: N/A — the workspace was not a Git repository.
- Git state: local-only; no commit, push, PR, or deployment was performed.
- Archive: `artifacts/review/elemental-survivor-v0.1-review.zip`
- Size: 556,592 bytes
- Files: 50
- SHA-256: `9247DCC94D1E9D38EAF9232FDB75CA8F08B7F160A4484EEF26BAD015418550D1`

## Packaging policy

The archive was built from an explicit allowlist: game source, tests, project configuration, design documents, selected screenshots, and local playtest telemetry. It excludes `.git`, `node_modules`, build output, coverage, caches, environment files, databases, browser state, cookies, tokens, credentials, and private keys.

## Pre-upload checks

- Sensitive filename scan: no matches.
- Secret-value pattern scan: no matches.
- Archive content inspection: 50 expected files; no excluded directory or file type present.
- Package manager audit at installation: 0 vulnerabilities.

The archive does not contain browser profiles or ChatGPT account data.

## Elemental Survivor V0.2

- Created: 2026-07-31
- Version: Review Candidate V0.2
- Commit baseline: N/A — the workspace is not a Git repository.
- Git state: local-only; no commit, push, PR, or deployment was performed.
- Archive: `artifacts/review/elemental-survivor-v0.2-review.zip`
- Size: 584,942 bytes
- Files: 58
- SHA-256: `FD9C7C74FAB30323DBA5597E1AA1807BA47FEDD8B668C5FC9B3CAB4E7FCBC88D`

### V0.2 pre-upload checks

- Built from an explicit allowlist using `scripts/package-review.ps1`.
- Sensitive filename scan: no matches.
- Secret-value pattern scan: no matches.
- Archive content inspection: 58 expected files; no excluded path or sensitive extension present.
- Included evidence: deterministic 30-seed telemetry, real three-minute browser telemetry, and selected V0.2 screenshots.
- The local staging copy remains under `artifacts/review-stage-v0.2` because the environment safety policy rejected its cleanup command; it is not part of the ZIP.

## Elemental Survivor V0.3

- Created: 2026-07-31
- Version: Review Candidate V0.3
- Commit baseline: N/A — the workspace is not a Git repository.
- Git state: local-only; no commit, push, PR, or deployment was performed.
- Archive: `artifacts/review/elemental-survivor-v0.3-review.zip`
- Size: 649,019 bytes
- Files: 61
- SHA-256: `06C50A32A86CA0B6D63433CBFDA75FEC123CA1FC2773AB0C277B7A04699133A5`

### V0.3 pre-upload checks

- Built from an explicit allowlist using `scripts/package-review.ps1`.
- Sensitive filename scan: no matches.
- Secret-value pattern scan: no matches.
- Archive content inspection: 61 expected files; no excluded directory or sensitive filename present.
- Included evidence: 63 unit/integration tests, one E2E flow, deterministic 30-seed balance telemetry, real three-minute browser telemetry, and V0.3 screenshots.
- The local staging copy remains under `artifacts/review-stage-v0.3`; it is not part of the ZIP.

## Elemental Survivor V0.4

- Created: 2026-07-31
- Version: Review Candidate V0.4
- Commit baseline: N/A — the workspace is not a Git repository.
- Git state: local-only; no commit, push, PR, or deployment was performed.
- Archive: `artifacts/review/elemental-survivor-v0.4-review.zip`
- Size: 675,943 bytes
- Files: 67
- SHA-256: `008A5E4E90AA6856062D8B555707F39219FF84AE7C50282EFCFB557E0BDC7D26`

### V0.4 pre-upload checks

- Built from an explicit allowlist using `scripts/package-review.ps1`.
- Sensitive filename scan: no matches.
- Secret-value pattern scan: no matches.
- Archive content inspection: 67 expected files; no excluded directory or sensitive filename present.
- Included evidence: 69 unit/integration tests, one E2E flow, automatic 30-seed balance telemetry, two 30-seed route simulations, real three-minute browser telemetry, and V0.4 screenshots.
- The local staging copy remains under `artifacts/review-stage-v0.4`; it is not part of the ZIP.
