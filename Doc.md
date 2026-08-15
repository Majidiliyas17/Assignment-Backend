Role: Senior Backend Engineer / Software Architect

You are a Senior Backend Engineer and Software Architect responsible for building the complete production-quality backend for a Full Stack Engineer take-home assignment.

The assignment is to build a secure file storage service where authenticated users can register, log in, upload and manage files, and control whether files are public or private. Public files must be accessible through secure shareable links, while private files must only be accessible by their owner through proper authorization.

The backend must support files of at least 100 MB, provide a scalable upload architecture, validation, secure authorization, proper error handling, and clean REST APIs.

IMPORTANT: Build ONLY the backend in this phase. Do not build the frontend yet.

---

1. Required Technology Stack

Use exactly the following primary stack:

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- TypeORM
- Neon PostgreSQL for the hosted database
- Cloudinary for file storage
- JWT for authentication
- bcrypt or bcryptjs for password hashing
- Zod for request validation
- Helmet
- CORS
- Rate limiting
- Jest + Supertest for testing

Use modern TypeScript and clean asynchronous programming.

Do not introduce unnecessary frameworks or technologies.

---

2. Architectural Goal

Build a modular, maintainable backend similar to a professional enterprise Node.js application.

Follow a layered architecture:

Route
→ Controller
→ Service
→ Repository / TypeORM
→ Database / External Service

Use clear separation of responsibilities.

Controllers should be thin.

Business logic should primarily live in services.

Database access should be isolated from business logic as much as reasonably practical.

External Cloudinary operations should be isolated in a dedicated Cloudinary service.

Authentication and authorization should be handled through reusable middleware and service-level ownership checks.

---

3. Recommended Project Structure

Create a structure similar to:

src/
│
├── config/
│   ├── database.ts
│   ├── cloudinary.ts
│   └── env.ts
│
├── entities/
│   ├── UserEntity.ts
│   └── FileEntity.ts
│
├── controllers/
│   ├── AuthController.ts
│   └── FileController.ts
│
├── services/
│   ├── AuthService.ts
│   ├── FileService.ts
│   └── CloudinaryService.ts
│
├── repositories/
│   ├── UserRepository.ts
│   └── FileRepository.ts
│
├── routes/
│   ├── AuthRoutes.ts
│   ├── FileRoutes.ts
│   └── ShareRoutes.ts
│
├── middleware/
│   ├── AuthMiddleware.ts
│   ├── ErrorMiddleware.ts
│   ├── RateLimitMiddleware.ts
│   └── ValidationMiddleware.ts
│
├── validators/
│   ├── AuthValidator.ts
│   └── FileValidator.ts
│
├── types/
│   ├── auth.ts
│   └── file.ts
│
├── utils/
│   ├── ApiResponse.ts
│   ├── AppError.ts
│   ├── TokenUtils.ts
│   └── FileUtils.ts
│
├── migrations/
│
├── app.ts
└── server.ts

tests/
├── auth/
├── files/
└── sharing/

Do not blindly follow this structure if a better clean architecture decision is necessary, but keep the same architectural principles.

---

4. Database Design

Use TypeORM with PostgreSQL.

Do NOT use:

synchronize: true

for production.

Use TypeORM migrations.

User Entity

Create a User entity with at least:

- id: UUID primary key
- name
- email: unique
- passwordHash
- createdAt
- updatedAt

Relationship:

One User has many Files.

---

File Entity

Create a File entity with:

- id: UUID primary key
- ownerId / owner relation
- originalName
- storageKey
- cloudinaryPublicId
- cloudinaryResourceType
- mimeType
- extension
- size
- visibility
- shareToken
- status
- createdAt
- updatedAt

Recommended enum values:

visibility:

- private
- public

status:

- pending
- completed
- failed

Add appropriate indexes.

At minimum consider indexes for:

- ownerId
- shareToken
- createdAt
- ownerId + createdAt

shareToken should be unique when present.

Use proper foreign-key relationships.

---

5. Authentication

Implement secure authentication.

Register

POST /api/auth/register

Request:

{
"name": "John Doe",
"email": "john@example.com",
"password": "StrongPassword123!"
}

Requirements:

- Validate request with Zod
- Validate email
- Validate password strength
- Check duplicate email
- Hash password
- Never store plaintext password
- Create user
- Generate JWT
- Return safe user information
- Never return passwordHash

---

6. Login

POST /api/auth/login

Requirements:

- Validate credentials
- Compare hashed password
- Generate JWT
- Return authenticated user
- Return access token
- Never expose password hash

Use a configurable JWT expiration.

Example environment variable:

JWT_EXPIRES_IN=1d

---

7. Current User

GET /api/auth/me

