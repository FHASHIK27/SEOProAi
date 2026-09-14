// Vercel serverless entry: exposes the Express API at /api/*
// The backend source is bundled into this function via vercel.json "includeFiles"
// and is NOT part of the static output, so it can never be downloaded from the site.
import app from '../backend/server.js'

export default app
