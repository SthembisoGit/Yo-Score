# YoScore Test Cases

## Legend
- Priority: High / Medium / Low
- Type: Functional / Non-functional / Integration / E2E

| ID | Scenario | Type | Priority | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-01 | Signup success | Functional | High | App running | Submit valid signup form | User created and token returned |
| TC-02 | Login success | Functional | High | Existing user | Submit valid credentials | Login success and dashboard access |
| TC-03 | Login failure | Functional | High | App running | Submit invalid password | 401 response |
| TC-04 | Category-based assignment | Integration | High | Challenges seeded by category | Request next challenge with category | Returned challenge matches requested category |
| TC-05 | Seniority exact-band assignment | Integration | High | User months map to one band | Request next challenge | Challenge target seniority matches exact band when available |
| TC-06 | Seniority lower-band fallback | Integration | High | No challenge in exact band | Request next challenge | Challenge falls back only to lower band |
| TC-07 | Seniority boundary mapping | Functional | High | Test users at 0,6,7,24,25,60,61 months | Request assignment/dashboard | Bands map correctly to graduate/junior/mid/senior |
| TC-08 | Start proctoring session metadata | Integration | High | Authenticated user | Start session | Response includes `deadline_at` and `duration_seconds` |
| TC-09 | Pause on missing device | Integration | High | Active session | Disable required camera/mic/audio | Session pauses with reason |
| TC-10 | Resume after recovery | Integration | High | Paused session | Re-enable devices and resume | Session returns to active |
| TC-11 | Countdown during online session | Functional | High | Active session | Observe timer | Countdown updates and reflects server deadline |
| TC-12 | Offline autosave continuity | Non-functional | High | Active session | Disconnect network and keep editing | Draft keeps saving locally and timer continues |
| TC-13 | Offline deadline lock | Integration | High | Session offline near deadline | Wait for deadline | Editor locks and pending auto-submit state is set |
| TC-14 | Reconnect auto-submit within grace | E2E | High | Pending auto-submit state | Reconnect within 15 min | Latest draft auto-submits successfully |
| TC-15 | Submit rejected after grace | Integration | High | Session past deadline + 15 min | Attempt submission | Backend rejects with deadline/grace error |
| TC-16 | Submit JS challenge | Integration | High | Published challenge | Submit JS code | Submission queued with judge status |
| TC-17 | Submit Python challenge | Integration | High | Published challenge | Submit Python code | Submission queued with judge status |
| TC-18 | Judge lifecycle transitions | E2E | High | Worker running | Poll submission | queued -> running -> completed/failed |
| TC-19 | Persist run tests | Functional | High | Completed run | Get run detail endpoint | Per-test outcomes are persisted |
| TC-20 | Score formula consistency | Functional | High | Completed run with violations | Compare persisted components and total | Stored score matches formula |
| TC-21 | AI Coach hint success | Functional | High | Active challenge session | Request hint 1-3 | Concept guidance returned with remaining count |
| TC-22 | AI Coach hint cap | Functional | High | Three hints already used | Request hint 4 | Request blocked with limit message |
| TC-23 | Work experience evidence intake | Functional | High | Authenticated user | Submit entry with evidence links | Entry saved with verification status and risk score |
| TC-24 | Flagged/rejected experience excluded | Functional | High | Flagged or rejected entries exist | Recompute trust | Excluded records do not increase trust score |
| TC-25 | Dashboard trust and seniority output | Functional | Medium | User has graded submissions | Open dashboard | Trust, seniority band, and component summary shown |
| TC-26 | Admin publish readiness enforcement | Functional | High | Admin user | Try publish without tests/baselines | Publish blocked until challenge is ready |
| TC-27 | Admin retry failed run | Functional | Medium | Failed run exists | Retry from admin UI/API | Retry job accepted |
| TC-28 | Admin role update audit | Functional | Medium | Admin user | Change user role | Role updated and audit log created |
| TC-29 | Admin flagged experience queue | Functional | Medium | Flagged records exist | Open admin queue | Flagged records displayed with risk fields |
| TC-30 | End-to-end smoke path | E2E | High | Full stack running | Login -> assign -> session -> submit -> result | Critical path completes successfully |
