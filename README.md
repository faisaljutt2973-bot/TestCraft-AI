# TestCraft AI: AI-Powered Test & Exam Generator Platform

**TestCraft AI** is a production-quality, syllabus-grounded educational assessment platform engineered for educators. It empowers teachers to automatically generate comprehensive examinations, quizzes, monthly tests, midterms, and final exam papers directly grounded in textbooks, chapters, and curriculum standards.

---

## 🌟 Core Capabilities & Features

### 1. Multi-Role Authentication
- **Teacher Account**: Register, sign in, manage textbooks, select syllabus chapters, configure mark allocations, and generate customized exam papers.
- **Administrator Role**: System-level oversight, educational board registration, AI provider limits, and user role management.
- **Instant Demo Access**: Pre-seeded accounts available out-of-the-box (`teacher@testcraft.ai` / `teacher123`, `admin@testcraft.ai` / `admin123`).

### 2. Multi-Mode Book Ingestion & Library Management
- **Upload Course Documents (PDF, DOCX, TXT)**: Intelligent text extraction and automatic Chapter & Table of Contents (TOC) detection using regular expression heuristics and curriculum pattern recognition.
- **Online Google Books API Search**: Search millions of volumes by title, author, or ISBN, and import bibliographic metadata into your school library.
- **Regional & International Board Curricula**: Preloaded with Pakistani boards (Punjab Curriculum & Textbook Board PCTB, Federal Board FBISE, Sindh Board STBB) and international examination bodies (Cambridge CAIE, CBSE).
- **Manual Textbook Builder**: Add books, edition details, chapter structures, and topic learning objectives manually without external files.

### 3. Chapter Detection & Topic Breakdown
- Hierarchical structure: **Book ➔ Chapters ➔ Topics ➔ Subtopics**.
- Interactive chapter checkboxes for single chapter, multi-chapter, or entire textbook selection.
- Exclude/include chapters from examinations, edit chapter titles, and refine topic boundaries.

### 4. 6-Step Guided Test & Exam Generator
1. **Syllabus Selection**: Select board, grade/class, subject, book, and target chapters.
2. **Examination Type**: Choose Chapter-wise, Monthly test, Weekly quiz, Midterm, Final, Full-book, or Practice assignment.
3. **Paper Configuration**: Total marks, duration, difficulty (Easy, Medium, Hard, Mixed), language, passing marks, school name, and exam headings.
4. **Question Types**: Multiple Choice Questions (MCQs), Short Answer, Long/Comprehensive, Fill in the Blanks, True/False, and Numerical Problems.
5. **Live Marks Balancer**: Real-time sum calculation ensuring question allocations match the target marks, with one-click auto-balance.
6. **Curriculum Grounding**: Generates age-appropriate questions answerable strictly from the selected chapters, with model answers and marking rubrics.

### 5. Midterm & Full-Book Examination Planner
- Dedicated planning matrix with custom chapter cutoff ranges (e.g. Chapters 1–5 for First Term).
- Configurable section distributions (Section A: MCQs, Section B: Short Qs, Section C: Long Qs).

### 6. Institutional Question Bank
- Reusable repository with filters by subject, class, difficulty, and question type.
- Manual Question Creator with full marking rubrics and model answers.

### 7. Interactive Test Editor & Dual Preview
- **Student Paper Mode**: Formatted clean question paper with school header, candidate name/roll number fields, and clear section dividers.
- **Teacher Answer Key Mode**: Highlights correct options for MCQs, step-by-step solutions for numerical problems, model answers, and marking criteria.
- **Single Question Regeneration**: Regenerate any individual question with AI without regenerating the entire paper.
- **Question Bank Swapping**: Replace any question with an item from your institutional question bank.
- **Live Print & Export**: Browser print styling optimized for paper/PDF (hiding toolbars and sidebars) and one-click DOCX download.

### 8. Teacher Profile & Account Management
- Editable personal information (name, phone, school) and avatar upload with instant preview/removal.
- In-app password change with current-password verification.

### 9. Help Desk & Support Tickets
- Any signed-in user can open a support ticket and follow the reply thread.
- Administrators see all tickets, reply to them, and toggle status (open / replied / closed) from the Admin Panel.

