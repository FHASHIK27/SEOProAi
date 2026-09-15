// Vercel catch-all serverless entry: handles /api and /api/<anything>.
// The Express app is imported from the backend source (bundled via vercel.json
// "includeFiles") and is never part of the public static output.
import app from '../backend/server.js'

export default app
