# Frontend – Knowledge-Based Search Engine

Responsive Next.js application that lets authenticated Supabase users manage conversations, upload PDFs, and chat with an AI assistant that reasons over their personal document set.

## Highlights

- **Supabase Auth** – email/password login with automatic token refresh
- **Conversation UX** – create, rename, delete, and resume chats per user
- **Document Control** – upload PDFs, toggle inclusion in RAG context, preview inline
- **AI Chat** – optimistic UI for user messages, Gemini-powered assistant responses
- **Mobile-first Layout** – slide-in drawers for conversations/documents on small screens

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling/UI**: Tailwind CSS, shadcn/ui, lucide-react icons
- **State/Data**: React hooks + Axios client with auth interceptors
- **Auth**: Supabase JS SDK

## Getting Started

> Requires Node.js 18+ (or compatible with Next.js 15) and a running backend (`../backend`) on `http://localhost:8000` by default.

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy the environment template:
   ```bash
   cp .env.local.example .env.local   # provide your own values
   ```
3. Update `.env.local` with:

   | Key | Example | Description |
   | --- | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI base URL |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ey...` | Supabase anon key for client auth |

4. Run the dev server
   ```bash
   npm run dev
   ```
   Visit <http://localhost:3000>.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Create production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint (configure Next.js plugin to enable) |

## API Contract

The Axios client (`lib/api-client.ts`) automatically:

- attaches `Authorization: Bearer <token>` from Supabase session
- appends `user_id=<supabase-user-id>` query parameter

Expected endpoints (relative to `NEXT_PUBLIC_API_URL`):

- `GET /conversations` – list
- `POST /conversations` – create
- `PATCH /conversations/:id` – rename
- `DELETE /conversations/:id` – delete (cascades on backend)
- `GET /conversations/:id/messages` / `POST /conversations/:id/messages`
- `GET /conversations/:id/documents` / `POST` / `PATCH` / `DELETE` / `GET .../url`

## UI Overview

```
frontend/
├── app/
│   ├── app/page.tsx          # main authenticated experience
│   ├── login/page.tsx        # email/password login
│   └── layout.tsx            # root layout & providers
├── components/
│   ├── chat-panel.tsx        # chat stream + composer
│   ├── conversations-sidebar # conversation list & rename dialog
│   └── documents-panel.tsx   # upload/toggle/preview controls
├── lib/
│   ├── auth-context.tsx      # Supabase auth provider
│   └── api-client.ts         # Axios instance + shared types
└── hooks/
    ├── use-mobile.ts         # mobile breakpoint helper
    └── use-toast.ts          # shadcn toast hook
```

## Notes

- Document previews render inside an iframe dialog using signed URLs; the backend must grant read access via Supabase.
- Linting currently warns because the default Next.js ESLint plugin is not configured—add your project-specific config before running in CI.
- The UI gracefully falls back to mock data if API calls fail, but to exercise the full flow run the backend service simultaneously.

For backend setup, dependency management, and data flow see the project root `README.md` and `../backend/README.md`.
