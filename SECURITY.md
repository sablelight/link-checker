# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| {{LATEST_VERSION}} | ✅ |
| {{PREVIOUS_VERSION}} | ✅ (security fixes only) |
| < {{OLDER_VERSION}} | ❌ |

## Reporting a Vulnerability

**Do not open a public issue.** Security vulnerabilities should be reported privately.

### How to Report

1. **GitHub Security Advisories** (preferred):
   - Go to the [Security tab](https://github.com/sablelight/link-checker/security)
   - Click "Report a vulnerability"
   - Fill in the details

2. **Email**: `sablelight@proton.me` with subject `[SECURITY] link-checker`

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact info for follow-up

### Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | 48 hours |
| Initial assessment | 7 days |
| Fix released (critical) | 14 days |
| Fix released (non-critical) | 30 days |

## Security Practices

### Dependency Management

- All dependencies scanned via Dependabot + Renovate
- `go mod audit` / `npm audit` / `pip-audit` in CI
- Minimal dependency policy — prefer stdlib

### Secrets

- **Never** commit secrets (API keys, tokens, passwords)
- Use `.env` for local dev (in `.gitignore`)
- CI secrets via GitHub Encrypted Secrets
- Production secrets via Vault / cloud secret manager

### Supply Chain

- Signed commits (GPG)
- Verified releases (SBOM via `syft`, attestations via `cosign`)
- Pinned dependency versions in `go.sum` / `package-lock.json` / `poetry.lock`

### Runtime

- Non-root containers (`USER nobody`)
- Read-only root filesystem where possible
- Dropped capabilities (`CAP_DROP_ALL`)
- Network policies (deny by default)

## Disclosure

Vulnerabilities will be disclosed via:

1. GitHub Security Advisory (public after fix)
2. Release notes
3. `CHANGELOG.md` entry

## Contact

For questions about this policy: `sablelight@proton.me`

---

*This policy applies to the `sablelight/link-checker` repository only.*