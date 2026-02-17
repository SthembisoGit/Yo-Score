# Yo-Score - Vision Document

## 1. Purpose
YoScore is a **Developer Trust and Skill Scoring Platform** designed to objectively evaluate developer skills, problem-solving ability, and trustworthiness in real-world coding scenarios. The platform provides a controlled environment for developers to solve coding challenges while tracking performance and behavior, enabling individuals, teams, and companies to measure and certify developer capabilities.

## 2. Problem Statement
Traditional coding assessments often fail to accurately reflect real developer ability in the AI era. The issue is not AI itself, but unbounded usage without proof of understanding. This leads to inflated or unreliable results, weak trust signals, and hiring risks. A second problem is that some strong developers are filtered out by poor CV presentation rather than real skills.

## 3. Target Users
- Individual developers seeking to **prove skills and build credibility**.  
- Tech companies and startups looking for **reliable trust scoring** during recruitment.  
- Educational institutions and coding bootcamps evaluating student performance.  

## 4. Key Goals
- Provide **objective, trustworthy developer scoring**.  
- Ensure **secure, monitored environment** for solving challenges.  
- Offer **constrained AI guidance** that supports understanding, not answer dumping.  
- Produce **trust scores** based on challenge results and behavior metrics.  
- Enable **scalable adoption** for individuals, organizations, and enterprises.  

## 4.1 Trust-Core Realignment (Release 1)
- Keep AI in the workflow, but enforce **AI-with-understanding**:
  - concept coaching and short examples only
  - no full-solution generation in challenge sessions
- Route challenges by **category + seniority band**:
  - Graduate (0-6), Junior (7-24), Mid (25-60), Senior (61+ months)
- Improve fairness with **timer + offline resilience**:
  - timer continues during disconnect
  - local draft autosave
  - reconnect auto-submit behavior with server-side grace enforcement
- Use low-admin evidence validation for experience:
  - evidence links
  - risk scoring
  - verification status for trust-score eligibility
- Keep mixed non-coding assessments (concept checks, MCQ, scenarios) in immediate post-release roadmap.

## 5. Success Metrics
- MVP release with all **core modules functional**.  
- Ability to track **developer scores accurately**.  
- User adoption in a small pilot group.  
- Feedback from early users to refine features.  

## 6. Vision Statement
> YoScore aims to become the **industry standard for developer trust and skill assessment**, bridging the gap between knowledge, performance, and verified credibility in software development.
