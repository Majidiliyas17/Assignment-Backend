# Secure File Storage Service

Production-quality file storage backend: users register and authenticate with JWT, upload large files (100MB+ supported) directly to Cloudinary via signed requests, manage their files, and share them via secure public links.

Built with **Node.js, TypeScript, Express, TypeORM, PostgreSQL (Neon), Cloudinary, Zod** — fully tested with **Jest + Supertest**.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Cloudinary Architecture](#cloudinary-architecture)
- [Authentication Flow](#authentication-flow)
- [File Upload Flow](#file-upload-flow)
- [Public / Private Authorization Model](#public--private-authorization-model)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Local Setup](#local-setup)
- [Neon PostgreSQL Setup](#neon-postgresql-setup)
- [Cloudinary Setup](#cloudinary-setup)
- [Database Migration](#database-migration)
- [Running the Project](#running-the-project)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [Error Handling](#error-handling)
- [Deployment](#deployment)
- [Future Improvements](#future-improvements)

---

## Overview

The service provides:

- **User accounts** — secure registration/login with bcrypt password hashing and JWT sessions.
- **File management** — upload, list, view, rename, delete and download files.
- **Large file support** — files are uploaded **directly to Cloudinary** (client-to-cloud) so the server never buffers 100MB+ payloads; chunked uploads are enabled for large files.
- **Public/private visibility** — files are private by default; owners can generate secure share links.
- **REST API** — every endpoint returns a consistent JSON envelope.

---

## Features

- JWT-based authentication (`register`, `login`, `me`)
- Direct-to-Cloudinary **signed uploads** (server signs, client uploads — API secret never leaves the server)
- Chunked upload support (`chunk_size`) for files ≥ 10MB — smooth 100MB+ uploads
- Strict file validation: extension allowlist, dangerous-extension block, MIME-consistency checks, size limits
- Private-by-default files with **crypto-random share tokens** and public share links
- Ownership-based authorization (accessing another user's file returns `404`, no existence leak)
- Paginated file listing
- Helmet security headers, CORS, and **rate limiting** (global / auth / share)
- Structured logging (pino)
- Centralized error handling with typed error codes
- Type-safe request validation (Zod)
- 53 automated tests, including a real end-to-end flow against Cloudinary + Neon

---

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                       Client (SPA / mobile)             │
                    └───────────────────────────────┬─────────────────────────┘
                                                    │ HTTPS / JSON
                                                    ▼
                                       ┌───────────────────────────┐
                                       │        Express App         │
                                       │  (src/app.ts)              │
                                       │  helmet · cors · json      │
                                       │  rate-limit · logger       │
                                       └─────────────┬───────────────┘
                                                     │ routes (/api)
                                                     ▼
                        ┌───────────────┬───────────────┬───────────────┐
                        ▼               ▼               ▼               ▼
                  AuthController   FileController  ShareController HealthController
                        │               │               │               │
                        ▼               ▼               ▼               ▼
                  AuthService     FileService     FileService     AppDataSource
                        │               │               │              (TypeORM)
                        ▼               ▼               ▼
                  UserRepository  CloudinaryService  FileRepository
                        │               │               │
                        ▼               ▼               ▼
                   ┌─────────┐     ┌───────────┐   ┌──────────┐
                   │  Neon   │     │Cloudinary │   │  Neon    │
                   │PostgreSQL│    │ (files)   │   │PostgreSQL│
                   └─────────┘     └───────────┘   └──────────┘

  Direct upload path (large files):
  Client ──signed params──▶ POST /api/files/upload-signature  ──▶ CloudinaryService
  Client ──────direct multipart upload──────────────▶  api.cloudinary.com (signed)
  Client ──final publicId──▶ POST /api/files/complete ──▶ verify asset ──▶ DB row
```

Layering rule: **Route → Controller → Service → Repository/TypeORM → DB/external**. Controllers are thin; business logic lives in services; all data access goes through repositories (shared `BaseRepository`).

---

## Technology Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Language      | TypeScript (strict)                                     |
| Runtime       | Node.js 18+                                             |
| Web framework | Express 4                                               |
| ORM           | TypeORM 0.3 (PostgreSQL driver `pg`)                    |
| Database      | PostgreSQL on Neon (serverless)                         |
| Storage       | Cloudinary (images, videos, raw files)                  |
| Auth          | jsonwebtoken (JWT) + bcryptjs (12 rounds)               |
| Validation    | Zod                                                      |
| Security      | helmet, cors, express-rate-limit                        |
| Logging       | pino + pino-http + pino-pretty                          |
| Testing       | Jest + ts-jest + Supertest                              |

---

## Project Structure

```
backend/
├── src/
│   ├── app.ts                     # Express app assembly (middleware + routes)
│   ├── server.ts                  # Entry point (graceful start/shutdown)
│   ├── config/
│   │   ├── env.ts                 # Zod-validated environment config
│   │   ├── database.ts            # TypeORM DataSource (Neon + SSL)
│   │   ├── cloudinary.ts          # Cloudinary SDK config (optional at boot)
│   │   └── upload.ts              # Extension allowlist, MIME map, size limits
│   ├── enums/                     # Domain enums (+ index barrel)
│   │   ├── CloudinaryResourceType.ts
│   │   ├── FileStatus.ts
│   │   └── FileVisibility.ts
│   ├── entities/                  # TypeORM entities (+ index barrel)
│   │   ├── UserEntity.ts
│   │   └── FileEntity.ts
│   ├── dto/                       # Request schemas + response types (+ barrels)
│   │   ├── auth/                  # register.dto, login.dto, types.ts
│   │   ├── file/                  # upload-signature/complete/rename/list dtos, types.ts
│   │   ├── share/                 # visibility.dto
│   │   └── cloudinary/            # types.ts (SignedUploadParams, asset info)
│   ├── repositories/              # Data access (+ index barrel)
│   │   ├── BaseRepository.ts      # shared CRUD base
│   │   ├── UserRepository.ts
│   │   └── FileRepository.ts
│   ├── services/                  # Business logic (+ index barrel)
│   │   ├── AuthService.ts
│   │   ├── CloudinaryService.ts
│   │   └── FileService.ts
│   ├── controllers/               # Thin HTTP handlers (+ index barrel)
│   ├── middleware/                # (+ index barrel)
│   │   ├── AuthMiddleware.ts      # JWT auth
│   │   ├── ErrorMiddleware.ts     # centralized error → JSON
│   │   ├── ValidationMiddleware.ts# Zod schema validation
│   │   └── RateLimitMiddleware.ts # global/auth/share limiters
│   ├── routes/                    # Express routers (+ index barrel)
│   ├── types/                     # global express.d.ts (Request.user)
│   ├── utils/                     # AppError, ApiResponse, TokenUtils, FileUtils, logger
│   └── migrations/                # TypeORM SQL migrations
├── tests/
│   ├── helpers/                   # DB init + Cloudinary direct-upload helper
│   ├── auth/ file/ sharing/ security/ health/ cloudinary/
├── docs/
│   └── API.md                     # Full API reference
├── .env.example                   # Template for environment variables
└── Doc.md                         # Assignment specification
```

---

## Database Schema

### `users`

| Column         | Type    | Constraints                       |
| -------------- | ------- | --------------------------------- |
| `id`           | uuid    | PK, default `uuid_generate_v4()`  |
| `name`         | varchar(120) | NOT NULL                     |
| `email`        | varchar(255) | UNIQUE, NOT NULL             |
| `password_hash`| varchar(255) | NOT NULL (`select: false`)   |
| `created_at`   | timestamp | NOT NULL, default now()       |
| `updated_at`   | timestamp | NOT NULL, default now()       |

### `files`

| Column                 | Type          | Constraints                                    |
| ---------------------- | ------------- | ---------------------------------------------- |
| `id`                   | uuid          | PK, default `uuid_generate_v4()`               |
| `owner_id`             | uuid          | FK → `users.id` ON DELETE CASCADE, NOT NULL, indexed |
| `original_name`        | varchar(255)  | NOT NULL                                       |
| `storage_key`          | varchar(255)  | NOT NULL                                       |
| `cloudinary_public_id` | varchar(255)  | NOT NULL                                       |
| `resource_type`        | enum          | `auto / image / video / raw`, default `auto`   |
| `mime_type`            | varchar(255)  | NOT NULL                                       |
| `extension`            | varchar(30)   | NOT NULL                                       |
| `size`                 | bigint        | NOT NULL                                       |
| `visibility`           | enum          | `private / public`, default `private`          |
| `share_token`          | varchar(64)   | nullable, UNIQUE (crypto-random, 64 hex chars) |
| `status`               | enum          | `pending / completed / failed`, default `pending` |
| `created_at` / `updated_at` | timestamp | NOT NULL, default now()                 |

Indexes: `owner_id`, `created_at`, composite `(owner_id, created_at)`, unique `share_token`, unique `users.email`.

---

## Cloudinary Architecture

- **Signed uploads** — the server signs upload parameters (`timestamp`, `public_id`, optional `chunk_size`) with the API secret and returns them to the client. **The API secret is never exposed** in any response.
- **Direct upload** — the client uploads the file straight to `api.cloudinary.com` (`/{cloudName}/{resourceType}/upload`), so large payloads never pass through the backend.
- **Chunked uploads** — for files ≥ 10MB the signature includes `chunk_size: 20MB`, enabling Cloudinary's chunked/unsigned-style large uploads (supports the assignment's 100MB+ requirement).
- **Deterministic IDs** — storage IDs are server-generated UUIDs; the public ID is `file-storage/{userId}/{storageId}`. The original filename is display-only and never used for storage (rename does not move the asset).
- **Verification on complete** — `POST /api/files/complete` calls Cloudinary's Admin API (`getAssetInfo`) to confirm the asset exists, matches the declared size (±5%), and the declared MIME/extension.
- **Cleanup on delete** — deleting a file removes the Cloudinary asset (`uploader.destroy` + invalidation) and the DB row.
- **Download URLs** — secure HTTPS delivery URLs are generated server-side; raw storage IDs are never returned to clients.

---

## Authentication Flow

```
register ─▶ bcrypt.hash(pw, 12) ─▶ UserRepository.create ─▶ jwt.sign({sub: user.id})
login    ─▶ find user (with password) ─▶ bcrypt.compare ─▶ jwt.sign({sub: user.id})
me/other protected routes ─▶ Authorization: Bearer <jwt> ─▶ AuthMiddleware ─▶ TokenUtils.verify ─▶ load user ─▶ req.user
```

- Passwords are hashed with **bcrypt (12 rounds)**; plaintext is never stored.
- The JWT payload only carries `sub` (user id) + standard `iat/exp`.
- `AuthMiddleware` rejects missing/invalid tokens and users that no longer exist.

---

## File Upload Flow

```
1. POST /api/files/upload-signature            (auth required)
   body: { filename, mimeType?, size }
   → validates extension/MIME/size against allowlist + limits
   → returns { storageId, signature, timestamp, apiKey, cloudName,
               folder, publicId, resourceType }

2. Client uploads DIRECTLY to Cloudinary:
   POST https://api.cloudinary.com/v1_1/{cloudName}/{resourceType}/upload
   fields: file, public_id, timestamp, api_key, signature
   → Cloudinary responds with the final public_id (may include format suffix)

3. POST /api/files/complete                    (auth required)
   body: { publicId, originalName, resourceType?, mimeType?, size? }
   → server verifies the asset on Cloudinary (exists + size ±5%)
   → creates a `files` row (visibility=private, status=completed)
   → returns the FileView
```

---

## Public / Private Authorization Model

- Every file is **private by default**.
- `FileService.requireOwnerFile(userId, fileId)` guards all owner-scoped operations: a request for a file that does not belong to the caller returns **`404 FILE_NOT_FOUND`** — existence of other users' files is never revealed.
- **Sharing** — `POST /api/files/:id/share` generates a fresh crypto-random token (64 hex chars) and marks the file public. `GET /api/share/:shareToken` lets anyone (no auth) fetch the file's metadata + download URL.
- **Revocation** — `DELETE /api/files/:id/share` (or setting visibility back to `private`) clears the token; the old link immediately stops working. Generating a new share token invalidates the previous one.
- Public share access returns `404 SHARE_NOT_FOUND` for unknown tokens or non-public files (no disclosure).

---

## API Documentation

Full reference with request/response examples, status codes and error tables: **[docs/API.md](docs/API.md)**

Quick map (base `/api`):

| Method | Route                          | Auth | Purpose                          |
| ------ | ------------------------------ | ---- | -------------------------------- |
| GET    | `/health`                      | —    | Health check (app + DB)          |
| POST   | `/auth/register`               | —    | Create account                   |
| POST   | `/auth/login`                  | —    | Login, get JWT                   |
| GET    | `/auth/me`                     | ✅   | Current user                     |
| POST   | `/files/upload-signature`      | ✅   | Signed upload params             |
| POST   | `/files/complete`              | ✅   | Finalize uploaded asset          |
| GET    | `/files`                       | ✅   | List files (paginated)           |
| GET    | `/files/:id`                   | ✅   | Get file                         |
| PATCH  | `/files/:id`                   | ✅   | Rename file                      |
| DELETE | `/files/:id`                   | ✅   | Delete file                      |
| GET    | `/files/:id/download`          | ✅   | Get secure download URL          |
| PATCH  | `/files/:id/visibility`        | ✅   | Set public/private               |
| POST   | `/files/:id/share`             | ✅   | Create share link                |
| DELETE | `/files/:id/share`             | ✅   | Revoke share link                |
| GET    | `/share/:shareToken`           | —    | Public file access via share link|

---

## Environment Variables

| Variable                    | Required | Default                  | Description                                   |
| --------------------------- | -------- | ------------------------ | --------------------------------------------- |
| `NODE_ENV`                  | —        | `development`            | `development / test / production`             |
| `PORT`                      | —        | `4000`                   | HTTP port                                     |
| `DATABASE_URL`              | for DB   | —                        | PostgreSQL connection string (Neon)           |
| `DATABASE_ENVIRONMENT`      | production | —                      | Must be `production` in production; label preview/dev DBs accordingly |
| `DATABASE_EXPECTED_HOST`    | production | —                      | Production DB host expected in `DATABASE_URL` (no credentials) |
| `DATABASE_EXPECTED_NAME`    | production | —                      | Production database name expected in `DATABASE_URL` |
| `JWT_SECRET`                | ✅       | —                        | ≥16 chars (≥32 in production, enforced)       |
| `JWT_SECRET_VERSION`        | —        | `unversioned`            | Stable non-secret label logged at startup; change only when rotating JWT secret |
| `JWT_EXPIRES_IN`            | —        | `1d`                     | Token lifetime (jsonwebtoken format)          |
| `BCRYPT_ROUNDS`             | —        | `12`                     | bcrypt cost, integer from 10 to 14; keep stable between deploys |
| `REQUIRE_MIGRATIONS_CURRENT`| —        | `true`                   | Refuses startup when migrations have not been applied |
| `CLOUDINARY_CLOUD_NAME`     | for files| —                        | Cloudinary cloud name                         |
| `CLOUDINARY_API_KEY`        | for files| —                        | Cloudinary API key                            |
| `CLOUDINARY_API_SECRET`     | for files| —                        | Cloudinary API secret                         |
| `MAX_FILE_SIZE_MB`          | —        | `500`                    | Max allowed file size                         |
| `ALLOWED_EXTENSIONS`        | —        | built-in allowlist       | Comma-separated override (e.g. `jpg,png,pdf`) |
| `CORS_ORIGIN`               | —        | `http://localhost:3000`  | Comma-separated origins or `*`                |
| `APP_BASE_URL`              | —        | `http://localhost:4000`  | Base URL used to build share links            |

> Note: the app **boots even without Cloudinary keys** (great for local dev/testing). File endpoints return `500 CLOUDINARY_NOT_CONFIGURED` until the keys are set. `DATABASE_URL` is only required when DB features are used.

See [`.env.example`](.env.example).

---

## Local Setup

Prerequisites: **Node.js 18+**, **npm**.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env (DB URL, JWT secret, Cloudinary keys)

# 3. Create the database schema (migrations)
npm run migration:run

# 4. Start the dev server (tsx watch, hot reload)
npm run dev
```

Server starts on `http://localhost:4000` (health check: `GET /api/health`).

---

## Neon PostgreSQL Setup

1. Create a free serverless project at [neon.tech](https://neon.tech).
2. Copy the connection string (Postgres) from the dashboard — it looks like `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`.
3. Put it in `.env`:

   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

4. SSL is auto-enabled when the host contains `neon.tech` (or in production).

## Production database and deploy safety

Production never creates or resets a database at application startup: TypeORM has `synchronize: false`, `dropSchema: false`, and `migrationsRun: false`. Startup performs a read-only migration check and refuses to serve production traffic if the configured database is unavailable, not the expected host/name, or has pending migrations. This prevents a release from quietly connecting to an empty or preview database.

Configure the platform's **production** environment (not a build-time `.env` file) with persistent values. Do not enable any provider option that creates a fresh database/branch for each deployment.

```env
NODE_ENV=production
DATABASE_ENVIRONMENT=production
DATABASE_URL=postgresql://USER:PASSWORD@production-db-host/production-db?sslmode=require
DATABASE_EXPECTED_HOST=production-db-host
DATABASE_EXPECTED_NAME=production-db
JWT_SECRET=<stable-random-secret-kept-across-deploys>
JWT_SECRET_VERSION=2026-08-21
JWT_EXPIRES_IN=1d
BCRYPT_ROUNDS=12
REQUIRE_MIGRATIONS_CURRENT=true
```

Create separate persistent database instances (or, where supported, separate projects/branches) and credentials for development, preview, and production. Set `DATABASE_ENVIRONMENT=development` or `preview` outside production and never copy the production `DATABASE_URL` into those environments. The production host and name guards above must identify only the production database.

Release sequence (run the migration job once, before starting new application instances):

```bash
npm ci
npm run build
npm run migration:run:prod
npm start
```

Use only forward migrations in production. Do **not** run `migration:revert`, `schema:drop`, `prisma db push --force-reset`, `sequelize.sync({ force: true })`, or any database/branch recreation command against the production URL. Take a backup/snapshot before a migration.

The startup log contains only `environment`, database host/name, database environment label, migration status/count, bcrypt rounds, and JWT secret version. It never logs a connection string, password hash, token, or secret. Login responses remain generic, while server logs identify `user_not_found`, `password_hash_mismatch`, or `database_connection_or_config_issue` without recording the email or password.

---

## Cloudinary Setup

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. From the dashboard copy **Cloud Name**, **API Key**, **API Secret**.
3. Put them in `.env`:

   ```
   CLOUDINARY_CLOUD_NAME=your-cloud
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. Uploads land under `file-storage/{userId}/{storageId}` in your cloud.

---

## Database Migration

| Command              | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run migration:run`     | Apply all pending migrations      |
| `npm run migration:revert`  | Revert the last migration         |
| `npm run migration:generate -- src/migrations/<Name>` | Generate a migration from entity changes |

The initial migration (`Init`) creates the `files`, `users` tables and enum types.

`migration:revert` is for local recovery only; never use it with production credentials.

---

## Running the Project

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Dev server with watch mode (tsx)             |
| `npm run build`    | Compile TypeScript to `dist/`                |
| `npm start`        | Run the compiled server (`node dist/server.js`) |
| `npm test`         | Run the Jest test suite                      |

---

## Testing

The suite runs against a **real Neon database** (per-suite `TRUNCATE`) and **mocks Cloudinary** in most tests.

```bash
# Unit + integration (mocked Cloudinary) — 53 tests
npm test

# + Real Cloudinary end-to-end tests (actual upload/verify/delete)
#   against your configured cloud (7 tests, including a full API flow)
CLOUDINARY_INTEGRATION=true npx jest tests/cloudinary
```

Test suites: auth (14), files (18), sharing (12), security (2 — rate limit + headers), health (2), cloudinary signature (2), plus gated real-cloud integration/e2e.

---

## Security Considerations

- **Passwords**: bcrypt, 12 rounds.
- **JWT**: signed with a secret ≥32 chars enforced in production.
- **Rate limiting**: auth 20 failed attempts / 15 min (only failures count), share 60 / 15 min, global 300 / 15 min — all return `429 TOO_MANY_REQUESTS`.
- **Headers**: helmet (nosniff, frame-options SAMEORIGIN, referrer-policy, no X-Powered-By), CSP disabled for pure JSON API.
- **CORS**: origin allowlist (or `*`), credentials enabled.
- **File safety**: extension allowlist + dangerous-extension block (exe, scripts, html, svg, …), MIME-consistency checks, size limits, sanitized filenames (path traversal blocked).
- **Storage security**: files never execute on our server (direct-to-Cloudinary); storage IDs are random UUIDs, not user-controlled names.
- **Existence disclosure**: ownership checks return `404`, not `403`; share tokens are 256-bit random.
- **Secret hygiene**: Cloudinary API secret and JWT secret are never returned by any endpoint; errors never leak stack traces in production.

---

## Error Handling

All responses use a consistent envelope:

**Success**
```json
{ "success": true, "message": "…", "data": { } }
```

**Error**
```json
{
  "success": false,
  "message": "…",
  "error": { "code": "VALIDATION_ERROR", "details": [ { "path": "email", "message": "…" } ] }
}
```

Common error codes: `VALIDATION_ERROR` (422) · `INVALID_CREDENTIALS` (401) · `TOKEN_MISSING`/`INVALID_TOKEN`/`USER_NOT_FOUND` (401) · `EMAIL_ALREADY_REGISTERED` (409) · `UNSUPPORTED_FILE_TYPE`/`INVALID_MIME_TYPE`/`INVALID_FILENAME` (400) · `FILE_TOO_LARGE` (413) · `FILE_NOT_FOUND`/`SHARE_NOT_FOUND` (404) · `SIZE_MISMATCH` (400) · `TOO_MANY_REQUESTS` (429) · `NOT_FOUND` (404, unknown route) · `INTERNAL_ERROR` (500).

Unknown routes return `404 NOT_FOUND`. Unexpected errors return `500` with the stack omitted in production.

---

## Deployment

1. **Build**: `npm run build` → produces `dist/`.
2. **Serve**: `npm start` (`node dist/server.js`).
3. **Environment**: set `NODE_ENV=production`, a ≥32-char `JWT_SECRET`, `DATABASE_URL`, Cloudinary keys, `CORS_ORIGIN` and `APP_BASE_URL` (your public URL, used in share links).
4. **Migrations**: run `npm run migration:run` once against the production DB.
5. **Proxy/SSL**: run behind a reverse proxy (nginx/Caddy) or a PaaS; `app.set('trust proxy', 1)` is already configured so rate limiting works correctly behind a proxy.
6. Hosting options: Render, Railway, Fly.io, Vercel (Node), or any container platform. Use PostgreSQL (Neon) and Cloudinary as managed services.

---

## Future Improvements

- Refresh-token rotation and logout/token revocation (denylist).
- Object-storage-agnostic layer (S3/GCS drop-in) and CDN presigned-URL delivery.
- Virus scanning hook before a file is marked `completed`.
- Per-user storage quotas and usage analytics.
- Folder/tag organization and search.
- Thumbnail/transformation presets for images via Cloudinary.
- Full OpenAPI 3 spec + interactive Swagger UI.
- CI pipeline with GitHub Actions (lint, typecheck, tests).
