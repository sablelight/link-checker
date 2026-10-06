# Contributing to {{PROJECT_NAME}}

Thanks for your interest! This project welcomes contributions of all kinds.

## Quick Start

```bash
# 1. Fork the repo
# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/link-checker.git
cd link-checker

# 3. Create a branch
git checkout -b feature/your-feature-name

# 4. Make changes, test, commit
{{TEST_COMMAND}}

# 5. Push and open a PR
git push origin feature/your-feature-name
```

## Development Setup

### Prerequisites

- {{PREREQ_1}} (e.g., Go 1.23+)
- {{PREREQ_2}} (e.g., Redis 7+)
- {{PREREQ_3}} (e.g., Docker)

### Running Locally

```bash
# Copy example env
cp .env.example .env

# Start dependencies (if using Docker)
docker compose up -d

# Run the project
{{RUN_COMMAND}}

# Run tests
{{TEST_COMMAND}}
```

## Code Style

- **Go**: `gofmt`, `golangci-lint` (config in `.golangci.yml`)
- **Python**: `ruff` (config in `pyproject.toml`), `mypy --strict`
- **Node**: `eslint` + `prettier` (config in `eslint.config.js`)
- **C#**: `dotnet format`, Roslyn analyzers

Run linters before committing:
```bash
# Go
golangci-lint run

# Python
ruff check . && mypy --strict .

# Node
npm run lint

# C#
dotnet format --verify-no-changes
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

Longer description if needed.

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`

## Pull Request Process

1. **Title**: Clear, follows Conventional Commits
2. **Description**: What, why, how to test
3. **Tests**: All CI checks must pass
4. **Review**: At least one approval required
5. **Merge**: Squash and merge (default)

## Testing Guidelines

- **Unit tests**: Test one thing, fast, no external deps
- **Integration tests**: Real dependencies (Redis, DB), in `tests/`
- **Coverage**: Aim for >80% on new code
- **Race detector**: Always run with `-race` (Go) / `pytest-xdist` (Python)

## Reporting Security Issues

**Do not open a public issue.** See [SECURITY.md](SECURITY.md) for responsible disclosure.

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_behavior/). By participating, you agree to uphold it.

## Questions?

Open a [Discussion](https://github.com/sablelight/link-checker/discussions) or [Issue](https://github.com/sablelight/link-checker/issues/new/choose).