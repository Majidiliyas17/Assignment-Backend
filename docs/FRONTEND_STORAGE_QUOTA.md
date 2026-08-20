# Frontend Changes — Per-User Storage Quota (500 MB)

This guide lists the changes your **frontend** needs once the backend enforces a per-user
storage quota (default **500 MB**) and exposes usage information.

## 1. What the API now returns

### `GET /api/auth/me` (already called on app load / refresh)

The response `data` now includes a `storage` object alongside the user:

```json
{
  "id": "uuid",
  "name": "Alice",
  "email": "alice@example.com",
  "createdAt": "…",
  "storage": {
    "usedBytes": 0,
    "quotaBytes": 524288000,
    "remainingBytes": 524288000,
    "percentUsed": 0
  }
}
```

### `GET /api/files/usage` (new, auth required)

Same shape as `storage` above. Call it any time you need a fresh number
(especially after a completed upload or a delete).

| Field            | Type   | Meaning                                              |
| ---------------- | ------ | ---------------------------------------------------- |
| `usedBytes`      | number | Total bytes currently stored (completed files)       |
| `quotaBytes`     | number | User's total allowance in bytes (526 288 000 = 500 MB) |
| `remainingBytes` | number | How much the user can still upload                   |
| `percentUsed`    | number | `0–100`, ready to feed a progress bar                |

> All values are plain byte counts — format them client side (KB/MB/GB).

## 2. Mandatory frontend changes

### 2.1 Types / TS interfaces

Add a `StorageUsage` type and extend the user type:

```ts
export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  percentUsed: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  storage: StorageUsage; // now always present from /auth/me
}
```

### 2.2 Formatting helper

```ts
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
```

Example label: `"120.5 MB / 500 MB used"`.

### 2.3 Storage indicator (sidebar / header / dashboard)

Read `storage` from the `/auth/me` response (or `GET /api/files/usage`) and render a bar:

```tsx
// storage-used from user.storage
const pct = Math.min(100, user.storage.percentUsed);
const label = `${formatBytes(user.storage.usedBytes)} used · ${formatBytes(user.storage.remainingBytes)} left`;
```

- Show a warning style when `percentUsed >= 80`.
- When `remainingBytes === 0` (or `percentUsed === 100`), disable uploads entirely.

### 2.4 Block uploads before calling `/files/upload-signature`

Before requesting an upload signature, check the **selected file's size** against the
last-known quota, and show the error immediately (don't wait for the API):

```ts
const fileSize = file.size; // from the <input type="file"> File object
if (fileSize > user.storage.remainingBytes) {
  // Toast: `Not enough storage. Only ${formatBytes(user.storage.remainingBytes)} left.`
  return;
}
```

Also keep the existing per-file limit (`MAX_FILE_SIZE_MB` = 500 MB) and Cloudinary's
100 MB single-upload limit in mind — the backend still enforces both.

### 2.5 Handle the new error code

The backend now rejects uploads that exceed the quota:

- `POST /api/files/upload-signature` → `413 STORAGE_QUOTA_EXCEEDED`
- `POST /api/files/complete` → `413 STORAGE_QUOTA_EXCEEDED`

Map this code to a friendly message and refresh usage afterwards:

```ts
// in your API error interceptor / upload catch block
if (error.error?.code === 'STORAGE_QUOTA_EXCEEDED') {
  // Trigger "refresh usage", show: "Quota exceeded — `<file name>` not uploaded."
}

// after ANY successful complete or delete:
refreshStorageUsage(); // calls GET /api/files/usage, updates user.storage
```

### 2.6 Refresh usage after mutations

Keep the storage bar accurate by re-fetching usage after:

- a successful `POST /api/files/complete`,
- any `DELETE /api/files/:id`,
- a failed upload (quota was hit by another device/session),

reusing `GET /api/files/usage` and updating your store/context.

## 3. Suggested UX copy

| Situation                        | Message                                |
| -------------------------------- | -------------------------------------- |
| User close to the limit (≥80%)   | `"You've used 82% of your storage"`    |
| User hits the limit              | `"Storage full — delete files to upload more"` |
| Upload rejected by quota         | `"Not enough storage (X left)"`        |
| After deleting a big file        | `"Freed X — usable now"`               |

## 4. Acceptance checklist

- [ ] `storage` is rendered from `/auth/me` on app load.
- [ ] Upload button disabled when `remainingBytes === 0`.
- [ ] Pre-signature size check blocks clearly oversized files without an API call.
- [ ] `STORAGE_QUOTA_EXCEEDED` (`413`) shows a friendly toast and is never treated as a generic error.
- [ ] Usage bar updates after every complete-upload and delete.