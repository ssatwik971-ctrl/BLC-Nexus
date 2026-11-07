import serverless from 'serverless-http';
import { withLambda } from '@netlify/aws-lambda-compat';
import { getUser } from '@netlify/identity';
import { PrismaClient } from '@prisma/client';
import { getStore } from '@netlify/blobs';
import { config } from '../../backend/src/config.js';
import { createLogger } from '../../backend/src/utils/logger.js';
import { createMailer } from '../../backend/src/utils/mailer.js';
import { createApp } from '../../backend/src/app.js';

let prisma;
let appHandler;

async function getHandler() {
  if (appHandler) return appHandler;
  const databaseUrl = process.env.NETLIFY_DB_URL;
  if (!databaseUrl) throw new Error('NETLIFY_DB_URL is not available. Enable Netlify Database for this site.');
  prisma ??= new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const logger = createLogger(config);
  const mailer = createMailer(config, logger);
  // Keep Deploy Preview / branch-deploy uploads isolated from production data.
  const deployContext = String(process.env.CONTEXT || 'development').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24);
  const storeName = deployContext === 'production' ? 'blc-nexus-private-documents' : `blc-nexus-documents-${deployContext}`;
  const blobStore = getStore(storeName);
  const app = createApp({ prisma, config, mailer, logger, identityMode: true, blobStore });
  appHandler = serverless(app, { provider: 'aws' });
  return appHandler;
}

// Modern v2 wrapper is required: @netlify/identity.getUser() is not supported
// by a plain v1 Lambda export. The verified Identity subject is injected only
// after Netlify has validated the signed session cookie.
export default withLambda(async (event, context) => {
  try {
    const identityUser = await getUser();
    const headers = { ...(event.headers || {}) };
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase().startsWith('x-blc-verified-identity-')) delete headers[key];
    }
    if (identityUser?.id) headers['x-blc-verified-identity-id'] = identityUser.id;
    if (identityUser?.email) headers['x-blc-verified-identity-email'] = identityUser.email.toLowerCase();
    // A session only exists after a successful Identity login, and Identity refuses to log in
    // an unconfirmed account. So a user returned by getUser() is confirmed. Do not depend on a
    // single field name (confirmedAt vs confirmed_at vs emailConfirmedAt): a missing field made
    // every confirmed member fail with "Use a confirmed Netlify Identity account first".
    if (identityUser?.id) headers['x-blc-verified-identity-confirmed'] = 'true';
    // Netlify may hand the function the rewritten path; Express routes are mounted at /api/*.
    const path = String(event.path || '').replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
    const trustedEvent = { ...event, path, headers };
    const run = await getHandler();
    return await run(trustedEvent, context);
  } catch (error) {
    console.error('[BLC Nexus Netlify Function]', error);
    return {
      statusCode: 503,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ error: 'BLC Nexus API is not configured. Check the Netlify deployment settings.' }),
    };
  }
});
