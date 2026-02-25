# DATABASE_GUIDELINES.md

> Use this file as the database integrity and schema governance contract.
> Database design mistakes are expensive. Discipline is mandatory.

---

## Rules of Database Enforcement 

1. Never modify schema without migration.
2. Never run destructive changes without backup strategy.
3. All schema changes must be reversible.
4. Multi-tenant safety must be enforced at query level.
5. No business logic inside database unless explicitly approved.

For every schema change:
- ✅ Provide migration plan
- ✅ Provide rollback plan
- ✅ Explain performance impact
- ✅ Confirm indexes updated
- ✅ Confirm no data loss risk

Do NOT:
- Drop columns casually
- Remove constraints without review
- Disable foreign keys for convenience
- Introduce nullable fields without justification

---

# 1. Schema Design Rules

- Use explicit primary keys.
- Use foreign key constraints.
- Use created_at / updated_at fields.
- Use soft deletes only when necessary.
- Avoid generic “data” JSON dumping without structure.

---

# 2. Multi-Tenant Safety

Must enforce:
- tenant_id on tenant-owned tables
- Queries always filtered by tenant
- No cross-tenant access possible

Never rely on frontend to filter data.

---

# 3. Indexing Rules

- Index foreign keys.
- Index frequently filtered fields.
- Index unique constraints.
- Avoid over-indexing.

---

# 4. Migration Rules

Migrations must:
- Be atomic
- Be reversible
- Be tested in staging
- Avoid long locks in production

For destructive changes:
- Backup first
- Communicate risk
- Provide rollback

---

# 5. Query Discipline

- No SELECT *
- Use pagination
- Avoid N+1 queries
- Avoid unbounded scans

---

# 6. Data Integrity Rules

- Use constraints over application logic where possible.
- Use transactions for multi-step updates.
- Never leave partial state on failure.

---

## Command Template

“Using DATABASE_GUIDELINES.md,
review or implement schema changes for: {feature}.
Provide migration plan.
Provide rollback plan.
Confirm no tenant isolation violation.
Confirm performance impact.”

---