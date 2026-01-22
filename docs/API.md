# YoScore - API Documentation

## 1. Overview
This document defines all **backend API endpoints** for YoScore MVP, including authentication, challenge management, submissions, scoring, proctoring, and dashboard functionality. All endpoints use **JSON** for request/response.

**Base URL (MVP example):** `https://api.yoscore.com/v1`

---

## 2. Authentication

### 2.1 Sign Up
- **Endpoint:** `POST /auth/signup`
- **Description:** Registers a new user.
- **Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "developer"
}
```

- **Response (Success 201):**

```json
{
  "message": "User created successfully",
  "user_id": "uuid"
}
```

### 2.2 Login
- **Endpoint:** `POST /auth/login`
- **Description:** Authenticates user and returns JWT token.
- **Request Body:**

```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

- **Response (Success 200):**

```json
{
  "token": "jwt-token-string",
  "user": {
    "user_id": "uuid",
    "name": "John Doe",
    "role": "developer"
  }
}
```

### 2.3 Logout
- **Endpoint:** `POST /auth/logout`
- **Description:** Invalidates the JWT token.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
{
  "message": "Logged out successfully"
}
```

---

## 3. Users

### 3.1 Get Profile
- **Endpoint:** `GET /users/me`
- **Description:** Retrieves logged-in user profile.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
{
  "user_id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "developer",
  "created_at": "2026-01-22T14:00:00Z"
}
```

### 3.2 Update Profile
- **Endpoint:** `PUT /users/me`
- **Description:** Update profile details.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**

```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

- **Response (Success 200):**

```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

---

## 4. Challenges

### 4.1 List Challenges
- **Endpoint:** `GET /challenges`
- **Description:** Get list of all available challenges.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
[
  {
    "challenge_id": "uuid",
    "title": "Build Login Page",
    "category": "frontend",
    "difficulty": "medium"
  }
]
```

### 4.2 Get Challenge Details
- **Endpoint:** `GET /challenges/{challenge_id}`
- **Description:** Get details of a specific challenge.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
{
  "challenge_id": "uuid",
  "title": "Build Login Page",
  "description": "Create a responsive login page using React.",
  "category": "frontend",
  "difficulty": "medium",
  "created_at": "2026-01-22T12:00:00Z"
}
```

---

## 5. Submissions

### 5.1 Submit Challenge
- **Endpoint:** `POST /submissions`
- **Description:** Submit code for a challenge.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**

```json
{
  "challenge_id": "uuid",
  "code": "function login() { ... }"
}
```

- **Response (Success 201):**

```json
{
  "submission_id": "uuid",
  "status": "pending",
  "message": "Submission received"
}
```

### 5.2 Get Submission Results
- **Endpoint:** `GET /submissions/{submission_id}`
- **Description:** Retrieve scoring result and proctoring logs.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
{
  "submission_id": "uuid",
  "score": 85,
  "trust_level": "High",
  "violations": [
    {
      "type": "screen_switch",
      "penalty": 3,
      "timestamp": "2026-01-22T14:05:00Z"
    }
  ]
}
```

---

## 6. Work Experience

### 6.1 Add Work Experience
- **Endpoint:** `POST /users/me/work-experience`
- **Description:** Add previous work experience contributing to trust score.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**

```json
{
  "company_name": "Tech Co",
  "role": "Frontend Developer",
  "duration_months": 12,
  "verified": false
}
```

- **Response (Success 201):**

```json
{
  "experience_id": "uuid",
  "message": "Work experience added successfully"
}
```

### 6.2 Get Work Experience
- **Endpoint:** `GET /users/me/work-experience`
- **Description:** Get all work experiences for logged-in user.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
[
  {
    "experience_id": "uuid",
    "company_name": "Tech Co",
    "role": "Frontend Developer",
    "duration_months": 12,
    "verified": false
  }
]
```

---

## 7. Reference Docs

### 7.1 Get Reference Docs for Challenge
- **Endpoint:** `GET /challenges/{challenge_id}/docs`
- **Description:** Fetch allowed documentation for a challenge.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
[
  {
    "doc_id": "uuid",
    "title": "React Login Guide",
    "content": "## Steps to create login form..."
  }
]
```

---

## 8. Dashboard

### 8.1 Get User Scores
- **Endpoint:** `GET /dashboard/me`
- **Description:** Fetch scores, trust levels, and challenge progress for logged-in user.
- **Headers:** `Authorization: Bearer <token>`
- **Response (Success 200):**

```json
{
  "total_score": 88,
  "trust_level": "High",
  "category_scores": {
    "frontend": 90,
    "backend": 85,
    "security": 80
  },
  "challenge_progress": [
    {
      "challenge_id": "uuid",
      "status": "completed",
      "score": 90
    }
  ]
}
```

---

## 9. Notes
- All endpoints require JWT authorization unless explicitly public.
- `POST /submissions` triggers scoring engine asynchronously.
- Proctoring logs affect final trust score automatically.
- Endpoints are RESTful, modular, and can be extended for future enhancements.
