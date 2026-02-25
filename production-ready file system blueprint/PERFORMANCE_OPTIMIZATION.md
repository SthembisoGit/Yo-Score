# PERFORMANCE_OPTIMIZATION.md

> Use this file as the performance governance contract.
> Optimization must be measured, not guessed.

---

## Rules of Performance Enforcement (AI MUST FOLLOW)

1. Measure before optimizing.
2. Never sacrifice clarity for micro-optimization.
3. Optimize bottlenecks, not hypothetical problems.
4. Avoid premature abstraction.

For every performance change:
- ✅ Identify bottleneck
- ✅ Explain measurement method
- ✅ Explain expected gain
- ✅ Confirm no architectural violation

---

# 1. Backend Performance Rules

- Avoid N+1 queries
- Use pagination
- Use caching only when necessary
- Use async/background jobs for heavy tasks
- Avoid blocking I/O

---

# 2. Frontend Performance Rules

- Avoid large unnecessary dependencies
- Lazy load large modules
- Optimize images
- Avoid excessive re-renders

---

# 3. Caching Rules

Cache only:
- Safe read-heavy data
- Idempotent data

Never cache:
- Sensitive personalized data unless scoped properly

---

# 4. Scalability Discipline

Design must handle:
- Horizontal scaling
- Stateless services
- Database connection pooling

---

## Command Template

“Using PERFORMANCE_OPTIMIZATION.md,
analyze performance for: {feature/endpoint}.
Identify bottlenecks.
Suggest safe optimizations.
Confirm no architectural or security regression.”

---