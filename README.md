# SafeHer Campus 🛡️

A women's safety PWA built for college campuses. Real-time SOS alerts, live location tracking, safe route mapping, peer escort system with AI-screened chat, and check-in schedules — all in one mobile-first app.

**Live:** [women-safety11.vercel.app](https://women-safety11.vercel.app)

---

## Features

| Feature | Description |
|---|---|
| SOS Button | One-tap emergency alert with live location sent to contacts |
| Shake-to-SOS | Shake the phone to silently trigger SOS |
| Check-in Timer | Schedule a check-in; missed check-in auto-triggers SOS |
| Safe Route Map | Live map with community-reported incidents and safe routes |
| Incident Reporting | Report harassment, suspicious activity, unsafe areas |
| Campus Buddy | Request a peer escort from available volunteers nearby |
| AI Screening Chat | Groq AI privately screens both users before connecting them |
| Direct Buddy Chat | Real-time chat unlocks after mutual AI consent + proximity check |
| Profile | Manage emergency contacts, personal info |

---

## App Flow

```
┌─────────────────────────────────────────────────────────┐
│                      USER OPENS APP                      │
└─────────────────────┬───────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  Auth (Supabase)│
              │  Login / Signup │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   Home Screen   │
              │  - SOS Button   │
              │  - Shake-to-SOS │
              │  - Check-in     │
              └───┬─────────┬──┘
                  │         │
       ┌──────────▼──┐  ┌───▼──────────┐
       │  SOS Trigger │  │  Check-in    │
       │  (manual /   │  │  Countdown   │
       │   shake)     │  │  Timer       │
       └──────┬───────┘  └───┬──────────┘
              │              │ missed?
              │              ▼
              │        Auto-trigger SOS
              │
              ▼
       ┌──────────────────────────┐
       │  SOS Alert Sent          │
       │  - Live location         │
       │  - Notifies contacts     │
       │  - Logged in Supabase    │
       └──────────────────────────┘


┌─────────────────────────────────────────────────────────┐
│                     MAP PAGE                             │
│                                                          │
│  Live GPS ──► User marker on map                         │
│                                                          │
│  Community incidents shown as color-coded circles:       │
│    🔴 Harassment   🟠 Suspicious                         │
│    🟡 Unsafe Area  ⚫ Other                              │
│                                                          │
│  Safe routes drawn as polylines                          │
│  Route recording: track & save your safe path            │
└─────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────┐
│              CAMPUS BUDDY FLOW                           │
└─────────────────────────────────────────────────────────┘

  User A                  AI (Groq)               User B
    │                        │                       │
    │── Request Escort ──────────────────────────►  │
    │                        │                       │
    │                        │         ◄── "Screen & Help" clicked
    │                        │                       │
    │                        │◄── AI screens User B ─┤
    │                        │    "Are you available  │
    │                        │     to help?"          │
    │                        │                       │
    │                        │── User B says "Yes" ──►│
    │                        │   buddy_consented=true │
    │                        │                       │
    │◄── Prompted to start ──│                       │
    │    own AI screening    │                       │
    │                        │                       │
    │── AI screens User A ──►│                       │
    │   "Where do you need   │                       │
    │    to go? Are you safe?"│                      │
    │                        │                       │
    │── User A says "Yes" ───►│                      │
    │   requester_consented=true                     │
    │                        │                       │
    │         BOTH CONSENTED + LOCATION ≤ 5km        │
    │                        │                       │
    │◄══════ Direct Chat + Live Map Unlocked ════════►│
    │         Real-time messaging via Supabase        │
    │◄════════════════════════════════════════════════►│
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Auth & DB | Supabase (PostgreSQL + Realtime) |
| Maps | Leaflet, React-Leaflet, OpenStreetMap |
| AI Screening | Groq API (`llama-3.1-8b-instant`) |
| Push Notifications | Supabase notifications table + Realtime |
| Email Alerts | EmailJS |
| PWA | vite-plugin-pwa, Workbox |
| Deployment | Vercel |

---

## Database Schema

```
profiles
├── id (uuid, FK → auth.users)
├── full_name, avatar_url, phone
└── emergency_contacts (jsonb)

buddy_availability
├── user_id (FK → auth.users)
├── is_available (bool)
├── lat, lng
└── last_seen

buddy_requests
├── requester_id, buddy_id (FK → auth.users)
├── status: pending | screening | accepted | declined | completed
├── req_lat, req_lng, buddy_lat, buddy_lng
├── requester_consented, buddy_consented (bool)
└── created_at

buddy_direct_messages
├── request_id (FK → buddy_requests)
├── sender_id (FK → auth.users)
├── content
└── created_at

checkin_schedules
├── user_id, title
├── scheduled_time, interval_minutes
└── is_active

incidents
├── user_id, type, description
├── lat, lng
└── created_at

notifications
├── user_id, type, title, body
└── read, created_at
```

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/SruSanCyborg/WomenSafety11.git
cd WomenSafety11

# 2. Install
npm install

# 3. Environment variables — create .env.local
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key        # free at console.groq.com
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key

# 4. Run
npm run dev
```

---

## Team

| Name | Role | Contribution |
|---|---|---|
| Sanjay Sivakumar | Full Stack | SOS system, check-in timer, schedule, auth, map, incidents, deployment |
| Roopan Adithiya | Frontend | Community page, Campus Buddy UI, Profile, Map page |
