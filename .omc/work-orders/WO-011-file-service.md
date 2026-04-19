# Work Order — File Service
**Wave:** 2
**Session ID:** WO-011
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service)
**Branch name:** `wave2/file-service`
**Estimated time:** 2 hours

---

## 1. Mission

The File Service owns all file storage for the platform. It handles multipart
file uploads, stores binary objects in MinIO (S3-compatible), records file
metadata in PostgreSQL, and generates short-lived pre-signed download URLs.
It enforces size and MIME-type policy at the boundary so no other service
ever needs to re-validate file constraints. It publishes events when files are
uploaded or deleted so downstream services (e.g. notifications, activity feed)
can react without polling.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → file-service (:3005)
      → PostgreSQL   (table: files — metadata only)
      → MinIO        (:9000, bucket: clickup-files — binary objects)
      ↘ NATS publishes:
          file.uploaded
          file.deleted
      → identity-service (:3001, HTTP): verify workspace membership
```

MinIO is already running in docker-compose. The `files` table already exists in
the database. Do NOT create migrations or alter the schema.

---

## 3. Repository Setup

```bash
cp -r services/_template services/file-service
cd services/file-service

# In package.json change:
# "name": "@clickup/file-service"

cp .env.example .env
# Edit: SERVICE_NAME=file-service
# Edit: PORT=3005
```

---

## 4. Files to Create

```
services/file-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=file-service, PORT=3005]
│   ├── routes.ts                       [register all file routes]
│   └── files/
│       ├── files.handler.ts            [HTTP handlers — multer, validation, orchestration]
│       ├── files.repository.ts         [DB queries only — no business logic]
│       └── minio.client.ts             [MinIO/S3 client wrapper]
├── tests/
│   └── unit/
│       └── files.handler.test.ts       [unit tests with mocked repository + MinIO client]
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 5. Imports

```typescript
// From @clickup/contracts (READ ONLY — never modify this package)
import {
  FILE_EVENTS,          // UPLOADED, DELETED
  FileUploadedEvent,    // event payload interface
  ErrorCode,            // FILE_NOT_FOUND, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED, AUTH_WORKSPACE_ACCESS_DENIED
  File,                 // entity return type
} from '@clickup/contracts'

// From @clickup/sdk (READ ONLY — never modify this package)
import {
  requireAuth,          // Express middleware: populates req.auth, throws 401 on failure
  asyncHandler,         // wraps async route handlers, forwards thrown errors to next()
  AppError,             // only way to throw domain errors — never throw raw Error
  publish,              // publish a NATS event
  logger,               // structured logger — never use console.log
  createServiceClient,  // create typed HTTP client for service-to-service calls
} from '@clickup/sdk'
```

---

## 6. Database Tables

| Table | Access | Notes |
|-------|--------|-------|
| `files` | READ + WRITE | Primary table. Never expose raw `url` column — always return a pre-signed URL |
| `users` | READ ONLY | Verify `uploaded_by` exists (use `req.auth.userId`, no extra query needed) |
| `workspaces` | READ ONLY | Foreign key already enforced by DB — no extra validation needed |
| `tasks` | READ ONLY | Foreign key already enforced by DB — pass `taskId` directly, no validation query |

### Schema reference (DO NOT recreate — table already exists)

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,             -- internal MinIO path, NOT returned to clients
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Repository method signatures (implement exactly these)

```typescript
// files.repository.ts

export async function insertFile(db: Pool, record: {
  id: string
  workspaceId: string
  taskId: string | null
  name: string
  url: string           // internal MinIO URL stored in DB
  sizeBytes: number
  mimeType: string
  uploadedBy: string
}): Promise<File>

export async function getFileById(db: Pool, fileId: string): Promise<File | null>

export async function listFilesByTaskId(db: Pool, taskId: string): Promise<File[]>

export async function deleteFileById(db: Pool, fileId: string): Promise<void>
```

All SQL lives exclusively in `files.repository.ts`. No SQL in handler files.

---

## 7. MinIO Client (minio.client.ts)

Implement this file exactly as specified. Do not deviate from the interface.

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export function createMinioClient(): S3Client {
  return new S3Client({
    endpoint: process.env['MINIO_ENDPOINT'] ?? 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env['MINIO_ACCESS_KEY'] ?? 'minioadmin',
      secretAccessKey: process.env['MINIO_SECRET_KEY'] ?? 'minioadmin',
    },
    forcePathStyle: true,  // required for MinIO path-style addressing
  })
}

