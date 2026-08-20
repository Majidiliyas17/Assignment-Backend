# API Reference

Base URL: `http://localhost:4000/api` (configurable via `PORT` / `APP_BASE_URL`).

All endpoints return a consistent JSON envelope.

**Success**
```json
{ "success": true, "message": "…", "data": { } }
```

**Error**
```json
{
  "success": false,
  "message": "…",
  "error": { "code": "…", "details": { } }
}
```

`details` (and `stack` in non-production) are only present when relevant.

---

## Authentication

Tokens are supplied as `Authorization: Bearer <jwt>`. A locked endpoint without a valid token returns `401`.

| Code                  | Status | Meaning                                        |
| --------------------- | ------ | ---------------------------------------------- |
| `TOKEN_MISSING`       | 401    | No `Authorization` header / not a Bearer token |
| `INVALID_TOKEN`       | 401    | Token invalid or expired                       |
| `USER_NOT_FOUND`      | 401    | Token's user no longer exists                  |

---

### POST /auth/register

Create a new account. No authentication.

**Request body**

| Field      | Type   | Required | Rules                                    |
| ---------- | ------ | -------- | ---------------------------------------- |
| `name`     | string | ✅       | 2–120 chars                              |
| `email`    | string | ✅       | valid email, ≤255 chars, lowercased      |
| `password` | string | ✅       | 8–72 chars; must contain upper, lower, digit and special character |

**Success — `201 Created`**

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": { "id": "uuid", "name": "Alice", "email": "alice@example.com", "createdAt": "2026-01-01T00:00:00.000Z" },
    "accessToken": "<jwt>"
  }
}
```

**Errors**

| Code                       | Status | Condition                    |
| -------------------------- | ------ | ---------------------------- |
| `VALIDATION_ERROR`         | 422    | Field rules violated         |
| `EMAIL_ALREADY_REGISTERED` | 409    | Email already registered     |
| `TOO_MANY_REQUESTS`        | 429    | > 20 failed attempts / 15 min |

---

### POST /auth/login

Log in and receive a JWT. No authentication.

**Request body**

| Field      | Type   | Required | Rules        |
| ---------- | ------ | -------- | ------------ |
| `email`    | string | ✅       | valid email  |
| `password` | string | ✅       | non-empty    |

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "uuid", "name": "Alice", "email": "alice@example.com", "createdAt": "…" },
    "accessToken": "<jwt>"
  }
}
```

**Errors**

| Code                 | Status | Condition                                         |
| -------------------- | ------ | ------------------------------------------------- |
| `VALIDATION_ERROR`   | 422    | Missing/invalid fields                            |
| `INVALID_CREDENTIALS`| 401    | Unknown email **or** wrong password (identical, no user-enumeration) |
| `TOO_MANY_REQUESTS`  | 429    | > 20 failed attempts / 15 min                    |

---

### GET /auth/me

Return the authenticated user **and** their storage usage. **Auth required.**

**Headers:** `Authorization: Bearer <jwt>`

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Current user",
  "data": {
    "id": "uuid",
    "name": "Alice",
    "email": "alice@example.com",
    "createdAt": "…",
    "storage": {
      "usedBytes": 524288,
      "quotaBytes": 524288000,
      "remainingBytes": 523763712,
      "percentUsed": 0
    }
  }
}
```

`storage` reflects the user's per-account storage quota (default **500 MB**, configurable per user via `storage_quota_bytes` in the DB / `STORAGE_QUOTA_MB` env for new accounts).

**Errors:** `TOKEN_MISSING` (401) · `INVALID_TOKEN` (401) · `USER_NOT_FOUND` (401)

---

## Health

### GET /health

No authentication. Reports app + database status.

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "ok",
    "environment": "development",
    "uptime": 42,
    "timestamp": "2026-01-01T00:00:00.000Z",
    "database": "connected",
    "responseTimeMs": 3
  }
}
```

`database` is `connected` / `disconnected` / `not_configured` (when no `DATABASE_URL`).

---

## Files