### 10. Administration & Platform Hardening
- User administration: create users, change roles, delete accounts, with a last-admin safety guard.
- Role-based access control on books, questions, boards, settings, and AI credentials.
- Security baseline: Helmet (CSP + headers), configurable CORS allowlist, request body limits, tiered rate limiting (API + auth), authenticated uploads, no plaintext secrets in API responses, and HTML escaping on every export.
- SEO baseline: canonical/robots metadata, Open Graph & Twitter cards, JSON-LD `SoftwareApplication` schema, `robots.txt`, `sitemap.xml`, and per-view document titles.

---

## 🏗️ Architecture & Technology Stack

```
gp test/
  ├── package.json                 # Unified startup scripts
  ├── README.md                    # System documentation
  ├── server/                      # Node.js + Express.js Backend
  │   ├── index.js                 # Server entrypoint & routing
  │   ├── .env.example             # Environment configuration template
  │   ├── scripts/
  │   │   └── migrate-to-mongodb.js# One-time JSON ➔ MongoDB data migration
  │   ├── config/
  │   │   ├── db.js                # MongoDB Atlas connection
  │   │   ├── storage.js           # Async storage layer (MongoDB + JSON fallback)
  │   │   └── seedData.js          # Realistic educational sample data
  │   ├── controllers/             # Auth, books, syllabus, generator, tests, questions
  │   ├── services/
  │   │   ├── aiService.js         # Gemini 1.5/2.0 + grounded heuristic generator
  │   │   ├── parserService.js     # PDF text extraction & chapter detector
  │   │   ├── googleBooksService.js# Google Books API integration
  │   │   └── exportService.js     # Print HTML & DOCX formatting
  │   ├── middleware/              # JWT auth, Multer file upload, error handlers
  │   └── uploads/                 # Uploaded textbook documents
  └── client/                      # React 18 + Vite + Tailwind CSS Frontend
      ├── index.html               # Clean HTML5 with Inter fonts
      ├── vite.config.js           # Vite dev server & API proxying
      ├── tailwind.config.js       # Custom educational color tokens
      └── src/
          ├── App.jsx              # Main view controller & routing
          ├── context/             # AuthContext (JWT & user state)
          ├── services/api.js      # Centralized HTTP API client
          ├── components/          # Sidebar, Navbar, Modal, Card
          └── pages/               # Dashboard, BookLibrary, BookDetail, SyllabusManager,
                                   # TestGenerator, TestEditor, ExamPlanner, QuestionBank,
                                   # SavedTests, Settings, Profile, Support, AdminPanel
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0 or higher) and **npm** installed.

### 2. Installation
Dependencies are already initialized. To re-install if needed:
```bash
# Backend dependencies
cd server
npm install

# Frontend dependencies
cd ../client
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` in the `server` folder:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=production              # Must be "production" on the deployed host
MONGODB_URI=                     # MongoDB Atlas connection string; leave blank for local JSON persistence
MONGODB_DB_NAME=testcraft        # Target database name
SEED_DEMO_DATA=false             # Demo accounts are auto-disabled in production; set true only if you want them
AI_PROVIDER=gemini               # 'gemini' | 'openai' | 'heuristic'
GEMINI_API_KEY=                  # Optional: Google Gemini API key for external AI generation
OPENAI_API_KEY=                  # Optional: OpenAI API key
GOOGLE_BOOKS_API_KEY=            # Optional: Google Books API key
UPLOAD_MAX_SIZE_MB=50
CLIENT_URL=http://localhost:5173 # Used in password reset links
CORS_ORIGINS=http://localhost:5173 # Comma-separated list of allowed browser origins
SMTP_HOST=                       # Optional: outbound email for reset/support notifications
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

> **Note on Zero-Config Mode**: If `GEMINI_API_KEY` is not provided, the platform automatically switches to its **High-Fidelity Grounded Heuristic Engine**, which extracts exact concepts, formulas, topics, and definitions directly from the selected textbook chapters to generate complete questions, answers, and rubrics.

### 4. Running the Application

In two separate terminals:

**Terminal 1 (Backend Server):**
```bash
cd server
npm start
# Runs on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Runs on http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173` in your browser.

### 5. Database Migration

