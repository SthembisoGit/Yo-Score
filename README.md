# Yo-Score

**Yo-Score** is a **Developer Trust and Skill Scoring Platform** designed to objectively evaluate developer skills, problem-solving ability, and trustworthiness in real-world coding scenarios. The platform provides a secure, monitored environment for developers to solve coding challenges while tracking performance, behavior, and professional experience to produce verifiable trust scores.

---

## ðŸ“‹ Table of Contents

- [Vision & Purpose](#vision--purpose)
- [Key Features](#key-features)
- [Live Deployment](#live-deployment)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Scoring System](#scoring-system)
- [Documentation](#documentation)
- [License](#license)

---

## Live Deployment

- Frontend (Render): `https://yoscore-frontend.onrender.com`
- Backend API (Render): `https://yoscore-backend.onrender.com/api`
  - Health: `https://yoscore-backend.onrender.com/health`
- ML Service (Render): `https://yoscore-ml-service.onrender.com`
  - Health: `https://yoscore-ml-service.onrender.com/health`

---

## ðŸŽ¯ Vision & Purpose

### Problem Statement
Traditional coding assessments fail to accurately reflect real-world developer skills. Developers often rely on external references, and current systems don't track behavior or secure coding practices, leading to incomplete evaluations and unverifiable trust scores.

### Solution
Yo-Score provides:
- **Objective, trustworthy developer scoring** based on code performance and behavior
- **Secure, monitored environment** with proctoring (camera monitoring, browser lock, activity tracking)
- **Reference panel** with curated, allowed documentation
- **Trust scores** combining challenge performance (60%), behavior compliance (20%), and work experience (20%)
- **Scalable adoption** for individuals, organizations, and enterprises

### Target Users
- Individual developers seeking to prove skills and build credibility
- Tech companies and startups for reliable hiring assessments
- Educational institutions and coding bootcamps for student evaluation

---

## âœ¨ Key Features

### 1. **Secure Challenge Environment**
   - Developers solve real-world coding challenges in categories: Frontend, Backend, Security, etc.
   - Automatic challenge assignment preventing repeats
   - Difficulty levels: Easy, Medium, Hard

### 2. **Comprehensive Proctoring System**
   - Real-time camera monitoring and enforcement
   - Audio analysis for speech and multiple voice detection
   - Browser monitoring: tab switch detection, copy/paste prevention, developer tools blocking
   - Inactivity detection (60+ seconds)
   - Automatic violation logging with point penalties

### 3. **Reference Panel**
   - Curated, allowed documentation accessible only within the platform
   - Read-only access, no external internet or download capabilities
   - Challenges can provide specific reference materials

### 4. **Trust Score Dashboard**
   - Real-time score tracking across multiple challenges
   - Progress visualization by category
   - Historical score data
   - Trust level classification: Low (0â€“49), Medium (50â€“74), High (75â€“100)

### 5. **Work Experience Tracker**
   - Developers input previous work experience, projects, or internships
   - Contributes 20% to overall trust score
   - Optional verification support

### 6. **User Profiles & Authentication**
   - Secure JWT-based authentication
   - Role-based access control (Developer, Recruiter, Admin)
   - Session management with token rotation

---

## ðŸ› ï¸ Technology Stack

### Frontend
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **UI Components**: Shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **State Management**: React Context + TanStack Query
- **Forms**: React Hook Form
- **Testing**: Vitest

### Backend
- **Runtime**: Node.js + Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT + bcryptjs
- **Validation**: Zod
- **Security**: Helmet, CORS

### ML Service
- **Framework**: FastAPI + Uvicorn
- **Language**: Python 3.11+
- **Computer Vision**: OpenCV, MediaPipe (face/object detection)
- **Audio Processing**: LibROSA, Speech Recognition
- **Data Processing**: NumPy, scikit-learn

---

## ðŸ“ Project Structure

```
Yo-Score/
â”œâ”€â”€ frontend/                  # React + TypeScript web application
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/       # Reusable UI components
â”‚   â”‚   â”œâ”€â”€ pages/            # Application pages
â”‚   â”‚   â”œâ”€â”€ services/         # API client services
â”‚   â”‚   â”œâ”€â”€ context/          # React Context (auth, etc.)
â”‚   â”‚   â””â”€â”€ hooks/            # Custom React hooks
â”‚   â””â”€â”€ package.json
â”‚
â”œâ”€â”€ backend/                   # Node.js/Express API server
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ app.ts            # Express application setup
â”‚   â”‚   â”œâ”€â”€ controllers/      # Route handlers
â”‚   â”‚   â”œâ”€â”€ services/         # Business logic
â”‚   â”‚   â”œâ”€â”€ routes/           # API route definitions
â”‚   â”‚   â”œâ”€â”€ middleware/       # Auth, CORS, etc.
â”‚   â”‚   â”œâ”€â”€ types/            # TypeScript interfaces
â”‚   â”‚   â””â”€â”€ config/           # Configuration
â”‚   â”œâ”€â”€ db/
â”‚   â”‚   â”œâ”€â”€ index.ts          # Database connection
â”‚   â”‚   â””â”€â”€ schema.sql        # Database schema
â”‚   â””â”€â”€ package.json
â”‚
â”œâ”€â”€ ml-service/               # Python ML service
â”‚   â”œâ”€â”€ app.py               # FastAPI application
â”‚   â”œâ”€â”€ face_detector.py     # MediaPipe face detection
â”‚   â”œâ”€â”€ audio_analyzer.py    # Audio/speech analysis
â”‚   â”œâ”€â”€ object_detector.py   # Object detection
â”‚   â”œâ”€â”€ requirements.txt     # Python dependencies
â”‚   â””â”€â”€ SETUP.md             # Setup instructions
â”‚
â”œâ”€â”€ docs/                      # Comprehensive documentation
â”‚   â”œâ”€â”€ Vision.md             # Project vision and goals
â”‚   â”œâ”€â”€ PRD.md               # Product requirements
â”‚   â”œâ”€â”€ Architecture.md       # System architecture
â”‚   â”œâ”€â”€ Features.md          # Feature specifications
â”‚   â”œâ”€â”€ DataModel.md         # Database schema
â”‚   â”œâ”€â”€ Scoring.md           # Scoring algorithm
â”‚   â”œâ”€â”€ Security.md          # Security measures
â”‚   â”œâ”€â”€ Proctoring-Implementation.md # Proctoring details
â”‚   â””â”€â”€ more...
â”‚
â””â”€â”€ LICENSE
```

---

## ðŸš€ Getting Started

### Prerequisites
- Node.js 16+ (for frontend and backend)
- Python 3.11 or 3.12 (for ML service)
- PostgreSQL (or SQLite for development)

### Backend Setup

```bash
cd backend
npm install
npm run build
npm run dev  # Development mode with hot reload
```

**Environment Variables**: Create a `.env` file with:
```
DATABASE_URL=postgresql://user:password@localhost:5432/yoscore
JWT_SECRET=your-secret-key
PORT=3000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev  # Vite dev server at http://localhost:8080
```

### ML Service Setup

```bash
cd ml-service
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 5000
# Or simply: python app.py
```

> **Note**: Do not use `--reload` on Windows with Python 3.14 to avoid multiprocessing issues.

### Database Migration

```bash
cd backend
npm run migrate
```

---

## ðŸ—ï¸ Architecture

### High-Level System Design

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Frontend      â”‚ (React + TypeScript)
â”‚   (Browser)     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚ HTTP/REST
         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Backend API   â”‚ (Node.js + Express)
â”‚  - Auth         â”‚
â”‚  - Challenges   â”‚
â”‚  - Scoring      â”‚
â”‚  - Proctoring   â”‚
â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”˜
     â”‚        â”‚
     â”‚        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚                          â”‚
     â–¼                          â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  PostgreSQL  â”‚        â”‚  ML Service   â”‚ (Python FastAPI)
â”‚  Database    â”‚        â”‚  - Face Detectâ”‚
â”‚              â”‚        â”‚  - Audio      â”‚
â”‚              â”‚        â”‚  - Objects    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Key Components

1. **Frontend Layer**: React web interface with real-time proctoring UI, code editor, and dashboard
2. **Backend API**: RESTful endpoints for authentication, challenges, submissions, scoring, and proctoring logs
3. **Scoring Engine**: Rule-based scoring combining code correctness, efficiency, behavior compliance, and work experience
4. **Proctoring Module**: Real-time monitoring combining browser events, camera feed analysis, and audio analysis
5. **ML Service**: FastAPI service for advanced monitoring (face detection, audio analysis, object detection)

---

## ðŸ“Š Scoring System

The trust score is calculated as a weighted combination of three components:

| Component | Weight | Details |
|-----------|--------|---------|
| **Challenge Performance** | 60% | Correctness (0â€“40) + Efficiency (0â€“20) |
| **Behavior/Proctoring** | 20% | Base 20 points minus penalties for violations |
| **Work Experience** | 20% | Duration and relevance of past work (0â€“20) |

**Score Range**: 0â€“100 points

**Trust Levels**:
- **Low**: 0â€“49
- **Medium**: 50â€“74
- **High**: 75â€“100

### Proctoring Penalties

| Violation Type | Penalty |
|----------------|---------|
| Camera off | 10 points |
| Multiple faces detected | 15 points |
| Multiple voices detected | 20 points |
| Copy/paste detected | 12 points |
| Developer tools opened | 10 points |
| No face detected | 8 points |
| Looking away from screen | 7 points |
| Speech detected | 8 points |
| Tab switch | 5 points |
| Window blur (focus loss) | 3 points |
| Eyes closed | 4 points |
| Inactivity (60+ seconds) | 2 points |

### Example Calculation

```
Challenge Performance:
  - Correctness: 35/40
  - Efficiency: 15/20
  - Subtotal: 50/60

Behavior Score:
  - Base: 20
  - Penalties: -8 (2 tab switches Ã— 3 + 1 inactivity Ã— 2)
  - Subtotal: 12/20

Work Experience:
  - 12 months relevant exp: 12/20

Total Trust Score: 50 + 12 + 12 = 74 (Medium Trust Level)
```

---

## ðŸ“š Documentation

Comprehensive documentation is available in the [docs/](docs/) folder:

- **[Vision.md](docs/Vision.md)** - Project vision, goals, and success metrics
- **[PRD.md](docs/PRD.md)** - Product requirements, user personas, use cases
- **[Architecture.md](docs/Architecture.md)** - System architecture and design
- **[Features.md](docs/Features.md)** - Feature specifications and module details
- **[DataModel.md](docs/DataModel.md)** - Complete database schema
- **[Scoring.md](docs/Scoring.md)** - Scoring algorithm and calculation
- **[Proctoring-Implementation.md](docs/Proctoring-Implementation.md)** - Proctoring system details
- **[Security.md](docs/Security.md)** - Security measures and best practices
- **[API.md](docs/API.md)** - API endpoint documentation
- **[Roadmap.md](docs/Roadmap.md)** - Future features and enhancements

---

## ðŸ”’ Security Features

- **JWT-based authentication** with token expiration and rotation
- **Password hashing** using bcryptjs
- **HTTPS/TLS encryption** for all API traffic
- **Role-based access control** (RBAC) for different user types
- **Proctoring enforcement** with automatic violation detection
- **Sandboxed code execution** to prevent malicious access
- **Data encryption** at rest for sensitive information
- **CORS protection** and security headers (Helmet)

---

## ðŸ§ª Testing

### Frontend
```bash
cd frontend
npm run test        # Run tests once
npm run test:watch  # Watch mode
```

### Backend
Tests can be added using Jest or your preferred testing framework.

---

## ðŸ“ License

This project is licensed under the [MIT License](LICENSE).

---

## ðŸ‘¥ Contributing

This is an industry project. For contribution guidelines, please refer to the project documentation or contact the project lead.

---

## ðŸ“ž Support

For questions, issues, or documentation clarifications, refer to the [docs/](docs/) folder for comprehensive guidance on all aspects of the platform.

