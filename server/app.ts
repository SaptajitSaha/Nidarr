import 'dotenv/config';
import express, { Request, Response } from 'express';
import { analyseIncidentWithGemini } from './gemini.js';

const app = express();

app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/api/analyse', async (req: Request, res: Response) => {
  try {
    const { category, description, location } = req.body || {};

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Incident description is required.' });
      return;
    }

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

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found.' });
});

export default app;
