import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ALERT_WEBHOOK?: string;
}

interface Target {
  id: number;
  url: string;
  name: string | null;
  expected_status: number;
  timeout_ms: number;
  follow_redirects: number;
  check_interval_seconds: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface CheckResult {
  target_id: number;
  status_code: number | null;
  response_time_ms: number | null;
  error: string | null;
  redirect_chain: string | null;
  ssl_expiry: string | null;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// List all targets
app.get('/api/targets', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM targets ORDER BY created_at DESC'
  ).all<Target>();
  return c.json({ targets: results });
});

// Get single target with latest check
app.get('/api/targets/:id', async (c) => {
  const id = c.req.param('id');
  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?')
    .bind(id).first<Target>();
  if (!target) return c.json({ error: 'Not found' }, 404);

  const check = await c.env.DB.prepare(`
    SELECT * FROM checks WHERE target_id = ? ORDER BY checked_at DESC LIMIT 1
  `).bind(id).first();
  
  return c.json({ target, latest_check: check });
});

// Create target
app.post('/api/targets', async (c) => {
  const body = await c.req.json<{
    url: string;
    name?: string;
    expected_status?: number;
    timeout_ms?: number;
    follow_redirects?: boolean;
    check_interval_seconds?: number;
  }>();

  if (!body.url) return c.json({ error: 'url required' }, 400);

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO targets (url, name, expected_status, timeout_ms, follow_redirects, check_interval_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      body.url,
      body.name || null,
      body.expected_status || 200,
      body.timeout_ms || 10000,
      body.follow_redirects !== false ? 1 : 0,
      body.check_interval_seconds || 300
    ).run();
    
    const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?')
      .bind(result.meta.last_row_id).first<Target>();
    return c.json({ target }, 201);
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'URL already exists' }, 409);
    return c.json({ error: e.message }, 500);
  }
});

// Update target
app.patch('/api/targets/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Partial<Target>>();
  
  const fields: string[] = [];
  const values: any[] = [];
  
  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.expected_status !== undefined) { fields.push('expected_status = ?'); values.push(body.expected_status); }
  if (body.timeout_ms !== undefined) { fields.push('timeout_ms = ?'); values.push(body.timeout_ms); }
  if (body.follow_redirects !== undefined) { fields.push('follow_redirects = ?'); values.push(body.follow_redirects ? 1 : 0); }
  if (body.check_interval_seconds !== undefined) { fields.push('check_interval_seconds = ?'); values.push(body.check_interval_seconds); }
  if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
  
  if (fields.length === 0) return c.json({ error: 'no fields to update' }, 400);
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  await c.env.DB.prepare(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  
  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(id).first<Target>();
  return c.json({ target });
});

// Delete target
app.delete('/api/targets/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM targets WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Manual check trigger
app.post('/api/targets/:id/check', async (c) => {
  const id = c.req.param('id');
  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(id).first<Target>();
  if (!target) return c.json({ error: 'Not found' }, 404);
  
  const result = await performCheck(c.env, target);
  return c.json({ check: result });
});

// Get check history
app.get('/api/targets/:id/checks', async (c) => {
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM checks WHERE target_id = ? ORDER BY checked_at DESC LIMIT ?
  `).bind(id, limit).all();
  return c.json({ checks: results });
});

// Cron trigger - runs scheduled checks
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(req, env, ctx);
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled link checks...');
    
    const { results: targets } = await env.DB.prepare(
      'SELECT * FROM targets WHERE enabled = 1'
    ).all<Target>();
    
    for (const target of targets) {
      // Check if enough time has passed since last check
      const lastCheck = await env.DB.prepare(`
        SELECT checked_at FROM checks WHERE target_id = ? ORDER BY checked_at DESC LIMIT 1
      `).bind(target.id).first<{ checked_at: string }>();
      
      if (lastCheck) {
        const lastChecked = new Date(lastCheck.checked_at).getTime();
        const intervalMs = target.check_interval_seconds * 1000;
        if (Date.now() - lastChecked < intervalMs) {
          continue; // Skip, not time yet
        }
      }
      
      // Run check in background
      ctx.waitUntil(performCheck(env, target).catch(e => console.error(`Check failed for ${target.url}:`, e)));
    }
  }
};

async function performCheck(env: Env, target: Target): Promise<CheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), target.timeout_ms);
  
  let status_code: number | null = null;
  let error: string | null = null;
  let redirect_chain: string | null = null;
  let ssl_expiry: string | null = null;
  
  try {
    const response = await fetch(target.url, {
      method: 'HEAD',
      redirect: target.follow_redirects ? 'follow' : 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'LinkChecker/1.0 (+https://github.com/sablelight/link-checker)' }
    });
    
    clearTimeout(timeout);
    status_code = response.status;
    
    // Get redirect chain if followed
    if (target.follow_redirects) {
      // Note: fetch doesn't expose redirect chain directly
      // Would need to use 'manual' and follow manually for full chain
    }
    
    // Check SSL expiry for HTTPS
    if (target.url.startsWith('https://')) {
      try {
        // Extract hostname and check SSL via a separate method if needed
        const url = new URL(target.url);
        // SSL check would require TLS connection - simplified here
      } catch {}
    }
    
  } catch (e: any) {
    error = e.name === 'AbortError' ? 'timeout' : e.message;
  } finally {
    clearTimeout(timeout);
  }
  
  const response_time_ms = Date.now() - start;
  
  const result: CheckResult = {
    target_id: target.id,
    status_code,
    response_time_ms,
    error,
    redirect_chain,
    ssl_expiry,
  };
  
  // Store check result
  await env.DB.prepare(`
    INSERT INTO checks (target_id, status_code, response_time_ms, error, redirect_chain, ssl_expiry)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    target.id, status_code, response_time_ms, error, redirect_chain, ssl_expiry
  ).run();
  
  // Alert if status doesn't match expected
  if (status_code !== null && status_code !== target.expected_status && env.ALERT_WEBHOOK) {
    await sendAlert(env, target, status_code, error).catch(console.error);
  }
  
  return result;
}

async function sendAlert(env: Env, target: Target, status: number, error: string | null): Promise<void> {
  if (!env.ALERT_WEBHOOK) return;
  
  const payload = {
    text: `🔴 Link Check Failed: ${target.name || target.url}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${target.name || target.url}* returned ${status || 'ERROR'}` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Expected:* ${target.expected_status}` },
        { type: 'mrkdwn', text: `*Got:* ${status || 'N/A'}` },
        { type: 'mrkdwn', text: `*Error:* ${error || 'N/A'}` },
        { type: 'mrkdwn', text: `*URL:* <${target.url}|Open>` }
      ]}
    ]
  };
  
  await fetch(env.ALERT_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}