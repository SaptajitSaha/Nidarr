import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PORT } from './config.js';
import { analyseIncidentWithGemini } from './gemini.js';

// Load environment variables from .env file
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', server: 'Nidarr Backend' });
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

app.listen(PORT, () => {
  console.log(`Nidarr backend server running on http://localhost:${PORT}`);
});
