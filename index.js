/**
 * Vercel serverless entry: forwards all requests to the Express app.
 * Set Vercel project root to this directory (api) when deploying.
 */
import app from './src/index.js';

export default function handler(req, res) {
  return app(req, res);
}