const BUCKET = process.env['MINIO_BUCKET'] ?? 'clickup-files'

export async function uploadToMinio(
  client: S3Client,
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
  return `${process.env['MINIO_ENDPOINT'] ?? 'http://localhost:9000'}/${BUCKET}/${key}`
}

export async function deleteFromMinio(client: S3Client, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getPresignedUrl(
  client: S3Client,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  )
}
```

### Deriving the MinIO key from a stored URL

When you retrieve a file from DB, the `url` column contains the full internal
MinIO URL (`http://localhost:9000/clickup-files/{workspaceId}/{fileId}/{name}`).
Extract the key by stripping the bucket prefix:

```typescript
// key is everything after `/{BUCKET}/`
const key = storedUrl.split(`/${BUCKET}/`)[1]
```

---

## 8. Multer Configuration

Configure multer with memory storage and a 50 MB size limit. Define this in
`files.handler.ts` — not in a separate middleware file.

```typescript
import multer from 'multer'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB hard limit at parse layer
})
```

Allowed MIME types (enforce in handler after multer parses, before MinIO):

```typescript
const ALLOWED_MIME_PREFIXES = ['image/', 'text/']
const ALLOWED_MIME_EXACT = ['application/pdf', 'application/zip']

function isAllowedMimeType(mimeType: string): boolean {
  return (
    ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
    ALLOWED_MIME_EXACT.includes(mimeType)
  )
}
```

---

## 9. API Endpoints

### 9.1 Upload File

```
POST /api/v1/files
Auth: requireAuth
Content-Type: multipart/form-data
Fields:
  file        (required) — the binary file
  workspaceId (required) — UUID string in form body
  taskId      (optional) — UUID string in form body
```

**Handler logic (strict order):**

```typescript
// 1. Multer parses multipart — attach upload.single('file') middleware
// 2. requireAuth validates JWT token
// 3. Validate workspaceId is present and is a valid UUID — throw VALIDATION_INVALID_INPUT if not
// 4. Validate file was provided (req.file exists) — throw VALIDATION_INVALID_INPUT if not
// 5. Check file size: if req.file.size > 50 * 1024 * 1024 → throw AppError(ErrorCode.FILE_TOO_LARGE)
//    (multer limit may reject it first at the transport layer — still add this guard)
// 6. Check MIME type using isAllowedMimeType() — throw AppError(ErrorCode.FILE_TYPE_NOT_ALLOWED)
// 7. Verify workspace membership via identity-service (see Section 11)
// 8. Generate fileId = crypto.randomUUID()
// 9. Compute MinIO key: `${workspaceId}/${fileId}/${req.file.originalname}`
// 10. Upload to MinIO: url = await uploadToMinio(minioClient, key, req.file.buffer, req.file.mimetype)
// 11. Insert record into DB: await insertFile(db, { id: fileId, workspaceId, taskId, name, url, sizeBytes, mimeType, uploadedBy: req.auth.userId })
// 12. Publish FILE_EVENTS.UPLOADED (AFTER both MinIO write and DB write)
// 13. Return HTTP 201 with { data: file }
```

