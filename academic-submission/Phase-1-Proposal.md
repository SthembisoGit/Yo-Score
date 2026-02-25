# Phase 1: Proposal

## 1. Name of the Project
**YoScore: Developer Trust and Skill Scoring Platform**

## 2. Domain Analysis
### 2.1 General Field of Business
YoScore operates in software development assessment, technical trust validation, and competency reporting. The platform supports assessment decisions for recruitment, internship placement, and skills development.

### 2.2 Terminology and Glossary
- **Challenge**: timed technical task assigned to a candidate.
- **Category**: assessment track such as frontend, backend, cloud, or security.
- **Seniority Band**: level derived from work-experience duration.
- **Submission**: candidate solution sent for automated evaluation.
- **Judge Run**: isolated execution of submitted code against test cases.
- **Baseline**: language-specific runtime and memory reference values.
- **Proctoring Session**: monitored assessment session.
- **Violation**: suspicious event recorded during proctoring.
- **AI Coach**: constrained guidance assistant for concept-level help.
- **Trust Score**: aggregate outcome from correctness, behavior, and validated experience.

### 2.3 General Knowledge and Business Environment
The current environment includes heavy coding-assistant tool usage in software development. This improves productivity but also introduces uncertainty in assessment credibility when candidates submit answers without demonstrating core understanding. Institutions and employers require auditable systems that measure both solution quality and candidate behavior during assessment.

### 2.4 Tasks and Procedures Currently Performed
- Online coding tests are conducted on various platforms with varying integrity controls.
- Final assessment interpretation often depends on manual review by recruiters or mentors.
- Work experience is commonly self-reported and may not include structured evidence.
- Assessment feedback is often insufficiently specific for targeted learner improvement.

### 2.5 Customers and Users
- Student developers and junior developers.
- Technical mentors and administrators.
- Recruitment teams and academic evaluators.

### 2.6 Competing Software
- HackerRank
- Codility
- CodeSignal
- TestGorilla

### 2.7 Similarities to Other Domains
- Online examination systems (identity and integrity controls).
- Learning management systems (competency tracking and reporting).
- Audit/compliance systems (event logging and traceability).

## 3. Define the Problem
The key difficulty is proving that a candidate can solve technical problems with understanding in a tool-assisted environment. Existing assessment approaches can produce scores without sufficiently reliable evidence of genuine capability or conduct.  
The opportunity is to provide a three-tier client-server solution that combines automated code evaluation, monitored session behavior, and evidence-aware trust reporting to improve assessment quality and confidence.

## 4. Define the Scope
### 4.1 Scope Boundary
The implemented scope includes:
- category-driven challenge assignment,
- seniority-aware challenge routing,
- timed proctored sessions,
- automated submission judging with persisted run results,
- AI coaching with policy limits,
- work-experience capture with evidence links and risk status,
- developer and admin reporting dashboards.

### 4.2 Integrated Result Based Management (IRBM)
**Inputs**
- user accounts, challenge bank, test cases, baselines, proctoring settings, work-experience evidence, cloud infrastructure.

**Activities**
- authenticate users, assign challenges, run proctored sessions, evaluate submissions, compute scores, generate reports, perform admin audits.

**Outputs**
- judged outcomes, run-level test results, trust scores, violation logs, risk queues, and dashboard summaries.

**Outcomes**
- improved assessment credibility,
- reduced manual verification effort,
- consistent reporting for academic and recruitment decisions.

**Impact**
- fairer assessment opportunities and stronger evidence-based shortlisting.

### 4.3 Assess / Think / Envision / Plan
**Assess**
- assessment integrity is inconsistent across current processes.

**Think**
- causes include unrestricted tooling dependence, weak monitoring integration, and fragmented scoring evidence; stakeholders are developers, admins, mentors, institutions, and recruiters.

**Envision**
- a trusted assessment environment where assistant support is controlled and understanding is measurable.

**Plan**
- implement and operate a complete three-tier assessment platform over the six-month WIL period, with documented results and evidence.

