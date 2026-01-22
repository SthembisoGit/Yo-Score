# YoScore - Data Model

## 1. Overview
This document defines the **database schema** for YoScore MVP. It includes all entities, relationships, and example fields required for the backend to support challenges, scoring, proctoring, work experience, and user profiles.

---

## 2. Entities

### 2.1 Users
**Description:** Stores developer, recruiter, and admin profiles.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| user_id | UUID / INT | Primary Key |
| name | VARCHAR | Full name of the user |
| email | VARCHAR | Unique email |
| password_hash | VARCHAR | Hashed password |
| role | ENUM (developer, recruiter, admin) | User type |
| created_at | TIMESTAMP | Account creation date |
| updated_at | TIMESTAMP | Last update |

---

### 2.2 Challenges
**Description:** Stores all coding challenges.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| challenge_id | UUID / INT | Primary Key |
| title | VARCHAR | Challenge title |
| description | TEXT | Challenge description |
| category | ENUM (frontend, backend, security, etc.) | Category of challenge |
| difficulty | ENUM (easy, medium, hard) | Difficulty level |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update |

---

### 2.3 Submissions
**Description:** Stores developer submissions for challenges.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| submission_id | UUID / INT | Primary Key |
| user_id | UUID / INT | Foreign Key → Users(user_id) |
| challenge_id | UUID / INT | Foreign Key → Challenges(challenge_id) |
| code | TEXT | Submitted code |
| score | INT | Score assigned (0–100) |
| status | ENUM (pending, graded, failed) | Submission status |
| submitted_at | TIMESTAMP | Submission time |

---

### 2.4 TrustScores
**Description:** Stores calculated trust scores for each user.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| score_id | UUID / INT | Primary Key |
| user_id | UUID / INT | Foreign Key → Users(user_id) |
| total_score | INT | Final trust score (0–100) |
| trust_level | ENUM (Low, Medium, High) | Calculated trust level |
| updated_at | TIMESTAMP | Last update of score |

---

### 2.5 ProctoringLogs
**Description:** Stores logs from proctoring system for each submission.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| log_id | UUID / INT | Primary Key |
| submission_id | UUID / INT | Foreign Key → Submissions(submission_id) |
| violation_type | ENUM (camera_off, screen_switch, inactivity) | Type of violation |
| timestamp | TIMESTAMP | Time of violation |
| penalty | INT | Points deducted for violation |

---

### 2.6 WorkExperience
**Description:** Stores user’s work experience or project history contributing to trust score.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| experience_id | UUID / INT | Primary Key |
| user_id | UUID / INT | Foreign Key → Users(user_id) |
| company_name | VARCHAR | Company or project name |
| role | VARCHAR | Role / position held |
| duration_months | INT | Duration of experience |
| verified | BOOLEAN | Optional verification status |
| added_at | TIMESTAMP | When experience was added |

---

### 2.7 ReferenceDocs
**Description:** Stores allowed documentation for challenges.  
**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| doc_id | UUID / INT | Primary Key |
| challenge_id | UUID / INT | Foreign Key → Challenges(challenge_id) |
| title | VARCHAR | Document title |
| content | TEXT | Document content (Markdown or HTML) |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update |

---

## 3. Relationships

- **Users → Submissions** → One-to-Many  
- **Challenges → Submissions** → One-to-Many  
- **Submissions → ProctoringLogs** → One-to-Many  
- **Users → TrustScores** → One-to-One  
- **Users → WorkExperience** → One-to-Many  
- **Challenges → ReferenceDocs** → One-to-Many  

---

## 4. Notes

- All IDs are primary keys and auto-generated (UUID or INT).  
- Foreign key constraints enforce relational integrity.  
- Timestamps track creation and updates for audit and scoring purposes.  
- WorkExperience is **optional for MVP**, but contributes to overall trust score.  
- ReferenceDocs are **read-only**, ensuring developers cannot upload arbitrary docs.