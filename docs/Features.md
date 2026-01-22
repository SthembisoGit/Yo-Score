# YoScore - Features Documentation

## 1. Overview
This document defines the **features for YoScore MVP**, including what each module does, inputs, outputs, and interactions. This will guide development and testing.

---

## 2. Feature List

### 2.1 Frontend UI
**Description:** Web interface for developers to solve challenges and view their trust score.  
**Inputs:** User login info, challenge selection, code submissions.  
**Outputs:** Challenge view, code editor, dashboard with scores.  
**Interactions:** Communicates with Backend API for authentication, challenge data, scoring results.

---

### 2.2 Backend API
**Description:** Handles requests from frontend, stores data, manages scoring, users, and proctoring logs.  
**Inputs:** API requests (login, challenge submission, scoring requests).  
**Outputs:** API responses (success/failure, scores, trust levels).  
**Interactions:** Talks to Database, Scoring Engine, and Proctoring module.

---

### 2.3 AI / Scoring Engine
**Description:** Calculates final score and trust level based on code performance and behavior metrics.  
**Inputs:** Challenge submissions, proctoring logs.  
**Outputs:** Numeric score (0–100), trust level (Low/Medium/High).  
**Interactions:** Receives submissions from Backend API, sends results back to Backend.

---

### 2.4 Proctoring Module
**Description:** Monitors developer during challenges to prevent cheating.  
**Inputs:** Camera feed, browser activity, inactivity timer.  
**Outputs:** Violation logs, alerts to scoring engine.  
**Interactions:** Communicates with Backend to record logs and affect scoring.

---

### 2.5 Reference Panel
**Description:** Provides allowed documentation for solving challenges.  
**Inputs:** User requests for docs/hints.  
**Outputs:** Read-only content displayed inside platform.  
**Interactions:** Frontend only; no external API or internet access.

---

### 2.6 Dashboard
**Description:** Displays developer challenge progress, scores, and trust level.  
**Inputs:** Data from Backend (scores, violations, category progress).  
**Outputs:** Visual representation of scores, history, and progress.  
**Interactions:** Frontend reads from Backend API.

---

### 2.7 Challenge Management
**Description:** Manages challenges including creation, categorization, and submission handling.  
**Inputs:** Challenge data (title, description, category, solution).  
**Outputs:** Challenge availability for users, submission validation.  
**Interactions:** Backend stores in database, scoring engine calculates score after submission.

### 2.8 Work Experience Tracker
**Description:** Developers can input their previous work experience, projects, or internships.  
**Inputs:** Company/project name, role, duration, optional verification.  
**Outputs:** Contribution to overall trust score displayed in dashboard.  
**Interactions:** Frontend collects data → Backend stores → Scoring Engine calculates impact on trust score.

### 2.9 Automatic Challenge Selection
**Description:** 
- Challenges are **automatically selected** for the user from the available pool per category.  
- Developers can attempt **as many challenges as they want**.  
- **No repeats:** Once a challenge is completed, it cannot be attempted again.  
- Taking more challenges helps build the **trust score**, as challenge performance contributes to scoring.  

**Inputs:** User selects category or system chooses automatically  
**Outputs:** Challenge assigned for user, updated list of remaining challenges  
**Interactions:** Backend manages challenge availability and records completed challenges to prevent repeats

---

## 3. Notes
- Each feature is **self-contained**, enabling parallel development.  
- Features communicate **only via APIs** for modularity.  
- All features feed into the **trust score**, which is displayed on the dashboard.