## 5. Vision and Objectives (SMART)
### 5.1 Vision
Provide an auditable, fair, and practical developer assessment system that measures both problem-solving outcomes and assessment integrity.

### 5.2 SMART Objectives
1. Maintain automated judging for all submitted challenges with stored run/test evidence.
2. Enforce timed session controls and deadline validation for all proctored attempts.
3. Enforce AI coaching policy limits for every active challenge session.
4. Route assigned challenges according to category and seniority rules.
5. Record work-experience entries with verification status and risk fields.
6. Provide dashboard and report outputs for developer and admin stakeholders.

## 6. Users of the System
- **Developer**
  - register/login, request assigned challenge, solve and submit, view score and feedback.
- **Admin**
  - configure and publish challenges, manage tests/baselines, monitor sessions, review risk records, manage roles.
- **Recruiter/Evaluator**
  - consume trust and performance outputs for decision support.

## 7. Mandatory Functions
The system supports Add/Register, Delete/Remove, and Update operations on core data:
- users,
- challenges,
- challenge test cases,
- challenge baselines,
- reference documents,
- work-experience records,
- proctoring settings.

## 8. Functional Requirements
- FR-01: support registration and authentication with role-based access control.
- FR-02: accept challenge requests by category.
- FR-03: assign challenges using seniority matching with controlled fallback rules.
- FR-04: start proctoring sessions with authoritative deadline metadata.
- FR-05: accept code submissions and process them through queued judge execution.
- FR-06: persist per-run and per-test outcomes.
- FR-07: support constrained AI coaching requests and enforce hint limits.
- FR-08: capture proctoring events and session status updates.
- FR-09: capture work experience, evidence links, verification status, and risk score.
- FR-10: compute and display trust score components on dashboards.
- FR-11: provide admin monitoring and audit views.

### Inputs, Outputs, Computations, Timing and Synchronization
- **Inputs**: credentials, category, language, code, evidence URLs, proctoring events.
- **Outputs**: judged correctness outcomes, score components, trust values, reports.
- **Computations**: test-case evaluation, weighted scoring, trust aggregation, risk classification.
- **Timing/Synchronization**: queue-based processing, polling updates, and deadline enforcement.

## 9. Non-Functional Requirements
- **Authentication (Login/Logout)**: secure token-based session handling and protected routes.
- **Availability**: health endpoints and resilient queue-backed processing.
- **Security**: password hashing, authorization checks, controlled CORS, audit logging.
- **Reliability**: persistent run/proctoring/audit records.
- **Performance**: bounded execution time and responsive API responses.
- **Maintainability**: modular services with documented interfaces.

## 10. Use Case
Diagram source: `academic-submission/diagrams/use-case.puml`  
Diagram export: `academic-submission/diagrams/exports/use-case.png`

### UC-01: Developer Completes Challenge
1. Developer selects category and requests challenge.
2. System assigns a valid challenge and starts proctoring.
3. Developer submits code solution.
4. System evaluates submission and stores run/test outcomes.
5. Dashboard displays results and trust updates.

### UC-02: Admin Publishes Assessment Content
1. Admin creates or updates challenge.
2. Admin configures test cases and baselines.
3. System validates readiness constraints.
4. Admin publishes challenge for assignment.

### UC-03: System Updates Trust Score
1. Submission or work-experience event triggers recomputation.
2. System updates trust record.
3. Dashboard and reports reflect updated values.

## 11. Tools and Technologies to be Used
### Product Technologies
- Frontend: React, TypeScript, Vite.
- Backend: Node.js, Express, TypeScript.
- Queue: BullMQ with Redis.
- Database: PostgreSQL.
- Proctoring service: FastAPI (Python).
- Deployment: Render, Supabase, Upstash.

### Academic Documentation Tools (Free)
- PlantUML (diagram source),
- Kroki (diagram rendering),
- diagrams.net (diagram refinement),
- LibreOffice and browser print-to-PDF (final document export).
