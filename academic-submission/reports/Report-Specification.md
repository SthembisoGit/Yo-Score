# Report Specification

## 1. User Trust Summary Report
Purpose:
- Show each user trust score, level, and seniority context.

Fields:
- user_id
- name
- email
- role
- total_score
- trust_level
- updated_at

## 2. Submission Performance Report
Purpose:
- Show submission quality and judge lifecycle details.

Fields:
- submission_id
- user_email
- challenge_title
- challenge_category
- challenge_seniority
- language
- score
- judge_status
- component_correctness
- component_efficiency
- component_style
- component_behavior
- submitted_at

## 3. Proctoring Violation Report
Purpose:
- Analyze violation frequency and penalty impact.

Fields:
- session_id
- user_email
- challenge_title
- violation_type
- severity
- penalty
- timestamp

## 4. Judge Run Health Report
Purpose:
- Monitor reliability and performance of judge runs.

Fields:
- run_id
- submission_id
- status
- language
- test_passed
- test_total
- runtime_ms
- memory_mb
- error_message
- started_at
- finished_at

## 5. Flagged Work-Experience Audit Report
Purpose:
- Provide admin queue for low-trust or suspicious experience entries.

Fields:
- experience_id
- user_email
- company_name
- role
- duration_months
- verification_status
- risk_score
- evidence_links
- added_at
