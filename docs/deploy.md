# Deploying

Backend on Render (free web service), frontend on Vercel (free). Both redeploy automatically on every
push to `main`. Do the backend first: the frontend needs its URL.

## 1. Backend on Render

1. Sign in at [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, pick `Krishnaaa3004/Repo-onboarding-agent`. Render reads `render.yaml` and
   proposes a service called `repo-onboarding-agent-api`.
3. It asks for the values marked secret. Fill in:
   - `GEMINI_API_KEY`: your key from [AI Studio](https://aistudio.google.com/apikey)
   - `GITHUB_TOKEN`: your GitHub token (read-only access to public repos is enough)
   - `ALLOWED_ORIGINS`: leave as `http://localhost:5173` for now; you'll update it in step 3
4. Click **Apply**. The first build takes a few minutes.
5. When it shows **Live**, copy the URL (like `https://repo-onboarding-agent-api.onrender.com`) and
   open `<that URL>/api/health`. You should see `{"ok":true,...}`.

## 2. Frontend on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, import `Krishnaaa3004/Repo-onboarding-agent`.
3. Set **Root Directory** to `frontend`. Vercel detects Vite; keep its build settings.
4. Under **Environment Variables** add `VITE_API_URL` = the Render URL from step 1 (no trailing slash).
5. Click **Deploy**. Copy the site URL (like `https://repo-onboarding-agent.vercel.app`).

## 3. Connect the two

1. In Render → your service → **Environment**, set `ALLOWED_ORIGINS` to the Vercel URL from step 2.
   Save; Render restarts the backend.
2. Open the Vercel URL, click one of the example repos (instant), then try a new repo to check the
   live agent works.

## Good to know

- The free Render backend sleeps after ~15 minutes idle and takes ~30 s to wake. The site pings it on
  load to hide most of that.
- Render's free disk is temporary, so the plan cache resets on every deploy or restart. The three
  example plans are bundled into the frontend and always load.
- Changing a key: Render → Environment → edit → Save. No code change needed.
- Something broke after a push: both dashboards have a one-click rollback to the previous deploy.
