# Phase 1: Proposal

## 1. Name of the Project
**YoScore: AI-Aware Developer Trust and Skill Scoring Platform**

## 2. Domain Analysis
### 2.1 General Field of Business
YoScore is in the software skills assessment and technical trust-verification domain. It supports developer evaluation for hiring, training, and progression decisions.

### 2.2 Terminology and Glossary
- **Challenge**: timed technical task for a category and level.
- **Category**: role track such as frontend, backend, cloud, or security.
- **Seniority Band**: Graduate (0-6), Junior (7-24), Mid (25-60), Senior (61+ months).
- **Submission**: code sent for automatic judging.
- **Judge Run**: isolated execution against test cases.
- **Baseline**: expected runtime or memory reference per language.
- **Proctoring Session**: monitored challenge attempt.
- **Violation**: suspicious event (tab switch, camera off, etc.).
- **AI Coach**: constrained assistant that gives concept hints without full solutions.
- **Trust Score**: combined output from technical score, behavior, and trusted experience.

### 2.3 Business Environment Understanding
AI code assistants are widely adopted. This improves speed but can hide weak fundamentals when candidates cannot solve or explain work without direct code generation. Organizations need a system that allows AI support in a controlled way while still measuring real understanding.

### 2.4 Current Tasks and Procedures
- Candidates complete online coding tests with inconsistent proctoring.
- Recruiters manually interpret results with low confidence in anti-cheating controls.
- Work experience is often self-reported with limited verification.
- Good candidates are sometimes rejected due to weak CV presentation despite strong practical skill.

### 2.5 Customers and Users
- Developers and students proving practical coding ability.
- Admins operating challenges, judge settings, and policy controls.
- Recruiters and institutions consuming trust outcomes (dedicated recruiter portal is future scope).

### 2.6 Competing Software
- HackerRank
- Codility
- CodeSignal
- TestGorilla

### 2.7 Similarities to Other Domains
- Online examinations (integrity and identity assurance)
- E-learning competency platforms (rubric scoring and progression)
- Compliance systems (audit logs and evidence workflows)

## 3. Define the Problem
### 3.1 Difficulty
Many assessment systems cannot reliably prove whether a candidate understands the solution process, especially with unrestricted AI usage and weak proctoring.

### 3.2 Opportunity
Build a 3-tier system that:
- evaluates real code outcomes using automatic judging,
- monitors behavior with proctoring,
- supports AI guidance without full answer generation,
- routes tasks by category and seniority,
- and produces auditable trust scores.

## 4. Define the Scope (IRBM + Assess/Think/Envision/Plan)
### 4.1 Scope for Release 1 (2-day delivery)
In scope:
- Coding-only assessment (JavaScript and Python)
- Category plus seniority challenge assignment
- Timed sessions with offline continuity and reconnect submit
- Constrained AI coach (3 hints max)
- Evidence-based work experience with risk status
- Real developer and admin dashboards

Out of scope for this release:
- MCQ/explanation/scenario mixed assessments
- CV intelligence
- Soft-skill tracking

### 4.2 IRBM
**Inputs**
- Developer profiles, challenge bank, test cases, baselines, work-experience evidence links, proctoring settings, cloud services.

**Activities**
- Authenticate users, assign challenge by category and seniority, run proctored timed session, queue submission, judge code, compute trust score, monitor flagged records.

**Outputs**
- Submission scores, run-level test outcomes, proctoring logs, trust score and seniority badge, admin audit and risk queues.

**Outcomes**
- More reliable technical assessments.
- Lower cheating risk.
- Faster operational control for admins.

**Impact**
- Better interview shortlisting quality and fairer opportunities for skilled developers.

### 4.3 Assess / Think / Envision / Plan
**Assess**
- Current hiring assessments are inconsistent and vulnerable to tool misuse.

**Think**
- Causes: unbounded AI usage, weak proctoring integration, and non-standard scoring.
- Stakeholders: developers, employers, institutions, admins.

**Envision**
- Trusted AI-aware assessment where AI can assist understanding but cannot replace capability.

**Plan**
- Use the existing YoScore architecture.
- Ship Trust-Core MVP in 2 days.
- Document deferred features for Release 1.1+.

