# 🎯 AI Interview Platform

A full-stack AI-powered interview preparation platform with coding challenges, mock interviews, resume analysis, and more.

## 📁 Project Structure

```
AI-Interview-Platform/
├── frontend/          # React 19 + Vite client
│   ├── src/
│   │   ├── components/    # Reusable UI (EditorPanel, Navbar, etc.)
│   │   ├── pages/         # Route pages (Coding, Interview, Dashboard…)
│   │   ├── data/          # Question bank data
│   │   ├── services/      # API client
│   │   └── styles/        # CSS
│   ├── package.json
│   └── vite.config.js
│
├── backend/           # Spring Boot 3.5 API server
│   ├── src/main/java/com/aiml/interviewplatform/
│   │   ├── controller/    # REST endpoints
│   │   ├── service/       # Business logic
│   │   ├── repository/    # JPA data access
│   │   ├── entity/        # Database models
│   │   ├── security/      # JWT auth
│   │   └── config/        # App configuration
│   └── pom.xml
│
└── README.md
```

## 🚀 Quick Start

### Backend (port 8080)
```bash
cd backend
./mvnw spring-boot:run
```

### Frontend (port 5173)
```bash
cd frontend
npm install
npm run dev
```

## ✨ Features

- **Coding IDE** — multi-language code editor with test-case evaluation
- **AI Mock Interview** — live voice/text interview with AI interviewer
- **Resume Analyzer** — upload resume, get AI-powered feedback
- **Dashboard** — progress tracking, stats, and streaks
- **Coding History** — review past submissions and scores

## 🛠️ Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, Vite, React Router, CSS   |
| Backend  | Spring Boot 3.5, Java 17, JPA       |
| Database | H2 (file-based)                     |
| Auth     | JWT (JSON Web Tokens)               |
| AI       | Google Gemini API                   |

## 🔑 Environment Variables

### Backend (`backend/src/main/resources/application.properties`)
```properties
gemini.api.key=YOUR_GEMINI_API_KEY
jwt.secret=YOUR_JWT_SECRET
```

### Frontend (`frontend/.env`)
```properties
VITE_API_BASE_URL=http://localhost:8080
```

## 📦 Building for Production

```bash
# Frontend
cd frontend && npm run build   # outputs to frontend/dist/

# Backend
cd backend && ./mvnw package   # outputs to backend/target/*.jar
```
