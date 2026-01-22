# YoScore - Security Documentation

## 1. Overview
This document defines all **security requirements and measures** for YoScore MVP to ensure safe, reliable, and fair operation. It covers authentication, authorization, proctoring security, data privacy, and code execution safety.

---

## 2. Authentication

- **JWT Tokens:** All logged-in users receive a **JWT token** for API access.
- **Token Expiration:** Tokens expire after a configurable time (e.g., 24 hours) to reduce risk.
- **Password Storage:** Passwords are stored **hashed with bcrypt** (or equivalent secure hashing).
- **Login Attempts:** Implement account lockout or cooldown after **5 failed login attempts**.

---

## 3. Authorization

- **Role-Based Access Control (RBAC):**  
  - Developer: Can access challenges, submit code, view own dashboard.  
  - Recruiter/Evaluator: Can view developer scores (MVP optional).  
  - Admin: Can manage users, challenges, scoring rules.  
- **Endpoint Protection:** All endpoints check **user role and token validity**.

---

## 4. Proctoring Security

- **Camera Enforcement:** Users must allow camera access for challenge participation.  
- **Browser Lock:** Detect if user switches tabs or opens new windows; violations logged.  
- **Activity Monitoring:** Track inactivity, screen switching, or unauthorized actions.  
- **Violation Handling:** Automatic penalty applied to trust score for each violation.  
- **Logs:** All proctoring logs stored securely and linked to submissions.  

---

## 5. Data Privacy

- **Sensitive Data:** Passwords, trust scores, and behavior logs are **encrypted at rest**.  
- **Transmission:** All API traffic uses **HTTPS** with TLS 1.2+ encryption.  
- **Access Control:** Only authorized users can access sensitive data.  
- **Reference Docs:** Developers cannot upload arbitrary files or access external links.  

---

## 6. Code Execution Security

- **Sandboxed Environment:** All submitted code runs in a **secure sandbox** to prevent malicious access to server.  
- **Resource Limits:** Restrict memory, CPU, and execution time to prevent abuse.  
- **Input/Output Validation:** Ensure no system commands are executed unintentionally.  
- **Logging & Monitoring:** Capture errors and abnormal behavior for audit purposes.

---

## 7. Database Security

- **Access Control:** Only backend services can access the database.  
- **Encryption:** Sensitive columns (password_hash, proctoring logs) are encrypted.  
- **Backups:** Regular encrypted backups to prevent data loss.

---

## 8. Notes

- MVP Proctoring may not detect advanced cheating methods; focus is on **basic camera and activity enforcement**.  
- Security modules are **modular**, allowing future improvements (face detection, AI-based cheat detection).  
- All security measures must balance **user experience** with protection.