All file endpoints require **`Authorization: Bearer <jwt>`**.

**Authorization behavior (all `/files` routes):** operations on a specific `:id` only succeed for the file's **owner**. Accessing another user's file returns `404 FILE_NOT_FOUND` — file existence is never leaked.

### POST /files/upload-signature

Generate signed upload parameters so the client can upload the file **directly** to Cloudinary.

**Request body**

| Field      | Type   | Required | Rules                                    |
| ---------- | ------ | -------- | ---------------------------------------- |
| `filename` | string | ✅       | 1–255 chars; must have an allowed extension |
| `mimeType` | string | —        | optional; checked against the extension  |
| `size`     | number | ✅       | positive integer, ≤ `MAX_FILE_SIZE_MB`   |

Allowed extensions (default): `jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip, mp4` (overridable via `ALLOWED_EXTENSIONS`).

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Upload signature generated",
  "data": {
    "storageId": "uuid",
    "signature": "hex",
    "timestamp": "1786658251",
    "apiKey": "…",
    "cloudName": "your-cloud",
    "folder": "file-storage/{userId}",
    "publicId": "file-storage/{userId}/{storageId}",
    "resourceType": "raw"
  }
}
```

`resourceType` is `image` / `video` / `raw` based on the extension.

**Cloudinary upload call (client side):**

The signature returned above only covers the two parameters the client actually sends. To upload, the client must POST `multipart/form-data` to:

```
https://api.cloudinary.com/v1_1/{cloudName}/{resourceType}/upload
```

with exactly these fields in the body:

| Field        | Required | Notes                                          |
| ------------ | -------- | ---------------------------------------------- |
| `file`       | ✅       | the file data                                 |
| `api_key`    | ✅       | returned `apiKey`                             |
| `timestamp`  | ✅       | returned `timestamp`                          |
| `signature`  | ✅       | returned `signature`                          |
| `public_id`  | ✅       | returned `publicId`                           |

`cloud_name` and `resource_type` go in the URL path — never in the form body. **Do not send any other parameter** (e.g. `folder`, `chunk_size`, `tags`): a signed upload rejects any parameter that is not covered by the signature with `Invalid Signature`. Signature covers `public_id` + `timestamp` only.

**Size limit:** Cloudinary accepts a single (non-chunked) upload up to **100 MB**. Larger files are rejected by the backend before signing with `413 CLOUDINARY_SINGLE_UPLOAD_LIMIT_EXCEEDED` (chunked uploads are not supported yet).

**Errors**

| Code                    | Status | Condition                        |
| ----------------------- | ------ | -------------------------------- |
| `VALIDATION_ERROR`      | 422    | Invalid body                     |
| `INVALID_FILENAME`      | 400    | Missing/unsafe filename          |
| `UNSUPPORTED_FILE_TYPE` | 400    | Extension not allowed / dangerous |
| `INVALID_MIME_TYPE`     | 400    | MIME does not match extension    |
| `FILE_TOO_LARGE`        | 413    | `size` > `MAX_FILE_SIZE_MB`      |
| `STORAGE_QUOTA_EXCEEDED`| 413    | Uploading `size` would exceed the user's remaining storage quota |
| `CLOUDINARY_SINGLE_UPLOAD_LIMIT_EXCEEDED` | 413 | `size` > Cloudinary's 100 MB single-upload limit |
| `CLOUDINARY_NOT_CONFIGURED` | 500 | Cloudinary keys not set        |
| `TOKEN_MISSING` / `INVALID_TOKEN` / `USER_NOT_FOUND` | 401 | Auth failure |

**Storage quota:** each user has a total storage limit (default **500 MB**). The backend rejects any upload (`size` + files already stored) that would exceed it with `413 STORAGE_QUOTA_EXCEEDED`. Query `GET /files/usage` or `GET /auth/me` to read the current usage.

---

### POST /files/complete

Finalize an upload: verify the asset on Cloudinary and create the file record. Called by the client **after** it uploaded the file to Cloudinary.

**Request body**

| Field          | Type   | Required | Rules                                  |
| -------------- | ------ | -------- | -------------------------------------- |
| `publicId`     | string | ✅       | ≤500 chars; the public ID Cloudinary returned |
| `originalName` | string | ✅       | 1–255 chars                            |
| `resourceType` | string | —        | one of `auto / image / video / raw`; defaults to `raw` |
| `mimeType`     | string | —        | optional; validated against extension  |
| `size`         | number | —        | optional; must match uploaded size ±5% |

**Success — `201 Created`**

```json
{
  "success": true,
  "message": "Upload completed",
  "data": {
    "id": "uuid",
    "originalName": "report.pdf",
    "mimeType": "application/pdf",
    "extension": "pdf",
    "size": 123456,
    "visibility": "private",
    "status": "completed",
    "resourceType": "raw",
    "shareToken": null,
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

**Errors**

| Code                         | Status | Condition                        |
| ---------------------------- | ------ | -------------------------------- |
| `VALIDATION_ERROR`           | 422    | Invalid body                     |
| `INVALID_FILENAME` / `UNSUPPORTED_FILE_TYPE` / `INVALID_MIME_TYPE` | 400 | Upload metadata rejected |
| `SIZE_MISMATCH`              | 400    | Declared size differs from asset > 5% |
| `STORAGE_QUOTA_EXCEEDED`     | 413    | Stored asset would exceed the user's remaining storage quota |
| `CLOUDINARY_ASSET_NOT_FOUND` | 400    | Asset missing / still processing / wrong resource type |
| `CLOUDINARY_VERIFY_FAILED`   | 500    | Cloudinary verification failed      |
| `CLOUDINARY_NOT_CONFIGURED`  | 500    | Cloudinary keys not set          |

---

### GET /files

List the caller's files, newest first. **Auth required.**

**Query parameters**

| Parameter | Type   | Default | Rules                 |
| --------- | ------ | ------- | --------------------- |
| `page`    | number | `1`     | ≥ 1                   |
| `limit`   | number | `20`    | 1–100                 |

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Files retrieved",
  "data": {
    "files": [ { "id": "uuid", "originalName": "…", "size": 123, "visibility": "private", "status": "completed", "resourceType": "raw", "shareToken": null, "createdAt": "…", "updatedAt": "…" } ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```

**Errors:** `VALIDATION_ERROR` (422, bad query) · auth codes (401)

---

### GET /files/usage

Return the authenticated user's current storage usage against their quota. **Auth required.**

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Storage usage retrieved",
  "data": {
    "usedBytes": 524288,
    "quotaBytes": 524288000,
    "remainingBytes": 523763712,
    "percentUsed": 0
  }
}
```

| Field            | Type   | Meaning                                        |
| ---------------- | ------ | ---------------------------------------------- |
| `usedBytes`      | number | Total bytes of `completed` files owned by the user |
| `quotaBytes`     | number | User's storage quota in bytes |
| `remainingBytes` | number | `quotaBytes − usedBytes` (never negative) |
| `percentUsed`    | number | `0–100`, rounded, `min(100, used/quota×100)` |

Deleting a file frees its size on the next call; completed uploads increase `usedBytes`.

**Errors:** `USER_NOT_FOUND` (401) · auth codes (401)

---

### GET /files/:id

Get one owned file. **Auth required.**

**Success — `200 OK`** — `data` is a single `FileView` (shape above).

**Errors:** `FILE_NOT_FOUND` (404, also for another user's file) · auth codes (401)

---

### PATCH /files/:id

Rename a file. **Auth required, owner only.**

**Request body**

| Field  | Type   | Required | Rules          |
| ------ | ------ | -------- | -------------- |
| `name` | string | ✅       | 1–255 chars    |

**Success — `200 OK`** — `data` is the updated `FileView` (`originalName` updated; storage untouched).

**Errors:** `VALIDATION_ERROR` (422) · `INVALID_FILENAME` (400) · `FILE_NOT_FOUND` (404) · auth codes (401)

---

### DELETE /files/:id

Delete a file — removes the Cloudinary asset and the DB row. **Auth required, owner only.**

**Success — `200 OK`**

```json
{ "success": true, "message": "File deleted", "data": null }
```

**Errors:** `FILE_NOT_FOUND` (404) · `CLOUDINARY_DELETE_FAILED` (400) · `CLOUDINARY_NOT_CONFIGURED` (500) · auth codes (401)

---

### GET /files/:id/download

Get a secure HTTPS download URL for an owned file. **Auth required, owner only.**

**Success — `200 OK`**

```json
{ "success": true, "message": "Download URL generated", "data": { "url": "https://res.cloudinary.com/…/file-storage/…" } }
```

**Errors:** `FILE_NOT_FOUND` (404) · `FILE_ASSET_MISSING` (500) · `CLOUDINARY_NOT_CONFIGURED` (500) · auth codes (401)

---

### PATCH /files/:id/visibility

Set a file public or private. **Auth required, owner only.**

**Request body**

| Field        | Type   | Required | Rules             |
| ------------ | ------ | -------- | ----------------- |
| `visibility` | string | ✅       | `public` or `private` |

Setting to `private` revokes the share token.

**Success — `200 OK`** — `data` is the updated `FileView`.

**Errors:** `VALIDATION_ERROR` (422) · `FILE_NOT_FOUND` (404) · auth codes (401)

---

### POST /files/:id/share

Create (or rotate) a share link for an owned file. **Auth required, owner only.** Marks the file `public`.

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Share link created",
  "data": {
    "file": { "…FileView…", "visibility": "public", "shareToken": "<64 hex chars>" },
    "shareToken": "<64 hex chars>",
    "shareUrl": "http://localhost:4000/api/share/<64 hex chars>"
  }
}
```

Rotating the token invalidates any previously issued link.

**Errors:** `FILE_NOT_FOUND` (404) · auth codes (401)

---

### DELETE /files/:id/share

Revoke a share link (file returns to `private`, token cleared). **Auth required, owner only.**

**Success — `200 OK`** — `data` is the updated `FileView` (`visibility: private`, `shareToken: null`).

**Errors:** `FILE_NOT_FOUND` (404) · auth codes (401)

---

## Sharing

### GET /share/:shareToken

Access a shared file **without authentication**. Public endpoint.

**Success — `200 OK`**

```json
{
  "success": true,
  "message": "Shared file retrieved",
  "data": {
    "file": { "…FileView…", "visibility": "public", "shareToken": "<token>" },
    "downloadUrl": "https://res.cloudinary.com/…"
  }
}
```

**Errors**

| Code                | Status | Condition                                        |
| ------------------- | ------ | ------------------------------------------------ |
| `SHARE_NOT_FOUND`   | 404    | Unknown token, or the file is no longer public   |
| `FILE_ASSET_MISSING`| 500    | File has no stored asset                         |
| `TOO_MANY_REQUESTS` | 429    | > 60 requests / 15 min                           |

---

## Rate Limits

| Limiter | Scope        | Limit              | Notes                                   |
| ------- | ------------ | ------------------ | --------------------------------------- |
| Auth    | `/api/auth`  | 20 / 15 min        | Only **failed** attempts counted        |
| Share   | `/api/share` | 60 / 15 min        | Token brute-force protection            |
| Global  | `/api`       | 300 / 15 min       | Baseline protection                     |

Exceeded limits return `429 TOO_MANY_REQUESTS` with `RateLimit-*` headers.

---

## Common Status Codes

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| 200  | Success / list / read / update / share               |
| 201  | Resource created (register, complete upload)        |
| 400  | Bad request (file/mime/size/filename, size mismatch) |
| 401  | Missing/invalid token, bad credentials             |
| 404  | Route/file/share not found                          |
| 409  | Email already registered                            |
| 413  | Payload too large                                   |
| 422  | Validation error                                    |
| 429  | Rate limit exceeded                                 |
| 500  | Internal / Cloudinary / asset errors                |
