# YoScore - System Architecture Document (SAD)

## 1. Overview
This document describes the **system architecture** for YoScore MVP. It outlines the key components, their interactions, data flow, and technology choices to provide a clear blueprint for development.

**Goal:** Ensure the system is modular, scalable, secure, and aligned with the MVP requirements.

---

## 2. High-Level Architecture
YoScore MVP consists of **four main layers**:

1. **Frontend Layer**
   - Web-based coding interface  
   - Challenge selection & submission  
   - Dashboard for developer scores and progress  
   - Reference panel / allowed documentation  

2. **Backend Layer**
   - RESTful API for managing users, challenges, scoring, and proctoring  
   - Authentication & session management  
   - Challenge evaluation logic  

3. **AI / Scoring Engine**
   - Calculates numeric scores based on:
     - Solution correctness
     - Efficiency
     - Behavior metrics from proctoring  
   - Assigns trust levels  
   - Tracks scoring history  

4. **Proctoring / Monitoring**
   - Camera and activity monitoring  
   - Browser focus lock  
   - Prevents cheating and records violation events  

---

## 3. System Components

| Component | Description | Tech/Stack (MVP) |
|-----------|------------|-----------------|
| Frontend UI | Challenge interface, dashboards, reference panel | React / TypeScript |
| Backend API | User, challenge, scoring, proctoring endpoints | Node.js + Express |
| Database | Stores users, challenges, scores, logs | PostgreSQL / SQLite (MVP) |
| AI / Scoring Engine | Calculates scores & trust levels | Python / Node.js |
| Proctoring Module | Camera + browser tracking | WebRTC + JS API |
| Docs / Reference Panel | Curated documentation access | React component + Markdown |
| Authentication | Login, JWT-based session management | Node.js + JWT |
| Logging & Analytics | Store challenge activity, errors, violations | Backend + DB |

---

## 4. Data Flow

```text
[Developer] 
    ↓ submits solution / activity
[Frontend UI] → sends request
[Backend API] → validates → stores → triggers scoring
[AI / Scoring Engine] → computes score & trust level
[Proctoring Module] → monitors behavior, logs violations
[Database] → stores all results & logs
[Frontend UI] → dashboard displays results

## 5. Module Interaction

1. **Frontend → Backend**
   - Sends API requests for login, challenge list, submissions  
   - Receives challenge data, scoring results, trust scores

2. **Backend → Scoring Engine**
   - Receives submissions and behavior logs  
   - Calculates final numeric score + trust level  
   - Returns results to API layer

3. **Backend → Database**
   - Stores all persistent data: users, challenges, logs, scores  

4. **Proctoring Module → Backend**
   - Sends alerts for violations (camera, focus loss, etc.)  
   - Backend adjusts scoring based on violations

5. **Reference Panel**
   - Frontend only reads allowed docs (no external calls)  

---

## 6. Security Considerations

- **Proctoring:** Enforce camera + browser lock during challenges  
- **Authentication:** JWT tokens for session management  
- **Data Privacy:** Store sensitive behavior logs securely, encrypted if necessary  
- **Code Execution Safety:** Run submitted code in sandboxed environment  

---

## 7. Technology Stack (MVP)

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL / SQLite (MVP) |
| AI / Scoring | Python / Node.js scripts |
| Proctoring | WebRTC + JS APIs |
| Deployment | Docker (optional MVP) |

---

## 8. High-Level Diagram (Conceptual)

```text
[Frontend UI] <---> [Backend API] <---> [Database]
      |                     |
      v                     v
 [Proctoring]          [Scoring Engine]

-	Frontend communicates with backend for all requests
-	Backend stores & retrieves data from the database
-	Backend integrates scoring engine for results calculation
-	Proctoring module provides behavior feedback to backend

## 9. Notes for MVP

- Each module should be **self-contained** for easier testing and incremental development  
- Backend APIs should follow **RESTful design**  
- Scoring engine is **rule-based** for MVP; can later integrate ML models  
- Proctoring should be **lightweight but secure** for MVP  
- Reference panel should be **read-only**, with no external internet allowed