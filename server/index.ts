import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response } from 'express';
import app from './app.js';

const configuredPort = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3001;
const host = '0.0.0.0';
const compiledServerDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDistDirectory = resolve(compiledServerDirectory, '..', 'dist');
const frontendIndexPath = resolve(frontendDistDirectory, 'index.html');

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