## 5. Vision and Objectives (SMART)
### 5.1 Vision
Enable trusted developer assessment in the AI era by measuring both what candidates solve and how they solve it.

### 5.2 SMART Objectives
1. Deliver a complete 3-tier Trust-Core MVP by deadline with all critical flows operational.
2. Ensure 100% of new submissions are judged asynchronously with lifecycle persistence.
3. Enforce AI Coach limit so 100% of sessions allow at most 3 hints.
4. Ensure timer and offline submit grace logic is enforced in 100% of session-linked submissions.
5. Route 100% of assigned challenges by selected category and valid seniority fallback rules.
6. Include evidence/risk status on all new work-experience entries.

## 6. Users of the System
- **Developer**
  - register, login, start challenge, request AI hints, submit solution, view scores.
- **Admin**
  - manage content, tests, baselines, publish status, queue health, proctoring policy, flagged experience, user roles.
- **Recruiter (limited in MVP)**
  - consumes outputs indirectly; dedicated portal deferred.

## 7. Mandatory Functions (CRUD)
- Add/register users.
- Add/update/delete challenges.
- Add/update/delete challenge test cases.
- Upsert baselines.
- Add/list reference documents.
- Add/list work-experience entries with evidence links.
- Update persistent proctoring settings.

## 8. Functional Requirements
- FR-01: User registration and authentication with RBAC.
- FR-02: Developer can request next challenge by category.
- FR-03: System assigns challenge by exact seniority, then lower fallback only.
- FR-04: Proctoring session start returns authoritative deadline metadata.
- FR-05: Session timer is visible and continuous, including offline periods.
- FR-06: Editor autosaves local draft during challenge.
- FR-07: If offline at deadline, editor locks and queues reconnect auto-submit.
- FR-08: Backend accepts reconnect submit only within 15-minute grace window.
- FR-09: Submissions are judged asynchronously with persisted per-test outcomes.
- FR-10: AI Coach provides concept guidance and small examples only.
- FR-11: AI Coach blocks hint request after third hint.
- FR-12: Work experience supports evidence links and risk-based status.
- FR-13: Trust score excludes flagged and rejected experience rows.
- FR-14: Dashboard shows trust score, seniority band, and score components.
- FR-15: Admin can audit flagged experience entries.

### Inputs, Outputs, Computations, Timing
- Inputs: credentials, category, code, language, evidence links, proctoring events.
- Outputs: judged result, score components, trust level, verification status, admin audit data.
- Computations: correctness, efficiency, style, behavior penalties, trust aggregation.
- Timing and synchronization: async queue processing with polling and deadline enforcement.

## 9. Non-Functional Requirements
- **Authentication**: JWT login/logout with protected admin routes.
- **Availability**: health endpoints and queue-backed processing.
- **Reliability**: persistent run logs and proctoring logs for audit.
- **Security**: role checks, hashed passwords, controlled CORS.
- **Performance**: submission endpoint returns quickly (queue-and-wait model).
- **Maintainability**: modular backend services and versioned docs.

## 10. Use Cases
Diagram source: `academic-submission/diagrams/use-case.puml`

### UC-01 Developer completes a trusted challenge
1. Developer selects category.
2. System assigns seniority-matched challenge.
3. Proctoring session starts with timer.
4. Developer writes code, optionally requests AI hints (max 3).
5. Submission is queued and judged.
6. Results and trust updates are shown on dashboard.

### UC-02 Admin publishes challenge safely
1. Admin creates challenge and sets seniority and duration.
2. Admin adds test cases and baselines.
3. System checks readiness.
4. Admin publishes challenge.

### UC-03 System updates trust score
1. On grade completion or work-experience update, system recomputes trust.
2. Trust components are persisted and returned to dashboard.

## 11. Tools and Technologies to be Used
### Product stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Queue: BullMQ + Redis (Upstash)
- Database: PostgreSQL (Supabase)
- Proctoring ML service: FastAPI (Python)
- Deployment: Render

### Free tools for academic deliverables
- PlantUML (diagram source)
- Kroki (diagram rendering)
- diagrams.net (optional final polish)
- LibreOffice (DOCX and PDF output)
- OBS Studio (prototype demo recording)
