import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response } from 'express';
import { analyseIncidentWithGemini } from './gemini.js';

const app = express();
const configuredPort = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3001;
const host = '0.0.0.0';
const compiledServerDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDistDirectory = resolve(compiledServerDirectory, '..', 'dist');
const frontendIndexPath = resolve(frontendDistDirectory, 'index.html');

// API-first middleware order: parsing and API routes always precede frontend serving.
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Incident Analysis Endpoint
app.post('/api/analyse', async (req: Request, res: Response) => {
  try {
    const { category, description, location } = req.body || {};

    // Validate request body
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Incident description is required.' });
      return;
    }

    // Check GEMINI_API_KEY presence
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '' || process.env.GEMINI_API_KEY === 'your_key_here') {
      res.status(500).json({
        error: 'Server configuration error: GEMINI_API_KEY is missing or unconfigured.',
      });
      return;
    }

    const result = await analyseIncidentWithGemini({
      category: typeof category === 'string' ? category.trim() : 'Other',
      description: description.trim(),
      location: typeof location === 'string' ? location.trim() : '',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error during incident analysis:', error?.message || error);
    res.status(500).json({
      error: error?.message || 'An unexpected error occurred while analyzing the report. Please try again later.',
    });
  }
});

// API requests never fall through to the frontend SPA.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found.' });
});

// The path is derived from this file, so production start does not depend on cwd.
app.use(express.static(frontendDistDirectory));

// Only browser GET navigation receives the SPA shell.
app.use((req: Request, res: Response, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  if (!existsSync(frontendIndexPath)) {
    res.status(500).json({
      error: 'The built frontend is unavailable. Run npm run build before starting the server.',
    });
    return;
  }

  res.sendFile(frontendIndexPath);
});

// Non-GET, non-API requests that remain unmatched receive a normal 404.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(port, host, () => {
  console.log(`Nidarr server listening on ${host}:${port}`);
});
