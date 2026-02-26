# Lumière Café — Ordering System

A real-time café ordering system with 3 screens synced via Firebase.

## Screens
| Screen | URL | Access |
|---|---|---|
| Customer Menu | `/` | Open |
| Cashier Dashboard | `/cashier` | PIN: 1234 |
| Kitchen Display | `/kitchen` | PIN: 5678 |

## Setup

### 1. Clone and install
```bash
npm install
```

### 2. Create `.env.local` in root
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_CASHIER_PIN=1234
NEXT_PUBLIC_KITCHEN_PIN=5678
```

### 3. Firebase Realtime Database Rules
In Firebase Console → **Realtime Database → Rules**, paste:
```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true
    }
  }
}
```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy
Push to GitHub → connect to Vercel → add env variables in Vercel dashboard → deploy.

## Tech Stack
Next.js 14 · Firebase Realtime DB · Tailwind CSS · Vercel
