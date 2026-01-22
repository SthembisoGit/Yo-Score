# YoScore - Product Requirements Document (PRD)

## 1. Overview
**YoScore** is a **Developer Trust and Skill Scoring Platform** designed to evaluate developers’ real-world coding skills and trustworthiness. It provides a controlled environment with coding challenges, reference panels, behavior tracking, and scoring logic to objectively measure performance.

**Purpose of PRD:** Define MVP features, user stories, use cases, and acceptance criteria to guide development and ensure a successful launch.

---

## 2. Scope

### 2.1 In-Scope (MVP)
- Frontend coding interface for developers  
- Backend API for challenges, user management, and scoring  
- AI/algorithmic scoring engine (basic version)  
- Proctoring system (camera + browser lock)  
- Reference panel / allowed documentation access  
- Dashboard showing challenge progress and trust score  
- Basic user authentication and profiles  

### 2.2 Out-of-Scope (Future)
- GitHub code scanning  
- Enterprise dashboards  
- Monetization / subscription modules  
- Advanced AI scoring or analytics  
- Global protocols and standardization  

---

## 3. User Personas

| Persona | Description | Needs |
|---------|-------------|------|
| Individual Developer | Wants to prove coding skills and gain trust score | Clear challenges, immediate scoring, secure environment |
| Tech Recruiter | Evaluates developers for hiring | Verified trust scores, dashboard overview, scoring transparency |
| Educator / Bootcamp | Assesses students | Aggregate scores, progress tracking, fairness and consistency |

---

## 4. Use Cases

1. **Developer solves a challenge**
   - Logs in → selects a challenge → completes coding task → submits → system scores.  
   - Behavior tracked: no talking, no screen switching, camera monitoring.  

2. **System calculates trust score**
   - Scoring engine evaluates solution + behavior metrics.  
   - Outputs **numeric score + trust level**.  

3. **Developer views dashboard**
   - Progress per category: frontend, backend, security.  
   - Historical score data.  

4. **Reference panel access**
   - Developer can view allowed docs/hints inside platform.  
   - No external internet or copy-paste allowed.  

---

## 5. Features

| Feature | Description | Priority |
|---------|------------|----------|
| Frontend UI | Coding interface, dashboard, challenge selection | High |
| Backend API | Handles users, challenges, scoring, proctoring | High |
| Scoring Engine | Calculates scores based on performance & behavior | High |
| Proctoring | Camera + focus monitoring, browser lock | High |
| Reference Panel | Curated docs/hints for challenges | High |
| User Auth | Login, profile, session management | Medium |

---

## 6. User Stories

1. **As a developer**, I want to solve coding challenges in a secure environment so that my skills can be evaluated fairly.  
2. **As a developer**, I want access to allowed reference materials so I can solve problems realistically.  
3. **As a recruiter**, I want to view developer trust scores so I can assess candidates quickly.  
4. **As a developer**, I want to track my progress and scores over time.  
5. **As a system admin**, I want to monitor proctoring logs to ensure fair challenge completion.  

---

## 7. Acceptance Criteria

- Developers can log in and access challenges successfully.  
- Reference panel is accessible but only within the platform.  
- Scoring engine calculates numeric score correctly based on rules.  
- Camera and browser monitoring prevents external activity.  
- Dashboard shows current and historical scores per developer.  

---

## 8. Constraints

- Must work on modern browsers.  
- Must respect privacy rules for camera usage.  
- MVP should be deployable on a single server initially.  
- AI scoring engine is rule-based for MVP (no advanced ML).  

---

## 9. Assumptions

- Developers have a webcam and modern browser.  
- Internet connection is stable.  
- Challenges are self-contained, no external data required.  
- Users will not attempt extreme cheating methods (MVP focus is on structure).  

---

## 10. Metrics for Success

- All core MVP features implemented and functional.  
- Scoring engine produces consistent results in pilot tests.  
- Proctoring system reliably detects basic violations.  
- Dashboard displays accurate developer progress.  
- User feedback confirms ease of use and clarity.