**Success** `HTTP 201`:
```json
{ "data": { /* File entity — url field replaced with pre-signed URL */ } }
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| `workspaceId` missing or invalid UUID | `ErrorCode.VALIDATION_INVALID_INPUT` |
| `file` field absent from form | `ErrorCode.VALIDATION_INVALID_INPUT` |
| File exceeds 50 MB | `ErrorCode.FILE_TOO_LARGE` |
| MIME type not in allowed list | `ErrorCode.FILE_TYPE_NOT_ALLOWED` |
| User not a member of workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 9.2 Get File Metadata + Pre-signed Download URL

```
GET /api/v1/files/:fileId
Auth: requireAuth
```

**Handler logic (strict order):**

```typescript
// 1. requireAuth
// 2. Look up file by fileId — throw AppError(ErrorCode.FILE_NOT_FOUND) if null
// 3. Verify workspace membership for file.workspaceId via identity-service
// 4. Derive MinIO key from file.url (see Section 7)
// 5. Generate pre-signed URL: await getPresignedUrl(minioClient, key, 3600)  // 60 min
// 6. Return file metadata with url replaced by the pre-signed URL
```

**Success** `HTTP 200`:
```json
{
  "data": {
    "id": "...",
    "workspaceId": "...",
    "taskId": "...",
    "name": "report.pdf",
    "url": "http://localhost:9000/clickup-files/.../report.pdf?X-Amz-Signature=...",
    "sizeBytes": 204800,
    "mimeType": "application/pdf",
    "uploadedBy": "...",
    "createdAt": "2026-04-19T10:00:00.000Z"
  }
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| File not found | `ErrorCode.FILE_NOT_FOUND` |
| User not a member of workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 9.3 Delete File

```
DELETE /api/v1/files/:fileId
Auth: requireAuth
```

**Authorization rule:** Only the original uploader (`file.uploadedBy === req.auth.userId`)
OR a workspace owner/admin may delete. Fetch the workspace member record from
identity-service (same call as workspace verification). Check the `role` field
on the returned member object:

```typescript
const { data: member } = await identityClient.get(
  `/api/v1/workspaces/${file.workspaceId}/members/${req.auth.userId}`
)
if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

const canDelete =
  file.uploadedBy === req.auth.userId ||
  member.role === 'owner' ||
  member.role === 'admin'

if (!canDelete) throw new AppError(ErrorCode.AUTH_FORBIDDEN)
```

**Handler logic (strict order):**

```typescript
// 1. requireAuth
// 2. Look up file by fileId — throw AppError(ErrorCode.FILE_NOT_FOUND) if null
// 3. Verify membership + role as shown above
// 4. Derive MinIO key from file.url
// 5. Delete from MinIO first: await deleteFromMinio(minioClient, key)
// 6. Delete from DB: await deleteFileById(db, fileId)
// 7. Publish FILE_EVENTS.DELETED (AFTER both deletes)
// 8. Return HTTP 204 with no body
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| File not found | `ErrorCode.FILE_NOT_FOUND` |
| User not a member of workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| User is member but lacks uploader/admin role | `ErrorCode.AUTH_FORBIDDEN` |

---

### 9.4 List Files for a Task

```
GET /api/v1/tasks/:taskId/files
Auth: requireAuth
```

**Handler logic (strict order):**

```typescript
// 1. requireAuth
// 2. Fetch all files where task_id = taskId
// 3. If results are empty, return { data: [] } immediately (no workspace check needed)
// 4. If results are non-empty, verify workspace membership for files[0].workspaceId
// 5. For each file, generate a pre-signed URL (60 min) replacing the stored url
// 6. Return HTTP 200 with { data: File[] }
```

**Success** `HTTP 200`:
```json
{ "data": [ /* File[] — each url is a pre-signed URL */ ] }
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| User not a member of workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

## 10. Events to Publish

Publish events AFTER all storage writes are complete. Never publish inside a
database transaction or before MinIO confirms the write.

### 10.1 file.uploaded

```typescript
await publish(FILE_EVENTS.UPLOADED, {
  fileId: file.id,
  workspaceId: file.workspaceId,
  taskId: file.taskId ?? null,
  name: file.name,
  sizeBytes: file.sizeBytes,
  mimeType: file.mimeType,
  uploadedBy: file.uploadedBy,
  occurredAt: new Date().toISOString(),
} satisfies FileUploadedEvent)
```

### 10.2 file.deleted

```typescript
await publish(FILE_EVENTS.DELETED, {
  fileId: file.id,
  workspaceId: file.workspaceId,
  taskId: file.taskId ?? null,
  deletedBy: req.auth.userId,
  occurredAt: new Date().toISOString(),
})
```

### Event publishing table

| Trigger | NATS Subject | Payload Type |
|---------|-------------|--------------|
| Successful upload (MinIO + DB complete) | `FILE_EVENTS.UPLOADED` | `FileUploadedEvent` |
| Successful delete (MinIO + DB complete) | `FILE_EVENTS.DELETED` | (inline shape, see above) |

---

## 11. Service-to-Service Calls

```typescript
// Instantiate once per request (or inject via dependency) — do not create globally
const identityClient = createServiceClient(
  process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  { traceId: req.headers['x-trace-id'] as string }
)

// Verify workspace membership before any operation that needs it
const { data: member } = await identityClient.get(
  `/api/v1/workspaces/${workspaceId}/members/${req.auth.userId}`
)
if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
```

Pass the `x-trace-id` header from the incoming request through to downstream
service calls so traces are correlated across services.

---

## 12. Environment Variables (.env.example)

```
# Service identity
SERVICE_NAME=file-service
PORT=3005

# PostgreSQL (same cluster as other services)
DATABASE_URL=postgresql://clickup:clickup@localhost:5432/clickup

# NATS
NATS_URL=nats://localhost:4222

# MinIO object storage
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=clickup-files

# Downstream services
IDENTITY_SERVICE_URL=http://localhost:3001
```

---

## 13. package.json — Additional Dependencies

Add the following to `dependencies` in the service's `package.json`
(copy the template's existing dependencies first, then append these):

```json
{
  "@aws-sdk/client-s3": "^3.0.0",
  "@aws-sdk/s3-request-presigner": "^3.0.0",
  "multer": "^1.4.5-lts.1"
}
```

Add to `devDependencies`:

```json
{
  "@types/multer": "^1.4.11"
}
```

---

## 14. Mandatory Tests

All tests live in `tests/unit/files.handler.test.ts`. Mock `files.repository.ts`
and all functions from `minio.client.ts`. Do not spin up a real DB or MinIO
instance for unit tests.

### Test checklist

```
□ uploadFile: returns 201 with file entity when all inputs are valid
□ uploadFile: throws FILE_TOO_LARGE when req.file.size > 50 * 1024 * 1024
□ uploadFile: throws FILE_TYPE_NOT_ALLOWED for mime type 'application/exe'
□ uploadFile: throws FILE_TYPE_NOT_ALLOWED for mime type 'video/mp4'
□ uploadFile: accepts mime type 'image/png'
□ uploadFile: accepts mime type 'image/jpeg'
□ uploadFile: accepts mime type 'application/pdf'
□ uploadFile: accepts mime type 'text/plain'
□ uploadFile: accepts mime type 'application/zip'
□ uploadFile: throws VALIDATION_INVALID_INPUT when workspaceId is missing
□ uploadFile: throws VALIDATION_INVALID_INPUT when file field is absent
□ uploadFile: throws AUTH_WORKSPACE_ACCESS_DENIED when identity-service returns no member
□ uploadFile: calls uploadToMinio BEFORE insertFile (order matters)
□ uploadFile: publishes FILE_EVENTS.UPLOADED AFTER insertFile completes
□ uploadFile: does NOT publish event if insertFile throws
□ getFile: returns 200 with pre-signed URL replacing stored url
□ getFile: throws FILE_NOT_FOUND when repository returns null
□ getFile: throws AUTH_WORKSPACE_ACCESS_DENIED when user is not a workspace member
□ deleteFile: returns 204 when uploader deletes their own file
□ deleteFile: returns 204 when workspace admin deletes any file
□ deleteFile: throws AUTH_FORBIDDEN when non-uploader member with role 'member' attempts delete
□ deleteFile: throws FILE_NOT_FOUND when file does not exist
□ deleteFile: calls deleteFromMinio BEFORE deleteFileById (order matters — storage first)
□ deleteFile: publishes FILE_EVENTS.DELETED AFTER both deletes complete
□ deleteFile: does NOT publish event if deleteFromMinio throws
□ listFilesByTask: returns 200 with empty array when no files exist (no identity call made)
□ listFilesByTask: returns 200 with pre-signed URLs for each file
□ listFilesByTask: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
```

---

## 15. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests in the mandatory checklist pass
□ GET /health returns HTTP 200 with postgres "ok" (NATS and MinIO status optional but recommended)
□ File upload end-to-end: POST → MinIO object exists → DB row inserted → event published
□ File download: GET /files/:id → pre-signed URL returned → URL resolves the binary
□ File delete: DELETE /files/:id → MinIO object removed → DB row deleted → event published
□ List files: GET /tasks/:taskId/files → correct files returned with pre-signed URLs
□ Events published AFTER storage write + DB write — never before
□ No console.log anywhere in src/ — use logger only
□ No raw Error thrown — only AppError(ErrorCode.X)
□ No SQL in files.handler.ts — all queries in files.repository.ts
□ packages/contracts and packages/sdk are unchanged (read-only)
□ .env is NOT committed (only .env.example)
□ PR description: "File Service — multipart upload, MinIO storage, pre-signed URLs, and file lifecycle events"
```

---

## 16. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or run migrations — the files table already exists
✗ Do NOT store file binaries in PostgreSQL — all binary data lives in MinIO only
✗ Do NOT return the raw internal MinIO URL to API clients — always return a pre-signed URL
✗ Do NOT implement streaming upload — use multer memory storage (max 50 MB enforced)
✗ Do NOT implement image resizing, thumbnails, or virus scanning in this wave
✗ Do NOT implement pagination on the task file list in this wave — return all records
✗ Do NOT use console.log — use logger from @clickup/sdk
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X)
✗ Do NOT write SQL outside files.repository.ts
✗ Do NOT commit the .env file
✗ Do NOT create a MinIO bucket programmatically — the bucket is pre-created by docker-compose
```
