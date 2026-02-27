# Lumière Café — Ordering System

A real-time café ordering system with 5 screens synced via Firebase Realtime Database.

## 🔗 Live URLs

| Screen | URL | Access |
|---|---|---|
| 🍽️ Customer Menu | [/](https://3d-cafe-menu.vercel.app/) | Open — enter table number |
| 🧾 Cashier Dashboard | [/cashier](https://3d-cafe-menu.vercel.app/cashier) | PIN: `1234` |
| 👨‍🍳 Kitchen Display | [/kitchen](https://3d-cafe-menu.vercel.app/kitchen) | PIN: `5678` |
| 📊 Analytics | [/analytics](https://3d-cafe-menu.vercel.app/analytics) | PIN: `9999` |
| 🍽️ Menu Manager | [/menu-admin](https://3d-cafe-menu.vercel.app/menu-admin) | PIN: `0000` |

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
NEXT_PUBLIC_ANALYTICS_PIN=9999
NEXT_PUBLIC_ADMIN_PIN=0000
```

### 3. Firebase Realtime Database Rules
In Firebase Console → **Realtime Database → Rules**, paste:
```json
{
  "rules": {
    "orders": { ".read": true, ".write": true },
    "menu":   { ".read": true, ".write": true }
  }
}
```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy
Push to GitHub → connect to Vercel → add all env variables in Vercel dashboard → deploy.

## Tech Stack
Next.js 14 · Firebase Realtime DB · Tailwind CSS · Vercel