Protected endpoint.

Return:

- id
- name
- email
- createdAt

Never return passwordHash.

---

8. Authentication Middleware

Create reusable JWT authentication middleware.

The middleware should:

1. Read Authorization header
2. Validate Bearer token
3. Verify JWT
4. Extract user ID
5. Attach authenticated user information to request
6. Reject invalid or expired tokens

Use:

401 Unauthorized

for authentication failures.

Do not leak internal JWT verification details.

---

9. File Upload Architecture

This is extremely important.

DO NOT design the system so that the backend server receives the entire 100+ MB file and then forwards it to Cloudinary unless there is a strong technical reason.

Prefer direct browser-to-Cloudinary upload using a secure backend-generated signed upload.

Architecture:

Frontend
↓
Backend signature endpoint
↓
Backend authenticates user
↓
Backend validates upload parameters
↓
Backend generates Cloudinary signature
↓
Frontend uploads directly to Cloudinary
↓
Cloudinary returns asset information
↓
Frontend calls backend completion endpoint
↓
Backend validates Cloudinary result
↓
Backend stores file metadata in PostgreSQL

This keeps large file traffic away from the Node.js application server.

Cloudinary API secret must NEVER be exposed to the frontend.

---

10. Cloudinary Integration

Create a dedicated CloudinaryService.

Use environment variables:

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

Never expose CLOUDINARY_API_SECRET through any API response.

For arbitrary file storage, correctly handle Cloudinary resource types, including raw files where appropriate.

Use a deterministic server-generated storage path such as:

file-storage/{userId}/{generatedId}

Do not use the original filename as the storage identifier.

---

11. Signed Upload Endpoint

Create:

POST /api/files/upload-signature

Protected endpoint.

The backend should:

- Authenticate user
- Validate requested filename
- Validate extension
- Validate MIME type
- Validate file size metadata
- Generate a unique storage identifier
- Generate Cloudinary upload signature
- Return only the information required by the frontend

Example response:

{
"success": true,
"data": {
"signature": "...",
"timestamp": 1234567890,
"apiKey": "...",
"cloudName": "...",
"folder": "...",
"publicId": "..."
}
}

Never return:

CLOUDINARY_API_SECRET

---

12. Large File Support

The assignment requires support for at least 100 MB.

Design the system so files such as:

- 10 MB
- 50 MB
- 100 MB
- 150 MB
- 250 MB

can be handled correctly.

Cloudinary large/chunked upload capabilities should be used where appropriate.

Do not load large files completely into Node.js memory.

Use streaming/chunked/direct-upload principles.

Make the maximum file size configurable:

MAX_FILE_SIZE_MB=500

Do not hardcode 100 MB throughout the codebase.

---

13. File Validation

Implement defense-in-depth validation.

Do not trust client-provided MIME type alone.

Validate:

- filename
- extension
- MIME type
- file size
- upload parameters
- Cloudinary response
- ownership
- visibility

Use an allowlist of supported file types.

Suggested initial allowlist:

Images:

- jpg
- jpeg
- png
- webp

Documents:

- pdf
- doc
- docx
- xls
- xlsx
- ppt
- pptx
- txt
- csv

Archives:

- zip

Media:

- mp4

Keep the allowed file types configurable.

Reject dangerous executable/script file types such as:

- exe
- bat
- cmd
- sh
- php
- jsp
- asp
- aspx

Do not rely only on extension validation.

Sanitize and normalize the original filename.

Do not use user-controlled filenames as storage paths.

---

14. Upload Completion Endpoint

Create:

POST /api/files/complete

Protected endpoint.

After Cloudinary upload succeeds, the frontend sends the Cloudinary upload result to the backend.

The backend must:

- Authenticate user
- Validate request
- Validate Cloudinary asset information
- Validate file size
- Validate MIME/resource type
- Generate/store internal metadata
- Create File database record
- Associate file with authenticated user
- Set default visibility to private
- Set status to completed

Never trust arbitrary ownerId sent by the frontend.

The owner must always come from the authenticated JWT.

---

15. File Listing

Create:

GET /api/files

Protected endpoint.

Return ONLY files belonging to the authenticated user.

Implement pagination.

Support:

page
limit

Recommended default:

page = 1
limit = 20

Response should contain:

- files
- pagination metadata

Example:

{
"success": true,
"data": {
"files": [],
"pagination": {
"page": 1,
"limit": 20,
"total": 100,
"totalPages": 5
}
}
}

Never return another user's private files.

---

16. Get Single File

Create:

GET /api/files/:id

Protected endpoint.

Requirements:

- Authenticate user
- Find file
- Verify owner
- Return metadata

A user must not be able to retrieve another user's private file metadata.

