# Phase 3: User Interface

## 1. Design User Interfaces
Implemented interfaces include:
- Login and Signup pages,
- Developer Dashboard,
- Challenges list and Challenge Session page,
- Submission Result page,
- Work Experience page,
- Profile page,
- Admin Dashboard.

Key UI design characteristics:
- category-driven challenge start,
- visible seniority and trust indicators,
- countdown timer and session status visibility,
- integrated coding editor and run output panel,
- AI helper panel with explicit policy limits,
- admin controls for challenge publishing workflow.

## 2. Demo the Prototype
The prototype demonstration covers:
1. user authentication,
2. challenge assignment by selected category,
3. monitored challenge session with timer,
4. code submission and asynchronous judging,
5. result and feedback display,
6. dashboard updates,
7. admin challenge and risk monitoring workflows.

## 3. Evaluate User Interface (Heuristic Evaluation)
Method used: Nielsen usability heuristics.

| ID | Heuristic | Observed Defect | Severity | Location | Corrective Action |
|---|---|---|---|---|---|
| H-01 | Visibility of system status | Queue and timer status are separated in some flows | Medium | Session and result pages | Consolidate operational state indicators |
| H-02 | Consistency and standards | Status labels differ across pages | Low | Dashboard and result pages | Use one standardized status vocabulary |
| H-03 | Error prevention | Missing category selection can interrupt assignment flow | Low | Challenge start flow | Keep category as required before request |
| H-04 | Help and documentation | AI helper boundaries may be unclear to first-time users | Medium | Challenge helper panel | Display concise policy note in panel header |
| H-05 | Recognition over recall | Verification status terms need explicit meaning | Low | Work Experience page | Add short explanatory text/tooltips |

## 4. Validate Fields (Verification and Validation)
### Authentication Fields
- valid email format required,
- password required,
- role constrained by server-side rules.

### Challenge Fields
- challenge identifier required,
- language required,
- submission payload validated before queueing.

### AI Helper Fields
- session/challenge context required,
- hint sequence validated,
- request blocked when limit is reached.

### Work Experience Fields
- company name required,
- role required,
- duration required and numeric,
- evidence links validated as URL format when provided.

### Admin Configuration Fields
- category required,
- seniority required,
- duration required and bounded,
- publish action allowed only after readiness validation.
