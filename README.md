# Web Development Final Project – Auth Server

This repository contains an Express authentication server connected to MongoDB.
It supports register/login, cookies-based auth, token refresh, and logout.

## Features
- MongoDB user storage (email + bcrypt `passwordHash`)
- Email normalization (lowercase) + validations
- Password policy: at least 8 chars, includes at least one letter and one number
- JWT access token (short-lived) + refresh token (1 day)
- httpOnly cookies
  - `access_token` on path `/`
  - `refresh_token` on path `/auth/refresh`
- Endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `POST /auth/logout`

## Prerequisites
Install:
- Node.js (LTS recommended)
- Docker Desktop (for MongoDB)

## Setup

### 1) Install dependencies
From the project root (same folder as `server.js`):
```bash
npm install
```

### 2) Start MongoDB (Docker)
```bash
docker compose up -d
```

Verify Mongo is running:
```bash
docker ps | grep -i mongo
```

### 3) Create `.env`
Create a file named `.env` in the project root (same folder as `server.js`):
```env
PORT=4000
NODE_ENV=development

MONGO_URI=mongodb://127.0.0.1:27017/afeka_trip_auth

JWT_ACCESS_SECRET=CHANGE_ME
JWT_REFRESH_SECRET=CHANGE_ME

ACCESS_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=1d

SUBMITTERS=YuvalGarzon,YarinShushan

CLIENT_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
```

Generate strong secrets (recommended) and paste them into `.env`:
```bash
python3 - <<'PY'
import secrets
print("JWT_ACCESS_SECRET=" + secrets.token_hex(32))
print("JWT_REFRESH_SECRET=" + secrets.token_hex(32))
PY
```

## Run

### Development
```bash
npm run dev
```

The server will run on:
- `http://localhost:4000`

## Quick manual test (curl)

Reset database (optional):
```bash
docker exec web-mongo mongosh --quiet --eval "db=db.getSiblingDB('afeka_trip_auth'); printjson(db.dropDatabase());"
```

Auth flow:
```bash
rm -f cookies.txt

curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Passw0rd1"}' \
  http://localhost:4000/auth/register

curl -i -b cookies.txt http://localhost:4000/auth/me

curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:4000/auth/refresh

curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:4000/auth/logout

curl -i -b cookies.txt http://localhost:4000/auth/me

rm -f cookies.txt
```

Expected statuses:
- register: 201
- me: 200
- refresh: 200
- logout: 200
- me after logout: 401

## Notes
- `.env` is required and should not be committed.
- `cookies.txt` is created only for the curl test and can be deleted.