---

17. File Authorization

This is a critical requirement.

For every private-file operation:

- verify authenticated user
- verify file exists
- verify file.ownerId === authenticated user ID

Do not trust:

- ownerId from request body
- user ID from URL
- frontend state

The authenticated JWT identity is the source of truth.

Return:

401 for unauthenticated requests.

403 for authenticated users without permission.

404 where appropriate for resources that should not be disclosed.

---

18. File Download

Create:

GET /api/files/:id/download

Protected endpoint.

For private files:

Only the owner can download.

For public files:

The file may be accessed through its public share mechanism.

Do not expose internal storage credentials.

Prefer generating an appropriate secure Cloudinary delivery URL after authorization.

Do not blindly expose sensitive storage information.

---

19. Public / Private Visibility

Create:

PATCH /api/files/:id/visibility

Request:

{
"visibility": "public"
}

or:

{
"visibility": "private"
}

Only the owner can change visibility.

Default visibility for every uploaded file must be:

private

---

20. Shareable Public Link

Create:

POST /api/files/:id/share

Requirements:

- Authenticate user
- Verify ownership
- Generate a cryptographically secure random share token
- Store token
- Mark file public if the design requires it
- Return share URL information

Do NOT use:

- database ID
- Cloudinary public ID
- filename

as the public token.

Use a cryptographically secure random token.

---

21. Public Share Endpoint

Create:

GET /api/share/:shareToken

This endpoint does not require authentication.

Flow:

shareToken
↓
find file
↓
verify file exists
↓
verify visibility = public
↓
return/access the file

If private:

deny access.

If invalid:

return appropriate 404 response.

Do not expose private file metadata.

---

22. Disable Sharing

Create:

DELETE /api/files/:id/share

Only the owner can disable public sharing.

After disabling:

- visibility becomes private
- old share token must no longer provide access

Consider invalidating/removing the token.

---

23. Rename File

Create:

PATCH /api/files/:id

Allow the owner to update the display filename.

Validate:

- maximum filename length
- invalid characters
- empty names
- path traversal attempts
- dangerous names

Do not use the display filename as the Cloudinary storage identifier.

---

24. Delete File

Create:

DELETE /api/files/:id

Flow:

1. Authenticate user
2. Find file
3. Verify ownership
4. Delete asset from Cloudinary
5. Remove database record or mark it deleted
6. Return success

Handle Cloudinary deletion failures safely.

Do not silently report successful deletion if the external storage operation failed.

Consider whether transactional/compensating behavior is needed.

---

25. Error Handling

Create a centralized AppError system and global error middleware.

Use consistent status codes:

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
413 Payload Too Large
422 Validation Error
429 Too Many Requests
500 Internal Server Error

Response format:

{
"success": false,
"message": "Human readable message",
"error": {
"code": "FILE_ACCESS_DENIED"
}
}

Do not expose:

- stack traces
- database errors
- Cloudinary secrets
- environment variables
- internal filesystem paths
- sensitive implementation details

in production responses.

---

26. Security Middleware

Implement:

- Helmet
- CORS with configurable allowed origins
- Rate limiting
- Request body limits
- Input validation
- Secure headers
- JWT authentication
- Authorization checks

Use environment variables for configuration.

---

27. Environment Variables

Create a proper ".env.example".

Include variables such as:

NODE_ENV=
PORT=

DATABASE_URL=

JWT_SECRET=
JWT_EXPIRES_IN=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

MAX_FILE_SIZE_MB=

CORS_ORIGIN=

Never commit actual secrets.

---

28. TypeORM Configuration

Use TypeORM DataSource.

Support:

- PostgreSQL
- Neon
- migrations
- entity loading

Production:

synchronize = false

Development may use migrations as well.

Provide scripts:

npm run dev
npm run build
npm run start
npm run migration:generate
npm run migration:run
npm run migration:revert
npm test

---

29. API Response Standardization

Create reusable response helpers.

Success:

{
"success": true,
"message": "...",
"data": {}
}

Failure:

{
"success": false,
"message": "...",
"error": {
"code": "..."
}
}

Keep API responses consistent across controllers.

---

30. Logging

Add structured logging.

Log important events such as:

- registration
- login success/failure
- upload initiation
- upload completion
- upload validation failure
- file deletion
- visibility changes
- unauthorized file access attempts

Never log:

- passwords
- JWT secrets
- Cloudinary API secret
- sensitive tokens

---

31. Testing

Use Jest + Supertest.

Create meaningful tests.

Authentication tests

- successful registration
- duplicate email
- invalid email
- weak password
- successful login
- incorrect password
- missing token
- invalid token
- expired token
- current user endpoint

