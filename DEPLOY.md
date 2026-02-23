# Deploy backend on Vercel

## 1. Push the API to a Git repo

From the repo root (e.g. `medease`), the API lives in the `api` folder.

## 2. Import project in Vercel

- Go to [vercel.com](https://vercel.com) → Add New → Project.
- Import your Git repository.
- Set **Root Directory** to `api` (so Vercel uses the `api` folder as the project root).
- Leave **Framework Preset** as Other (or Node.js).

## 3. Environment variables

In the Vercel project: **Settings → Environment Variables**. Add the same variables you use locally, for example:

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Yes | MongoDB connection string (e.g. Atlas) |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `CLIENT_URL` | Yes | Frontend URL (e.g. `https://your-app.vercel.app`) |
| `GMAIL_USER` | No | For sending emails |
| `GMAIL_APP_PASSWORD` | No | Gmail app password |
| `SUPER_ADMIN_SECRET` | No | Only if using create-admin API |
| `CLOUDINARY_*` | No | If using Cloudinary uploads |

## 4. Deploy

- Click **Deploy**. Vercel will run `npm install` and use `index.js` as the serverless entry.
- Your API will be at `https://<project-name>.vercel.app/api/auth/...`, `.../api/packages`, etc.

## 5. Frontend

Point the frontend API base URL to your Vercel backend, e.g. `https://<project-name>.vercel.app`.

## Notes

- The Express app runs as a single serverless function; all routes are handled by it.
- Cold starts may add latency for the first request after idle.
- For file uploads (e.g. multer), consider size limits and Vercel’s serverless constraints (e.g. 4.5 MB request body on the Hobby plan).