When `MONGODB_URI` is configured, the server connects to MongoDB Atlas and stores all data there automatically. To copy existing local JSON data (`server/data/store.json`) into MongoDB:

```bash
cd server
npm run migrate
```

If MongoDB is unreachable, the storage layer transparently falls back to the local JSON store so the app keeps working offline.

### 6. Production Build

```bash
cd client
npm run build
```

The optimized bundle and static SEO assets (`robots.txt`, `sitemap.xml`) are emitted to `client/dist`.

> **SEO note:** set `VITE_SITE_URL` in `client/.env` to your production origin before building. It drives the canonical URL, Open Graph/Twitter tags, JSON-LD, and the generated `robots.txt` / `sitemap.xml`.

---

## 🚀 Deployment

### Netlify

The repository's `netlify.toml` configures `npm run build`, publishes `client/dist`,
and deploys the Express API as a Netlify Function. These settings replace the old
`make all`, `public`, and `my-functions` settings. The root postinstall script installs both client and server dependencies from
their lockfiles without exposing multiple workspace deployment targets.

API requests and authenticated file downloads are routed before the React page
fallback, so `/api/*` returns JSON and refreshing an application URL serves the app.
The standalone Express server remains available through `npm start`.

On Netlify, application records use Netlify Database through Drizzle. The schema
is defined in `db/schema.ts`; generated migrations in `netlify/database/migrations`
are applied by Netlify during deployment. Database errors are surfaced rather
than falling back to a temporary JSON file. Existing MongoDB/local data is not
imported automatically.

Uploaded textbook originals use Netlify Blobs. Parsing uses temporary files that
are removed after each request. Netlify uploads are capped at 4 MB to stay below
the function's request size limit, including multipart and encoding overhead.

Configure `JWT_SECRET` in Netlify's runtime environment for the existing login
system. Configure SMTP variables for password reset email delivery. Production
demo accounts are disabled by default. `VITE_SITE_URL` controls public SEO URLs;
set it to the deployed origin if using a different domain.


### Single-origin (recommended)
The Express server automatically serves `client/dist` when it exists, so one Node process can host both the API and the app:

```bash
# 1. Build the client
cd client
npm run build

# 2. Start the server in production mode (from the repo root or /server)
cd ../server
NODE_ENV=production npm start
```

- Open `http://<host>:<PORT>` — the SPA is served with a fallback to `index.html`, and `/api/*` still returns JSON.
- Set `CLIENT_URL` and `CORS_ORIGINS` to the deployed origin (e.g. `https://app.example.com`).
- Behind a reverse proxy (Nginx, Render, Railway, etc.) enable HTTPS and set `PORT` as required.

### Split hosting (static client + API)
Deploy `client/dist` to a static host and proxy `/api` (and `/uploads`) to the Express server. `API_BASE` in `client/src/services/api.js` is relative, so same-origin proxying is required.

### Production checklist
- [ ] `NODE_ENV=production` and a strong, unique `JWT_SECRET` (rotate any secret that has been shared).
- [ ] Rotate the MongoDB Atlas password; restrict Atlas network access to your host.
- [ ] `MONGODB_URI`/`MONGODB_DB_NAME` set; run `npm run migrate` once if importing existing JSON data.
- [ ] `CLIENT_URL` + `CORS_ORIGINS` set to the real origin.
- [ ] SMTP configured if password reset emails are needed (otherwise resets are silently unavailable in production).
- [ ] `SEED_DEMO_DATA` unset/false so the demo `teacher123` / `admin123` accounts are not created on an empty database.
- [ ] `VITE_SITE_URL` set before `npm run build`.
- [ ] Persistent storage for `server/uploads` (or object storage) and `server/data` if falling back to JSON.
- [ ] `.env` files are excluded from version control via the root `.gitignore`.

---

## 🔑 Default Credentials

| Role | Email | Password |
|---|---|---|
| **Teacher** | `teacher@testcraft.ai` | `teacher123` |
| **Administrator** | `admin@testcraft.ai` | `admin123` |

You can also click the **"Teacher Demo"** or **"Admin Demo"** buttons on the login screen for instant one-click sign-in.

> These accounts are only seeded in development. With `NODE_ENV=production` they are skipped unless `SEED_DEMO_DATA=true`, so an empty production database starts with no known-password accounts.
