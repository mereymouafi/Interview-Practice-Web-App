# Meryy Interview Studio — Vercel + Google Drive

A small Next.js app for interview practice. It records audio in the browser, lets you preview it, and saves it to the signed-in user's Google Drive. No database is used.

## 1. Create Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select one).
3. Enable **Google Drive API**.
4. Configure the OAuth consent screen. For personal testing, choose External if required, add your own Google account as a test user, and keep the app in Testing.
5. Create an OAuth Client ID of type **Web application**.
6. Add this Authorized redirect URI for local development:
   `http://localhost:3000/api/auth/callback`
7. After deploying to Vercel, add the production callback URI too:
   `https://YOUR-VERCEL-DOMAIN/api/auth/callback`
8. Copy the Client ID and Client Secret.

This app requests `drive.file`, which lets it create and access files it creates with this app, rather than broad access to all your Drive files.

## 2. Run locally

1. Install Node.js 20 or newer.
2. In this project folder, run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill in Google credentials. Set `GOOGLE_REDIRECT_URI` to the local callback URL.
5. Generate a random secret (at least 32 characters) and set `SESSION_SECRET`.
6. Run `npm run dev`.
7. Open `http://localhost:3000`.

## 3. Push to GitHub

Create a private GitHub repository, then from this folder:

```bash
git init
git add .
git commit -m "Initial interview practice app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/interview-practice.git
git push -u origin main
```

Never commit `.env.local` or publish OAuth secrets.

## 4. Deploy to Vercel

1. Sign in at [Vercel](https://vercel.com/).
2. Add New Project and import your GitHub repository.
3. Add these Environment Variables in Vercel Project Settings:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://YOUR-VERCEL-DOMAIN/api/auth/callback`
   - `SESSION_SECRET` = a long random secret (32+ characters)
4. Deploy.
5. Add the production redirect URI in Google Cloud OAuth Client settings.
6. Redeploy after changing environment variables.

## 5. Google OAuth testing notes

While the OAuth consent screen is in Testing mode, add your Google account as a test user. Google refresh tokens for external apps in Testing can expire after seven days. For ongoing personal use, review Google's current OAuth publishing and verification requirements. Do not assume Testing mode provides permanent access.

## Storage behavior

- The app creates a folder named `Interview Practice` in your Google Drive.
- General-practice audio files are saved directly inside that folder.
- Company workspaces are stored under `Interview Practice/companies/` as a folder per company, with `company.json` and `questions.json` files. Company recordings are stored in that workspace's `recordings` subfolder.
- General-practice questions are stored in `Interview Practice/general-question-bank/` as `hr.json`, `technical.json`, and `behavioral.json`.
- Each file stores category, question, date, version and duration in Drive `appProperties`.
- Company recordings also store the company and question IDs, company name, and position. Their metadata is checked against the signed-in user's Drive files before upload.
- The app lists only files it created and streams them back for preview.
- No database is involved.
- The first recording for a question/date is `_v1`, then `_v2`, etc.

## Company preparation

After signing in, open **Company Preparation** to create and edit workspaces. Each workspace keeps its own question bank, with search and category filters. **Start Company Practice** shuffles a fresh round with Fisher–Yates, shows one question at a time without repeating questions in that round, and keeps prepared answers hidden until revealed.

Company and question data is stored privately in the authenticated user's Google Drive. The app adds these authenticated API endpoints:

- `GET` / `POST` `/api/companies`
- `GET` / `PUT` / `DELETE` `/api/companies/[companyId]`
- `GET` / `POST` `/api/companies/[companyId]/questions`
- `PUT` / `DELETE` `/api/companies/[companyId]/questions/[questionId]`

The existing recording endpoints remain available. Company recordings use `POST /api/recordings` with the company and question IDs; the server verifies these IDs against the saved Drive workspace before storing audio. The standalone recording library uses `GET /api/recordings` and `GET /api/recordings/[id]/audio`; `DELETE /api/recordings/[id]` removes only app-owned recordings from the authenticated user's Drive.

## Admin question manager

Set `ADMIN_EMAILS` to a comma-separated allowlist of Google account emails (for example, your own account) in `.env.local` and in Vercel Environment Variables. Restart the local server or redeploy after changing it. The Admin / Question Manager link is shown only for allowlisted accounts, and every admin API request independently verifies the signed-in Google account server-side. Authenticated users can read the general question bank for practice; only allowlisted administrators can create, edit, or delete it.

On first access, missing category files are created in Drive with the existing built-in practice questions and empty answers. From then on, the Drive JSON files are the source of truth. Updating a question between categories removes it from the previous category file and writes it to the selected category file.

Admin and practice endpoints:

- `GET /api/questions[?category=HR]` returns the authenticated user's practice question bank.
- `GET` / `POST` `/api/admin/questions` loads or adds questions (administrator only).
- `PUT` / `DELETE` `/api/admin/questions/[id]` edits or removes a question (administrator only).

General Practice keeps prepared answers hidden until **Reveal prepared answer** is selected. Refresh its question bank to load changes made from another tab.

## Separate interfaces

- `/` is the welcome page and feature navigation.
- `/practice` is General Practice, including question selection, prepared answers, and recording controls.
- `/companies` contains company workspaces and company-specific practice.
- `/recordings` is the saved recording library, with playback, refresh, and deletion controls.
- `/admin` is the protected general question manager.

The interface uses a shared, responsive Meryy visual style while keeping each feature on its own page.

## English and French

Use the **FR / EN** control in the header or sign-in screen to switch the interface language. The selection is saved in this browser and applies across the practice, company preparation, recording library, and admin screens. Interview questions, answers, company details, and notes remain in the language in which you entered them; switching the interface language does not translate saved content.

## Security and limits

- OAuth tokens are encrypted in an HttpOnly, Secure-in-production cookie using `SESSION_SECRET`.
- The Google refresh token is never sent to browser JavaScript.
- Use a private GitHub repository if you prefer.
- Keep the Vercel environment variables private.
- The upload route currently limits audio to 20 MB to stay within typical serverless request constraints.
- This is a starter implementation. Before making it a multi-user public product, add stronger abuse protection, rate limiting, and review the OAuth consent configuration.
