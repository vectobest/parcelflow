import path from 'node:path';
import express from 'express';

/**
 * Serves only the two directories the frontend actually needs -- `frontend/`
 * for the UI itself, and `backend/src/` because frontend/app.js imports
 * routing.js directly as a browser module for its offline fallback. This is
 * deliberately narrower than serving the whole project root (the previous
 * implementation did that, which meant .git, package.json, tests and
 * AI_USAGE.md were all reachable over HTTP).
 */
export function mountStatic(app, { projectRoot }) {
  const frontendDir = path.join(projectRoot, 'frontend');
  const backendSrcDir = path.join(projectRoot, 'backend', 'src');

  app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

  app.use('/frontend', express.static(frontendDir, { dotfiles: 'deny', maxAge: '1h' }));
  app.use('/backend/src', express.static(backendSrcDir, {
    dotfiles: 'deny',
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    }
  }));
}
