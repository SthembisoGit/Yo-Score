# YoScore - Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
This document defines the **software requirements** for YoScore MVP, a **Developer Trust and Skill Scoring Platform**. It specifies functional and non-functional requirements, constraints, assumptions, and scoring rules for the MVP.

### 1.2 Scope
YoScore MVP evaluates developers’ skills and trustworthiness via coding challenges. It includes:

- Frontend coding interface with challenges  
- Backend API and database  
- AI/algorithmic scoring engine  
- Proctoring system (camera & browser monitoring)  
- Reference panel for allowed documentation  
- Dashboard showing challenge progress and trust score  

**Out of Scope:** GitHub code scanning, enterprise dashboards, subscription monetization, advanced AI scoring.

### 1.3 Definitions
- **Developer:** User solving coding challenges  
- **Trust Score:** Numeric measure of developer skill + behavior  
- **Proctoring:** Monitoring system to ensure fair challenge completion  
- **Reference Panel:** Allowed documentation for challenge assistance  

---

## 2. Overall Description

### 2.1 Product Perspective
YoScore is a modular system:

- **Frontend:** Web interface (React + TypeScript)  
- **Backend:** API and database (Node.js + PostgreSQL / SQLite)  
- **AI/Scoring Engine:** Rule-based score calculation (Python / Node.js)  
- **Proctoring Module:** Camera and browser monitoring (WebRTC + JS APIs)  

### 2.2 Product Functions
- Developer login, profile, challenge selection  
- Challenge submission and validation  
- Score calculation and trust level assignment  
- Behavior monitoring during challenge  
- Dashboard and history display  
- Reference panel access  

### 2.3 User Classes and Characteristics
| User | Description |
|------|------------|
| Developer | Solves coding challenges, views scores |
| Recruiter / Evaluator | Reviews trust scores, developer history |
| Admin | Manages users, challenges, scoring rules |

### 2.4 Operating Environment
- Modern browsers (Chrome, Edge, Firefox)  
- Desktop or laptop with webcam  
- Internet connection required  

### 2.5 Constraints
- Camera access must be allowed and secure  
- Sandbox environment for code execution  
- Backend and scoring engine must handle multiple simultaneous users (MVP: up to 50)  
- Reference panel must not allow external browsing  

### 2.6 Assumptions and Dependencies
- Users have modern browsers and webcam access  
- Stable internet connection  
- Challenges are self-contained  
- Users won’t attempt extreme cheating beyond proctoring MVP capabilities  

---

## 3. Functional Requirements

### 3.1 User Authentication
- Users can **sign up, log in, and log out**  
- Sessions managed via **JWT tokens**  
- Passwords stored securely (hashed)

### 3.2 Challenge Management
- List available challenges (categorized: Frontend, Backend, Security, etc.)  
- Allow developer to **start, submit, and restart** challenges  
- Store submission history in the database  

### 3.3 Scoring Engine
- Evaluate correctness and efficiency of submitted code  
- Apply **behavior penalties** (camera away, browser tab switch)  
- Calculate **final trust score** (numeric + qualitative level)  
- Store all scores and history in the database  

### 3.4 Proctoring / Monitoring
- Enforce **camera on + focus on browser**  
- Detect violations: screen switch, inactivity, camera off  
- Send real-time alerts to scoring engine  
- Record logs for audit  

### 3.5 Reference Panel
- Provide allowed documentation for selected challenge  
- Read-only access, no copy-paste or external navigation  

### 3.6 Dashboard
- Display **challenge progress, scores, trust levels**  
- Show historical data per category  
- Allow user to review past challenge results  

### 3.7 Work Experience Scoring
- The system will allow users to **add verified work experience or project history**.  
- Work experience contributes to the **overall trust score** in addition to challenge performance.  
- Inputs: Company/project name, role, duration, verified references (optional MVP: self-reported).  
- Outputs: Adjusted numeric score and trust level.  
- Interactions: Backend stores experience, Scoring Engine integrates it into trust calculation.

### 3.8 Automatic Challenge Assignment
- The system must **automatically assign challenges** from the available pool per category.  
- Users can take multiple challenges to increase their trust score.  
- Challenges already completed by the user **cannot be repeated**.  
- The system tracks completed challenges and ensures only **new challenges** are presented.  
- Challenge selection must integrate with scoring engine so that **attempted challenges contribute to trust score**.
---

## 4. Non-Functional Requirements

| Type | Requirement |
|------|------------|
| Performance | System responds within 2 seconds for API calls (MVP target) |
| Security | JWT authentication, encrypted storage for sensitive data |
| Usability | Simple and intuitive interface, accessible dashboard |
| Reliability | Backend uptime ≥ 95% for MVP testing |
| Scalability | Modular architecture for future expansion |
| Maintainability | Code modular, documented, unit-tested |

---

## 5. Data Requirements
- Users: ID, name, email, password hash, profile info  
- Challenges: ID, title, description, category, solution template  
- Submissions: User ID, Challenge ID, code, timestamp, score  
- Trust Scores: User ID, score, timestamp, category breakdown  
- Proctoring Logs: User ID, violations, timestamps  

---

## 6. Scoring Rules (MVP)

1. **Code Correctness:** 0–60 points  
2. **Efficiency / Complexity:** 0–20 points  
3. **Behavior / Proctoring:** 0–20 points  
   - Camera off: −5 points per violation  
   - Screen switch: −3 points per violation  
   - Inactivity > 1 min: −2 points per minute  

**Final Score:** 0–100  
**Trust Levels:**
- 0–49: Low  
- 50–74: Medium  
- 75–100: High  

---

## 7. Acceptance Criteria
- Users can log in and select challenges  
- Score calculation works as per rules  
- Camera and browser monitoring detect basic violations  
- Dashboard displays correct scores and historical data  
- Reference panel accessible only within platform  

---

## 8. Future Enhancements (Out of MVP)
- GitHub code scanning integration  
- Enterprise dashboards and analytics  
- Advanced AI/ML scoring engine  
- Subscription and monetization features