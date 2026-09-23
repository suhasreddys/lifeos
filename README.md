# 🚀 LifeOS — Personal AI & Life Operating System

**LifeOS** is an intelligent, privacy-first personal command center that unifies your documents, daily schedule, task list, financial overview, and rental management into a single, beautiful dashboard powered by **Google Gemini Vision AI**.

---

## ✨ Key Features

### 📄 1. Multimodal AI Document & Image Vault
- **Read & Analyze Anything**: Upload PDFs (`.pdf`), images (`.png`, `.jpg`, `.jpeg`, `.webp`), and scanned paperwork.
- **Powered by Gemini Vision**: Automatically extracts document summaries, key expiration dates, follow-up action items, and rental agreement details directly from image pixels or PDF text.
- **Smart Date Sync**: Extracted dates automatically sync to your **Calendar** and **Task Manager**.

### 🗓️ 2. Google Calendar Integration & Public Holidays
- **Google OAuth Sign-in**: 1-Click "Sign in with Google" to automatically log into LifeOS and pull your primary Google Calendar events.
- **National Public Holidays**: 1-Click load official national holidays for **India, USA, and UK**.
- **iCal Export & Import**: Download your LifeOS calendar as `.ics` or sync via Google iCal secret URL.

### 🔒 3. Secure User Authentication
- **Multi-User Accounts**: User registration, password hashing, and 30-day HTTP-only session cookies.
- **Personal Data Storage**: User data, files, and tasks are isolated per user account.

### 🤖 4. Floating AI Personal Assistant
- **Always-on AI Chat Widget**: Access your Gemini-powered personal assistant anywhere in the app to search records, generate daily plans, or draft emails.

### ⚡ 5. Task & Priority Manager
- Filter by category (**Work, Personal, Urgent**) and priority (**High, Medium, Low**).
- Automated AI task recommendations based on upcoming document expiry dates.

### 💰 6. Financial Command Center
- Track monthly income, expenses, category spending breakdowns, and balance summaries.

### 🏠 7. Tenant & Landlord Manager
- Store lease agreements, track monthly rent due dates, landlord details, and security deposit records.

### 📱 8. Android PWA App Ready
- **Install on Android**: Fully compliant Progressive Web App (PWA) with high-resolution app icons (`icon-192.png`, `icon-512.png`).
- Open your live link in Chrome on Android and tap **"Add to Home Screen"** to install LifeOS as a native Android app!

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack) & [React 19](https://react.dev/)
- **AI Engine**: Google Gemini API (`gemini-3.5-flash-lite` / `gemini-2.5-flash` vision multimodal)
- **Styling**: Tailwind CSS v4 & Custom Glassmorphism Consumer UI
- **Auth**: Google OAuth 2.0 & Session Cookies
- **Language**: TypeScript

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/suhasreddys/lifeos.git
cd lifeos
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Environment Variables
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite

# Optional: Google OAuth credentials for Google Calendar Sign-in
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploying to Vercel & Installing on Android

### Deploying to Vercel (Web Hosting)
1. Push your code to GitHub: `git push origin main`
2. Go to [Vercel.com](https://vercel.com/new) and import your `lifeos` repository.
3. Add your `GEMINI_API_KEY` under **Environment Variables**.
4. Click **Deploy**. Vercel will give you a live URL (`https://lifeos.vercel.app`).

### Installing on Android
1. Open your published Vercel website link on **Google Chrome for Android**.
2. Tap **"⋮" Menu** -> Tap **"Add to Home screen"** / **"Install App"**.
3. LifeOS will install directly onto your Android device as a standalone app!

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