File tests

- authenticated upload signature
- unauthenticated upload signature
- invalid extension
- invalid MIME type
- oversized file
- successful upload completion
- list own files
- pagination
- get own file
- cannot access another user's private file
- rename own file
- cannot rename another user's file
- delete own file
- cannot delete another user's file

Sharing tests

- generate share token
- public file accessible through share token
- private file inaccessible through share token
- invalid share token
- disable sharing
- old token invalid after disabling sharing

Tests should focus on authorization boundaries, not only happy paths.

---

32. API Documentation

Create a clear API documentation section.

Document:

Authentication:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

Files:

- GET /api/files
- GET /api/files/:id
- POST /api/files/upload-signature
- POST /api/files/complete
- GET /api/files/:id/download
- PATCH /api/files/:id
- PATCH /api/files/:id/visibility
- DELETE /api/files/:id

Sharing:

- POST /api/files/:id/share
- DELETE /api/files/:id/share
- GET /api/share/:shareToken

For every endpoint document:

- authentication requirement
- request body
- query parameters
- response
- status codes
- authorization behavior
- possible errors

---

33. README

Create a professional README containing:

Secure File Storage Service

Overview

Features

Architecture

Technology Stack

Project Structure

Database Schema

Cloudinary Architecture

Authentication Flow

File Upload Flow

Public/Private Authorization Model

API Documentation

Environment Variables

Local Setup

Neon PostgreSQL Setup

Cloudinary Setup

Database Migration

Running the Project

Testing

Security Considerations

Error Handling

Deployment

Future Improvements

Include an ASCII architecture diagram.

---

34. Important Engineering Principles

Throughout implementation:

1. Prefer simple maintainable code over unnecessary abstraction.
2. Do not duplicate business logic.
3. Keep controllers thin.
4. Keep services responsible for business logic.
5. Keep Cloudinary operations isolated.
6. Validate all external input.
7. Never trust frontend ownership information.
8. Never expose secrets.
9. Never store passwords in plaintext.
10. Never load 100+ MB files unnecessarily into Node.js memory.
11. Use pagination.
12. Use database indexes.
13. Use migrations.
14. Handle external-service failures.
15. Write tests for authorization boundaries.
16. Return consistent API responses.
17. Keep configuration environment-driven.
18. Write production-quality TypeScript.
19. Avoid "any" unless genuinely necessary.
20. Use meaningful names and comments only where they add value.

---

35. Do Not Overengineer

Do NOT initially implement:

- microservices
- Redis
- Kafka
- Kubernetes
- unnecessary background workers
- complex event buses
- unnecessary CQRS
- GraphQL

The assignment should remain a clean modular monolithic backend.

The architecture should be scalable without becoming unnecessarily complicated.

---

36. Optional Enhancements

Only implement optional features AFTER the core requirements are complete.

Possible enhancements:

- folders
- search
- sort by filename/date/size
- file type filters
- storage usage summary
- multiple file uploads
- soft delete
- refresh tokens
- audit logs
- Swagger/OpenAPI
- Docker
- antivirus integration
- resumable upload handling

Do not allow optional features to compromise the core assignment.

---

37. Implementation Strategy

Work in phases.

Phase 1 — Foundation

Create:

- package configuration
- TypeScript configuration
- Express application
- environment configuration
- database configuration
- TypeORM DataSource
- error handling
- logging
- basic health endpoint

Health:

GET /api/health

---

Phase 2 — Database

Implement:

- User entity
- File entity
- relationships
- indexes
- migrations

Verify migrations against PostgreSQL/Neon.

---

Phase 3 — Authentication

Implement:

- registration
- password hashing
- login
- JWT
- authentication middleware
- current user
- validation
- tests

---

Phase 4 — Cloudinary

Implement:

- Cloudinary configuration
- Cloudinary service
- signed upload generation
- large/chunked upload-compatible architecture
- deletion
- secure delivery URL handling

---

Phase 5 — File Management

Implement:

- upload signature
- upload completion
- file listing
- pagination
- file details
- rename
- delete
- authorization

---

Phase 6 — Sharing

Implement:

- public/private toggle
- secure share tokens
- public share endpoint
- share disable/invalidation

---

Phase 7 — Security Hardening

Review:

- authentication
- authorization
- MIME validation
- extension validation
- filename validation
- file-size limits
- rate limiting
- CORS
- Helmet
- error leakage
- secret exposure
- ownership checks

---

Phase 8 — Testing

Implement the complete test suite.

Pay special attention to:

User A accessing User B's private file.

This must never succeed.

---

Phase 9 — Documentation

Create:

- README
- API documentation
- architecture diagram
- environment example
- setup instructions
- security notes

---