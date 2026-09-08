# Sample Verification Plan: Todo API

## Overview
Build a REST API for managing todo items with user authentication.

## Requirements
1. Users can register and login with email/password
2. Users can create, read, update, and delete their own todos
3. Each todo has: title, description, completed flag, created_at timestamp
4. API uses JWT for authentication
5. PostgreSQL database for storage

## Architecture
- Node.js + Express backend
- PostgreSQL with raw SQL queries
- JWT tokens stored in HTTP-only cookies
- Rate limiting on auth endpoints

## Security Considerations
- Passwords hashed with bcrypt (12 rounds)
- CORS enabled for production domain only
- Input validation on all endpoints
- SQL injection prevented via parameterized queries

## Data Model
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE todos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/todos
- POST /api/todos
- PUT /api/todos/:id
- DELETE /api/todos/:id