# Frontend Implementation Guide (Next.js)

How to build a **production-grade, enterprise-looking** UI on top of the Secure File Storage backend using **Next.js (App Router) + TypeScript**. Covers the full API surface, the (tricky) signed-upload flow, and the design system needed for a modern, premium look.

> Backend base URL (dev): `http://localhost:4000/api` — set once in a Next.js env var.

---

## Table of Contents

- [1. Recommended Stack](#1-recommended-stack)
- [2. Design System (Enterprise Look)](#2-design-system-enterprise-look)
- [3. Project Structure](#3-project-structure)
- [4. Auth & API Setup (Next.js pattern)](#4-auth--api-setup-nextjs-pattern)
- [5. All Endpoints (with code)](#5-all-endpoints-with-code)
- [6. File Upload Flow (critical)](#6-file-upload-flow-critical)
- [7. Pages & UI Breakdown](#7-pages--ui-breakdown)
- [8. State & Data Fetching](#8-state--data-fetching)
- [9. Error / Loading / Empty States](#9-error--loading--empty-states)
- [10. UX Polish (Modern Touches)](#10-ux-polish-modern-touches)
- [11. Responsive & Accessibility](#11-responsive--accessibility)
- [12. Frontend `.env`](#12-frontend-env)
- [13. Checklist](#13-checklist)

---

## 1. Recommended Stack

| Concern          | Choice (recommended)                          | Why                                                          |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Framework        | **Next.js 15 (App Router) + TypeScript**      | SSR/SSG for the public page, routing, middleware              |
| Styling          | **Tailwind CSS** + CSS variables              | Speed + a design-token system for the enterprise look         |
| UI kit           | **shadcn/ui** (or Headless UI + Radix)        | Accessible primitives, easy to make custom/premium            |
| Server state     | **TanStack Query** (client components)        | Caching, retries, optimistic updates                          |
| Client state     | **Zustand** (small)                           | UI prefs only (auth lives in an httpOnly cookie — see §4)     |
| HTTP             | **Axios** (client) + **fetch** (server)       | Interceptors client-side; `cookies()` on the server           |
| File uploads     | **XMLHttpRequest** (for progress)             | `fetch` has no upload-progress event                          |
| Tables           | **TanStack Table** (optional)                 | Sorting/filtering for the files grid                          |
| Icons            | **lucide-react**                              | Clean, modern line icons                                      |
| Toasts           | **sonner** (or react-hot-toast)               | Smooth notifications                                          |
| Forms            | **react-hook-form + zod**                     | Matches backend zod validation, shared error display          |
| Motion           | **framer-motion** (optional, subtle only)     | Micro-interactions                                            |

---

## 2. Design System (Enterprise Look)

"Enterprise" does **not** mean grey and boring — it means **clean, consistent, calm, and premium**. Think Linear, Notion, Stripe.

### 2.1 Visual principles

- **Whitespace first** — generous padding (`p-6`/`p-8`), max-width content `max-w-7xl`.
- **A restrained color palette** — 1 primary + neutrals + semantic colors. Never neon.
- **Consistent radius + shadow scale** — every card/button follows the same tokens.
- **Subtle borders** — `border border-zinc-200` (not heavy shadows) for cards.
- **One accent per screen** — primary buttons carry color; everything else is neutral.
- **Skeletons, not spinners** — for lists/tables; spinners only for inline actions.
- **Micro-interactions** — 150ms ease transitions on hover/focus, no bouncy animations.

### 2.2 Color tokens (Tailwind + CSS variables)

```css
/* src/app/globals.css */
:root {
  --primary: #4f46e5;          /* indigo-600 — enterprise-friendly */
  --primary-hover: #4338ca;
  --primary-soft: #eef2ff;     /* backgrounds for active rows/chips */
  --bg: #ffffff;
  --surface: #fafafa;          /* page background */
  --card: #ffffff;
  --border: #e4e4e7;
  --text: #18181b;
  --text-muted: #71717a;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --focus-ring: rgba(79, 70, 229, 0.35);
}
```

### 2.3 Typography

- Font stack: **Inter** (body) + **Inter** or Space Grotesk for headings. Load via `next/font` (no external CDN).
- Scale: `text-xs` (labels/caption) · `text-sm` (body/default) · `text-base` · `text-xl` (page title) · `text-2xl` (auth title).
- Headings: `font-semibold tracking-tight`. Body: `text-sm text-zinc-600`.

### 2.4 Reusable primitives (build once in `components/ui`)

| Component   | Rules                                                             |
| ----------- | ----------------------------------------------------------------- |
| `Button`    | variants: `primary`, `secondary`, `ghost`, `danger`, `outline`; sizes sm/md/lg; loading state (spinner + `disabled`) |
| `Input`     | 1px border, focus ring `--focus-ring`, error state `border-red-500` + message |
| `Card`      | `rounded-xl border border-zinc-200 bg-white`, `shadow-sm` on hover |
| `Badge`     | visibility/status chips: Private `zinc`, Public `emerald`, Pending `amber` |
| `Toast`     | success (check), error (x), info; auto-dismiss 3–4s                |
| `Modal/Dialog` | centered, scrim `bg-black/40`, ESC to close, focus trap        |
| `Skeleton`  | shimmer block for tables/cards while loading                      |
| `EmptyState`| centered icon + title + description + CTA button                  |
| `Table`     | sticky header, hover row highlight, right-aligned numeric columns  |
| `FileTypeIcon` | icon per extension: image, video, pdf, doc, zip, generic       |

---

## 3. Project Structure

```text
frontend/
├── next.config.ts
├── middleware.ts                  # route protection (checks token cookie)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # root layout (fonts + QueryProvider + Toaster)
│   │   ├── globals.css            # design tokens
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         # AppShell (sidebar + topbar)
│   │   │   └── files/page.tsx     # client dashboard (files table)
│   │   ├── s/[shareToken]/page.tsx  # PUBLIC shared-file page (Server Component)
│   │   └── api/
│   │       ├── auth/login/route.ts    # proxy → backend, sets httpOnly cookie
│   │       ├── auth/register/route.ts
│   │       ├── auth/logout/route.ts   # clears cookie
│   │       └── [...path]/route.ts     # generic proxy → backend (files, share, me…)
│   ├── lib/
│   │   ├── backend.ts             # server-side fetch helper (reads cookie)
│   │   ├── http.ts                # axios instance → same-origin /api proxy
│   │   └── format.ts              # formatBytes, formatDate, isImage…
│   ├── hooks/                     # useAuth, useFiles, useUpload…
│   ├── stores/                    # ui store (zustand) — auth NOT here (cookie)
│   ├── components/
│   │   ├── ui/                    # Button, Input, Modal, Badge…
│   │   ├── layout/                # AppShell, Sidebar, Topbar, UserMenu
│   │   ├── files/                 # FilesTable, FileRow, UploadDialog…
│   │   └── share/                 # ShareDialog, PublicFileView, ShareNotFound
│   └── types/api.ts               # FileView, PaginatedFiles, AuthResult…
└── .env                           # BACKEND_URL (+ NEXT_PUBLIC_APP_NAME)
```

---

## 4. Auth & API Setup (Next.js pattern)

**Enterprise pattern used here: the JWT lives in an `httpOnly` cookie — it never touches JavaScript.** The browser talks only to the Next.js app (same origin). Next.js forwards requests to the backend and injects `Authorization: Bearer <token>` from the cookie. This removes the XSS risk of storing tokens in `localStorage`.

```
Browser ── POST /api/auth/login ──▶ Next Route Handler ──▶ backend /auth/login
Browser ◀── 200 + set-cookie: sfs_token (httpOnly) ◀──  (token hidden from JS)

Browser ── GET /api/files ──▶ Next catch-all proxy ──▶ backend /files (Bearer from cookie)
Browser ── GET /s/:token ──▶ Server Component ──▶ backend /share/:token (public)
```

### 4.1 Types (mirror the backend)

```ts
// src/types/api.ts
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}

export type FileVisibility = 'private' | 'public';
export type FileStatus = 'pending' | 'completed' | 'failed';
export type ResourceType = 'auto' | 'image' | 'video' | 'raw';

export interface FileView {
  id: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  visibility: FileVisibility;
  status: FileStatus;
  resourceType: ResourceType;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedFiles {
  files: FileView[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface UploadSignature {
  storageId: string;
  signature: string;
  timestamp: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  resourceType: ResourceType;
}
```

### 4.2 Login route handler (sets the httpOnly cookie)

```ts
// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${process.env.BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();

  if (!res.ok) return NextResponse.json(json, { status: res.status });

  const response = NextResponse.json(json);
  response.cookies.set('sfs_token', json.data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24, // match JWT_EXPIRES_IN=1d
  });
  return response;
}
```

`register` is identical (different backend path). `logout` clears the cookie:

```ts
// src/app/api/auth/logout/route.ts
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('sfs_token', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
```

### 4.3 Catch-all proxy (files, me, share…)

```ts
// src/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000/api';

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const token = (await cookies()).get('sfs_token')?.value;
  const target = `${BACKEND}/${path.join('/')}${url.search}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }

  const res = await fetch(target, init);
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
```

> `auth/login`, `auth/register`, `auth/logout` have their own more-specific handlers, so they bypass the proxy. Everything else (`/files`, `/share`, `/auth/me`) flows through it.

### 4.4 Middleware (route protection)

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/s/'];

export function middleware(req: NextRequest) {
  const token = req.cookies.get('sfs_token')?.value;
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (!token && !isPublic) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

### 4.5 Client axios instance (same origin — no token in JS)

```ts
// src/lib/http.ts
import axios from 'axios';

export const http = axios.create({
  baseURL: '/api', // Next route handlers — token is injected server-side
  timeout: 30_000,
});

// 401 from any API → clear session (cookie) and go to /login
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      void fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = '/login';
      });
    }
    return Promise.reject(err);
  },
);
```

### 4.6 Server-side fetch helper (Server Components)

```ts
// src/lib/backend.ts
import 'server-only';
import { cookies } from 'next/headers';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get('sfs_token')?.value;
  const res = await fetch(`${BACKEND}${path}`, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'UNKNOWN', json?.message);
  return json.data as T;
}
```

### 4.7 Auth hooks

```ts
// src/hooks/useAuth.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../lib/http';
import type { AuthResult, SafeUser } from '../types/api';

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      http.post<{ data: AuthResult }>('/auth/login', body).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) =>
      http.post<{ data: AuthResult }>('/auth/register', body).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => http.get<{ data: SafeUser }>('/auth/me').then((r) => r.data.data),
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http.post('/auth/logout'),
    onSuccess: async () => {
      qc.clear();
      window.location.href = '/login';
    },
  });
}
```

---

## 5. All Endpoints (with code)

All authenticated calls go through the same-origin proxy (`/api/...`). The public share page calls the backend directly from a Server Component.

### 5.1 `POST /auth/register` & `POST /auth/login`

**UI:** `login/page.tsx` and `register/page.tsx` (client components) — full-screen centered card, brand mark on top, zod client validation mirroring backend rules:

- `name`: 2–120 chars
- `email`: valid format
- `password`: 8–72 chars, must contain upper + lower + digit + special

On `EMAIL_ALREADY_REGISTERED` show an inline error on the email field. On login `INVALID_CREDENTIALS` show **"Invalid email or password."** (don't reveal which was wrong). After success, `useRouter().push('/files')`.

### 5.2 `GET /auth/me`

Used by `useMe()` in the dashboard layout to render the user card. While pending, show a branded splash/skeleton.

### 5.3 `GET /health`

Not user-facing; optionally a dev "API connected" indicator.

---

### 5.4 `GET /files?page=&limit=` — list

**Client (proxy):**

```ts
// src/lib/files-api.ts
import { http } from './http';
import type { FileView, PaginatedFiles } from '../types/api';

export const filesApi = {
  list: (params: { page?: number; limit?: number } = {}) =>
    http.get<{ data: PaginatedFiles }>('/files', { params: { page: 1, limit: 20, ...params } }).then((r) => r.data.data),
  get: (id: string) => http.get<{ data: FileView }>(`/files/${id}`).then((r) => r.data.data),
  rename: (id: string, name: string) =>
    http.patch<{ data: FileView }>(`/files/${id}`, { name }).then((r) => r.data.data),
  remove: (id: string) => http.delete<{ data: null }>(`/files/${id}`).then((r) => r.data.data),
  download: (id: string) =>
    http.get<{ data: { url: string } }>(`/files/${id}/download`).then((r) => r.data.data.url),
};
```

**UI — the Files Dashboard (the centerpiece):**

- **Layout:** left sidebar (logo, nav: My Files / Settings, user card at bottom) + main content area with top bar (page title, search input, **Upload** primary button).
- **Toolbar:** search box (client-side filter), visibility filter chips (`All / Private / Public`), refresh button.
- **Table columns:** File (icon + name) · Type · Size · Status · Visibility · Shared (link icon) · Modified · Actions.
- **Row actions (kebab menu):** Info, Download, Rename, Share, Make private/public, Delete.
- **Pagination footer:** `Showing 1–20 of 57` + Previous/Next + page indicator.
- **Empty state:** friendly icon + "No files yet" + "Upload your first file" CTA.

> Use `serverSideSearchParams` (or client state) for page/filters; `keepPreviousData: true` in TanStack Query so pagination doesn't flash.

### 5.5 `GET /files/:id`

**UI:** optional detail drawer/panel — image preview via the download URL, metadata grid (name, size, type, uploaded date), visibility control, share section, danger zone (delete).

### 5.6 `PATCH /files/:id` — rename

**UI:** small modal with one input or inline editing; optimistic update + rollback on error.

### 5.7 `DELETE /files/:id`

**UI:** confirmation dialog ("Delete 'report.pdf'? This removes the file from storage. This action can't be undone.") with `danger` button + loading; on success remove from cache + toast "File deleted".

### 5.8 `GET /files/:id/download`

**UI:** `window.open(url, '_blank')` (or an `<a href>`). The URL is a secure Cloudinary delivery URL — usable directly as `<img src>` for images (lazy-generate on demand).

### 5.9 `PATCH /files/:id/visibility` — set public/private

**UI:** toggle in row menu / detail drawer. When switching to public, prompt: *"This creates a link anyone with the link can view."* Confirm before switching to private (it revokes the share link).

### 5.10 `POST /files/:id/share` & `DELETE /files/:id/share`

```ts
export const shareApi = {
  create: (id: string) =>
    http.post<{ data: ShareResult }>(`/files/${id}/share`).then((r) => r.data.data),
  revoke: (id: string) =>
    http.delete<{ data: FileView }>(`/files/${id}/share`).then((r) => r.data.data),
};

export interface ShareResult {
  file: FileView;
  shareToken: string;
  shareUrl: string;
}
```

**UI — ShareDialog:** click "Share" → calls `create`; shows a read-only input with `shareUrl` + **Copy** button (`navigator.clipboard`); options **"Open link"** and **"Revoke link"** (danger, calls `revoke`, toast "Link revoked"). Toast "Link copied to clipboard" after copy.

> The share URL the backend returns points at the **backend** (`/api/share/<token>`). If you want users to land on your **Next.js public page** instead (`/s/<token>`), swap the host: `shareUrl.replace(/\/api\/share\//, '/s/')` → the `/s/:token` page renders the same data from the public endpoint (see 5.11).

### 5.11 `GET /share/:shareToken` — public access

**Next.js Server Component (no auth, no proxy needed):**

```tsx
// src/app/s/[shareToken]/page.tsx
import { apiGet, ApiError } from '@/lib/backend';
import { PublicFileView } from '@/components/share/PublicFileView';
import { ShareNotFound } from '@/components/share/ShareNotFound';

export default async function SharedFilePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  try {
    const data = await apiGet<{ file: FileView; downloadUrl: string }>(`/share/${shareToken}`);
    return <PublicFileView file={data.file} downloadUrl={data.downloadUrl} />;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'SHARE_NOT_FOUND') return <ShareNotFound />;
    throw err;
  }
}
```

**UI — public "file receipt" page:** no nav/sidebar, centered card with a large file-type icon, filename, size + modified date, and a **Download** primary button (`<a href={downloadUrl} target="_blank">`). On `SHARE_NOT_FOUND`: styled 404 — *"This link is no longer available"* + button back to your site.

---

## 6. File Upload Flow (critical)

The backend **never buffers the file**. Flow:

```
1. Client POST /api/files/upload-signature  → { signature, timestamp, apiKey, cloudName, publicId, resourceType, folder, storageId }
2. Client uploads the File DIRECTLY to Cloudinary (browser → api.cloudinary.com):
   POST https://api.cloudinary.com/v1_1/{cloudName}/{resourceType}/upload
   FormData: file, public_id, timestamp, api_key, signature
3. Client POST /api/files/complete with the Cloudinary-returned public_id
   → backend verifies asset + creates the file record
```

**Gotchas learned from the backend:**
- Use the **Cloudinary-returned `public_id`** for step 3 (Cloudinary may append the format, e.g. `….txt`).
- `resource_type` goes in the **URL path** for the upload, not the signature.
- The response contains `bytes` (actual size) and `public_id` (final).

### 6.1 Upload with real progress (XMLHttpRequest)

```ts
// src/lib/upload.ts
export type UploadProgress = (percent: number) => void;

export async function uploadToCloudinary(
  params: { cloudName: string; resourceType: string; publicId: string; timestamp: string; apiKey: string; signature: string },
  file: File,
  onProgress: UploadProgress,
): Promise<{ public_id: string; bytes: number }> {
  const url = `https://api.cloudinary.com/v1_1/${params.cloudName}/${params.resourceType}/upload`;

  const body = new FormData();
  body.append('file', file);
  body.append('public_id', params.publicId);
  body.append('timestamp', params.timestamp);
  body.append('api_key', params.apiKey);
  body.append('signature', params.signature);
  body.append('resource_type', params.resourceType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid Cloudinary response'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error?.message) message = err.error.message;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(body);
  });
}
```

### 6.2 The orchestrated upload (TanStack Query)

```ts
// src/hooks/useUpload.ts
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../lib/http';
import { uploadToCloudinary } from '../lib/upload';
import type { FileView, UploadSignature } from '../types/api';

export function useUpload(onProgress: (percent: number) => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // 1) signed params (via proxy — cookie supplies auth)
      const sig = await http
        .post<{ data: UploadSignature }>('/files/upload-signature', {
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        })
        .then((r) => r.data.data);

      // 2) direct upload with progress
      const uploaded = await uploadToCloudinary(
        {
          cloudName: sig.cloudName,
          resourceType: sig.resourceType,
          publicId: sig.publicId,
          timestamp: sig.timestamp,
          apiKey: sig.apiKey,
          signature: sig.signature,
        },
        file,
        onProgress,
      );

      // 3) finalize
      const created = await http
        .post<{ data: FileView }>('/files/complete', {
          publicId: uploaded.public_id, // use Cloudinary's final id
          originalName: file.name,
          resourceType: sig.resourceType,
          mimeType: file.type,
          size: uploaded.bytes,
        })
        .then((r) => r.data.data);

      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}
```

### 6.3 UploadDialog UX

- **Dropzone:** large dashed-border area, drag & drop + click to browse. Accept filter from the backend allowlist (`jpg,jpeg,png,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,mp4`).
- On file select: validate size client-side against `MAX_FILE_SIZE_MB` (500) for fast feedback.
- One card per file: name, size, **progress bar** (`onProgress`), status → `Completed ✓`.
- On `UNSUPPORTED_FILE_TYPE`: inline error *"'.exe' files are not allowed."*
- On `SIZE_MISMATCH` / `FILE_TOO_LARGE`: toast with the backend message.
- Disable primary action while uploading; allow cancelling in-flight uploads (abort XHR).
- Support **multiple files** queued sequentially.

---

## 7. Pages & UI Breakdown

### 7.1 `(dashboard)/layout.tsx` — AppShell (authenticated)

```
┌────────────────────────────────────────────────────────────┐
│  Sidebar (260px)        │  Topbar                          │
│  • Logo / product name  │  [search]      🔔  👤 Alice      │
│  • My Files             │                                  │
│  • Settings             │  Content (max-w-7xl, p-8)        │
│  ───────────────────    │   ┌──────────────────────────┐   │
│  • User card (avatar,   │   │  Files table / detail    │   │
│    name, logout)        │   │  (skeletons while loading)│   │
│                         │   └──────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

- Sidebar: fixed width, `border-r`, active nav item `bg-primary-soft text-primary`, dark-mode toggle optional.
- Topbar: sticky, `bg-white/80 backdrop-blur border-b`.
- Load `useMe()` here to render the user card; show logout.
- `middleware.ts` already blocks unauthenticated access to this route group.

### 7.2 `(auth)/login` & `(auth)/register`

- Centered two-column on desktop (brand/feature panel + form), single column on mobile.
- Brand panel: product name, tagline, subtle gradient.
- Form card: `w-full max-w-md`, primary CTA full-width, link between login ↔ register.

### 7.3 `(dashboard)/files`

- Client component; `useQuery(['files', page, filter])` with `keepPreviousData: true`.
- Search + visibility filter client-side; skeletons while loading; empty state CTA.

### 7.4 `s/[shareToken]`

- Server Component (SSR, cache `no-store`) — instant, public, no auth.
- Also sets `metadata` from the filename (nice touch): `export async function generateMetadata()`.

---

## 8. State & Data Fetching

- **Server state → TanStack Query** (client components). Reads via `useQuery`, writes via `useMutation` + `invalidateQueries` / optimistic updates.
- **Client state → Zustand** (UI prefs only). Auth is the httpOnly cookie (see §4) — keep it out of JS state.
- **Cache keys:** `['me']`, `['files']`, `['file', id]`, `['share', token]`.
- Set `staleTime` ~30s for lists; `refetchOnWindowFocus: false`.
- **Server components** only for the public share page (no auth, static-friendly).

**Optimistic rename example:**

```ts
useMutation({
  mutationFn: ({ id, name }: { id: string; name: string }) => filesApi.rename(id, name),
  onMutate: async ({ id, name }) => {
    await qc.cancelQueries({ queryKey: ['files'] });
    const prev = qc.getQueryData<PaginatedFiles>(['files']);
    qc.setQueryData(['files'], (old?: PaginatedFiles) => old && {
      ...old,
      files: old.files.map((f) => (f.id === id ? { ...f, originalName: name } : f)),
    });
    return { prev };
  },
  onError: (_e, _v, ctx) => {
    if (ctx?.prev) qc.setQueryData(['files'], ctx.prev);
    toast.error('Rename failed');
  },
});
```

---

## 9. Error / Loading / Empty States

| State   | Pattern                                                                 |
| ------- | ----------------------------------------------------------------------- |
| Loading | Table → shimmer skeleton rows. Upload → progress bar. Auth route → centered splash. |
| Empty   | Icon + title + description + CTA ("No files yet → Upload").              |
| Error   | Inline alert card with the backend `message` + "Try again" (refetch).    |
| Not found (404) | Styled empty state, never a bare page.                        |
| Network | Axios interceptor maps `ERR_NETWORK` → "Cannot reach the server" + retry. |
| 429     | Show the backend message: "Too many requests. Try again later."          |
| 401     | Global interceptor logs out (clears cookie) → redirect to `/login`.      |

Map backend `error.code` → friendly copy + action (a small `errorCopy.ts` dictionary).

---

## 10. UX Polish (Modern Touches)

- **Command palette** (⌘K) to jump to files / quick-upload — optional but very "enterprise".
- **Keyboard shortcuts:** `U` upload, `R` rename on selected row.
- **Copy-to-clipboard with feedback** everywhere links are shown.
- **Toasts** for every mutation outcome (success/error), auto-dismiss.
- **Empty drag-zone** subtle animation; progress bars with rounded caps.
- **Date formatting:** relative ("2 hours ago") via `Intl.RelativeTimeFormat`; sizes via `formatBytes`.
- **Row hover** reveals action buttons (don't crowd the table).
- **Dark mode:** Tailwind `dark:` variants driven by a class on `<html>`; store preference in localStorage.
- **Focus states** clearly visible (`focus-visible:ring`) for keyboard users.
- **SEO/meta:** the public page gets `generateMetadata` with the filename.

---

## 11. Responsive & Accessibility

- Mobile: table collapses to cards (`block md:table` or a card list under `md`).
- Touch targets ≥ 44px; sidebar collapses to a drawer (`lg:block` + hamburger).
- All modals: `role="dialog"`, `aria-modal`, focus trap, ESC + scrim click to close.
- Icons `aria-hidden` + text labels where meaningful.
- Forms: `label` + `htmlFor`, `aria-invalid` on error, inline error `aria-describedby`.
- Color contrast ≥ 4.5:1; never rely on color alone (icons accompany status).

---

## 12. Frontend `.env`

```dotenv
# .env.local  (server-only — read in route handlers / server components)
BACKEND_URL=http://localhost:4000/api

# Optional, used in UI copy
NEXT_PUBLIC_APP_NAME=SecureFiles
```

The Cloudinary cloud name/api key are **not** needed in the frontend config — they arrive per-upload inside the signed params from `upload-signature`. (No secret ever ships to the browser.)

> **Proxy note:** if the backend is deployed elsewhere (e.g. Render), set `BACKEND_URL` to the deployed URL and enable CORS there (`CORS_ORIGIN` on the backend). The Next.js app talks server-to-server, so CORS is mostly irrelevant — but the public page and proxy still need network access to it.

---

## 13. Checklist

- [ ] Next.js 15 (App Router) scaffolded with Tailwind + shadcn/ui
- [ ] Design tokens in `globals.css`; reusable `ui/` primitives built
- [ ] Auth route handlers (`login`, `register`, `logout`) set/clear httpOnly cookie
- [ ] Catch-all proxy `/api/[...path]` forwards to backend with Bearer header
- [ ] `middleware.ts` protects dashboard routes (redirect to `/login`)
- [ ] `useMe` restores session; user card + logout in the dashboard layout
- [ ] Auth pages: register, login (zod validation mirroring backend)
- [ ] Dashboard: files table, search, visibility filter, pagination, skeletons, empty state
- [ ] Upload dialog: dropzone → progress → success (multi-file, queued)
- [ ] Row actions: info, download, rename, share, visibility, delete (all with toasts)
- [ ] Share dialog: copy link, open link, revoke
- [ ] Public `/s/[token]` Server Component incl. styled 404 + `generateMetadata`
- [ ] Optimistic updates + rollback for rename/visibility
- [ ] Responsive + accessible (focus, aria, contrast)
- [ ] `npm run build` passes (Next build, strict TS)
