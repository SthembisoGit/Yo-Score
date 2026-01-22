# YoScore - Scoring Documentation

## 1. Overview
This document defines how **trust scores** are calculated in YoScore MVP. The score combines **challenge performance**, **behavior/proctoring compliance**, and **work experience**, providing a numeric and qualitative measure of developer skill and trustworthiness.

---

## 2. Scoring Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Challenge Performance | 60% | Correctness and efficiency of submitted code |
| Behavior / Proctoring | 20% | Camera on, no tab switching, active focus |
| Work Experience | 20% | Verified or self-reported past projects/jobs |

> Total = 100 points

---

## 3. Challenge Performance Scoring

- **Correctness (0–40 points):**  
  - Fully correct solution: 40 points  
  - Partially correct: proportional points  
- **Efficiency (0–20 points):**  
  - Code optimization, proper algorithm choice  
  - Faster and cleaner solutions score higher  

**Example:**  
- Correctness: 35 / 40  
- Efficiency: 15 / 20  
- Challenge Performance = 35 + 15 = 50 / 60

---

## 4. Behavior / Proctoring Scoring

| Violation Type | Penalty Points |
|----------------|----------------|
| Camera off | −5 per occurrence |
| Screen/tab switch | −3 per occurrence |
| Inactivity > 1 min | −2 per minute |

- **Behavior Score:** 20 points minus penalties  
- Minimum behavior score = 0

**Example:**  
- Two screen switches (−3 × 2 = 6)  
- 1 min inactivity (−2)  
- Behavior score = 20 − 8 = 12 / 20

---

## 5. Work Experience Scoring

- Up to **20 points**, based on:
  - Duration of experience (months/years)  
  - Role relevance (frontend, backend, security, etc.)  
  - Verification (optional, MVP: self-reported)  

**Example:**  
- 12 months relevant experience → 12 / 20 points  
- 24 months → 20 / 20 points (cap at 20)

---

## 6. Total Trust Score Calculation
- Total Score = Challenge Performance + Behavior Score + Work Experience
- Max = 60 + 20 + 20 = 100

**Example Calculation:**  
- Challenge Performance = 50  
- Behavior Score = 12  
- Work Experience = 12  
- **Total Trust Score = 50 + 12 + 12 = 74**  
- Trust Level = Medium (50–74)

- **Multiple Challenges:** Developers can complete multiple challenges per category.  
- **Score Impact:** Completing more challenges increases the challenge component of the trust score.  
- **No Repeats:** Previously completed challenges do not give extra points if attempted again.
---

## 7. Trust Levels

| Score Range | Trust Level |
|-------------|------------|
| 0–49 | Low |
| 50–74 | Medium |
| 75–100 | High |

---

## 8. Notes

- Each submission generates a **score snapshot**, stored in the database.  
- Trust scores are **recomputed** on new challenge completion or added work experience.  
- MVP scoring is **rule-based**, allowing future integration of AI/ML for more sophisticated evaluation.  
- Scores are **visible on Dashboard**, giving developers clear feedback on performance and trust level.