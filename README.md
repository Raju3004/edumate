# EduMate — PS 06

Structured the same way as MotoMate: separate backend/ and frontend/, deployed
the same way — Vercel (frontend) + Render (backend) — with Supabase as the
database this time instead of MongoDB Atlas.

## What's in here
- `frontend/edumate-landing.html` — 3D landing page with the live tutor demo.
  Currently a standalone file; once the Vite + React frontend from the PS 06
  build is in this workspace, this becomes its home route (same move as
  giving MotoMate a real landing page instead of defaulting to /login).
- `backend/supabase/001_init_schema.sql` — Supabase schema (profiles,
  learning_profiles, tutor_sessions, messages, progress_events + RLS).
  Paste into the Supabase SQL editor on a fresh project.

## Next up
- Wire the landing page's login/signup to real Supabase Auth
- Move the Express backend's data layer off SQLite onto this Supabase schema
- Deploy: frontend → Vercel, backend → Render
