# Phase 3: User Interface

## 1. Design User Interfaces
Implemented and documented screens:
- Login and Signup
- Developer Dashboard
- Challenge Detail and Session
- Submission Result
- Work Experience
- Profile
- Admin Dashboard

Trust-Core additions in UI:
- Category picker before challenge assignment
- Seniority badge display
- Countdown timer sourced from backend deadline
- Offline/online state banner
- Local autosave and reconnect auto-submit handling
- AI Coach panel with 3-hint counter and policy messaging
- Work-experience evidence links and verification/risk status badges
- Expanded profile editing (photo URL, headline, bio, location, professional links)

## 2. Demo the Prototype
Suggested 6-8 minute demo sequence:
1. Login as developer.
2. Select category and fetch seniority-matched challenge.
3. Start proctoring session and show timer.
4. Request one AI Coach hint and show remaining hint count.
5. Simulate temporary offline behavior and autosave continuity.
6. Submit and show async lifecycle (`queued -> running -> completed`).
7. Open dashboard and verify score plus seniority display.
8. Login as admin and show flagged work-experience audit queue.
9. Show post-exam proctoring review summary on admin session detail.

## 3. Evaluate User Interface (Heuristic Evaluation)
Method: Nielsen heuristics.

| ID | Heuristic | Defect | Severity | Location | Recommendation |
|---|---|---|---|---|---|
| H-01 | Visibility of system status | Timer and judge polling can feel separate | Medium | Challenge session/result | Show unified status strip for timer, queue state, and network state |
| H-02 | User control and freedom | Strict proctoring pause flow can feel abrupt | Medium | Session modals | Add one-line explanation of why resume is blocked and next required action |
| H-03 | Error prevention | Category may be omitted before assignment | Low | Dashboard quick-start | Keep category required and persist last selected value |
| H-04 | Consistency and standards | Some pages use different status labels | Low | Dashboard and result page | Standardize terms: queued, running, completed, failed |
| H-05 | Help and documentation | AI Coach policy may be misunderstood | Medium | AI Coach panel | Add short rule text: concept hints only, max 3, no full solutions |
| H-06 | Recognition over recall | Work-experience risk meaning not obvious | Low | Work experience page | Add tooltip explaining flagged/pending/verified statuses |
| H-07 | Aesthetic and minimalist design | Admin dashboard can become dense | Low | Admin dashboard | Add collapsible cards and default filters |

## 4. Validate Fields (Verification and Validation)
### Authentication
- Email format required.
- Password required.
- Role constrained to allowed values.

### Challenge Session
- `challenge_id` required.
- `language` required (`javascript` or `python`).
- Session deadline is server authoritative.

### AI Coach
- `hint_index` required.
- Requests blocked after 3 hints for the same challenge session.

### Work Experience
- `company_name` required.
- `role` required.
- `duration_months` numeric and positive.
- `evidence_links` optional but must be valid URL strings when provided.

### Admin Challenge Configuration
- `target_seniority` required.
- `duration_minutes` bounded.
- Publish action allowed only when tests and baselines are valid.
