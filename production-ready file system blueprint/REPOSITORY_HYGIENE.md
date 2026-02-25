# REPOSITORY_HYGIENE.md

> Use this file as the Git repository governance contract.
> The repository must contain only necessary, secure, and production-safe files.
> Sensitive or local-only files must never be committed.

---

## Rules of Repository Enforcement 

1. Never commit secrets.
2. Never commit local configuration files.
3. Never commit build artifacts.
4. Never commit OS/system junk files.
5. Never commit dependency vendor directories unless required.

For every repo change:
- ✅ Confirm no secrets introduced
- ✅ Confirm .gitignore is updated if needed
- ✅ Confirm no local-only files added
- ✅ Confirm no unnecessary large files added

If sensitive data is detected:
- Stop
- Identify file
- Recommend removal + history cleanup

---

# 1. Files That Must NEVER Be Committed

## Secrets & Environment Files

- `.env`
- `.env.local`
- `.env.production`
- `.env.staging`
- Any file containing:
  - API keys
  - database passwords
  - private tokens
  - JWT secrets
  - payment secrets
  - SSH keys

Instead:
- Provide `.env.example` with placeholders only.

---

## Local Development Files

- `.DS_Store`
- `Thumbs.db`
- IDE folders (`.vscode/`, `.idea/`) unless intentionally shared
- Local database files
- Debug logs
- Temporary exports
- Coverage reports (unless required)
- Local test data dumps

---

## Build Artifacts

- `dist/`
- `build/`
- `.next/`
- `out/`
- `target/`
- `bin/`
- Compiled binaries
- Generated bundles
- Compiled assets

Build output should be generated during CI/CD, not committed.

---

## Dependency Folders (Usually Excluded)

- `node_modules/`
- `vendor/`
- `packages/` (unless monorepo structure)
- Any package manager install directory

---

# 2. Required Repository Files

Every production-ready repo must include:

- README.md
- LICENSE (if applicable)
- SECURITY_CHECKLIST.md
- ARCHITECTURE.md
- CODING_STANDARDS.md
- TESTING_STRATEGY.md
- ERROR_HANDLING_POLICY.md
- API_CONTRACT.md
- DEPLOYMENT_CHECKLIST.md
- UI_UX_IMPROVEMENT_GUIDELINES.md
- REPOSITORY_HYGIENE.md
- `.gitignore`
- `.env.example`

Optional but recommended:
- CONTRIBUTING.md
- CHANGELOG.md

---

# 3. .gitignore Policy

.gitignore must include:

- Environment files
- OS junk files
- Dependency folders
- Build outputs
- Logs
- Test coverage
- Temporary files

Never rely on developers remembering manually — enforce via .gitignore.

---

# 4. Git History Protection

If secrets were committed:

1. Rotate the secret immediately.
2. Remove the file.
3. Rewrite git history (filter-repo/BFG).
4. Force push only if safe and coordinated.
5. Document incident.

Never assume deleting file removes secret from history.

---

# 5. Commit Standards

Each commit must:

- Have meaningful message
- Not mix unrelated changes
- Not include commented-out large code blocks
- Not include debugging code

Good commit message:
- "Add rate limiting to login endpoint"
- "Refactor user service for separation of concerns"

Bad:
- "fix stuff"
- "update"
- "changes"

---

# 6. Branching Rules

Recommended:

- main (protected)
- dev (optional)
- feature/*
- hotfix/*
- release/*

Rules:

- No direct commits to main in production repos.
- Use pull requests.
- Require review before merge (if team project).

---

# 7. Large File Policy

Do NOT commit:

- Large binaries
- Videos
- Archives
- Database dumps

If needed:
- Use object storage (S3 etc.)
- Use Git LFS if absolutely required

---

# 8. CI/CD Safeguards

Before merging:

- Tests must pass
- Lint must pass
- Security scan must pass
- No secrets detected

CI should:
- Reject commits containing `.env`
- Reject large suspicious files

---

# 9. Repository Size Discipline

Avoid:

- Unused files
- Dead code
- Old backups
- Unused feature branches lingering

Clean regularly.

---

# 10. Change Control Rule for Contributors

When modifying repo:

1. Check if new files need .gitignore updates.
2. Confirm no secrets introduced.
3. Confirm no local-only files added.
4. Confirm no build artifacts committed.
5. Confirm repo structure remains clean.

If repository hygiene is violated:
- Identify issue
- Provide cleanup plan

---

# 11. Definition of Repository Clean

A repository is clean when:

- No secrets in history
- No local files committed
- No build artifacts committed
- .gitignore properly configured
- Documentation complete
- Structure aligned with ARCHITECTURE.md

---

## How to run this repository hygiene guide (operator procedure)

**Command template:**

“Using REPOSITORY_HYGIENE.md,
audit this repository for cleanliness and security.
Identify files that should not be committed.
Recommend .gitignore improvements.
Check for secrets.
Confirm repository is production-safe.”

---
