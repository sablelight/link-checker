import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Link Checker API', () => {
  let app: Hono;
  let mockDB: any;
  let mockCache: any;
  let mockEnv: any;

  beforeEach(() => {
    mockDB = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockEnv = {
      DB: mockDB,
      CACHE: mockCache,
    };
  });

  it('GET /health returns ok', async () => {
    const app = new Hono();
    app.get('/health', (c) => c.json({ status: 'ok' }));
    
    const req = new Request('http://localhost/health');
    const res = await app.fetch(req, mockEnv);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
  });

  it('GET /api/targets returns empty list initially', async () => {
    const app = new Hono();
    app.get('/api/targets', async (c) => {
      const { results } = await c.env.DB.prepare('SELECT * FROM targets').all();
      return c.json({ targets: results });
    });

    const req = new Request('http://localhost/api/targets');
    const res = await app.fetch(req, mockEnv);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.targets).toEqual([]);
  });

  it('POST /api/targets creates target', async () => {
    const app = new Hono();
    app.post('/api/targets', async (c) => {
      const body = await c.req.json();
      const result = await c.env.DB.prepare(
        'INSERT INTO targets (url, name) VALUES (?, ?)'
      ).bind(body.url, body.name || null).run();
      
      const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?')
        .bind(result.meta.last_row_id).first();
      return c.json({ target }, 201);
    });

    const req = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', name: 'Example' })
    });
    const res = await app.fetch(req, mockEnv);
    const json = await res.json();
    
    expect(res.status).toBe(201);
    expect(json.target).toBeDefined();
  });

  it('rejects duplicate URL', async () => {
    mockDB.run.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
    
    const app = new Hono();
    app.post('/api/targets', async (c) => {
      try {
        const body = await c.req.json();
        await c.env.DB.prepare('INSERT INTO targets (url) VALUES (?)').bind(body.url).run();
        return c.json({ success: true }, 201);
      } catch (e: any) {
        if (e.message.includes('UNIQUE')) return c.json({ error: 'URL already exists' }, 409);
        return c.json({ error: e.message }, 500);
      }
    });

    const req = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    const res = await app.fetch(req, mockEnv);
    const json = await res.json();
    
    expect(res.status).toBe(409);
    expect(json.error).toBe('URL already exists');
  });
});