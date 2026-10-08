import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

type Env = { DB: any; CACHE: any; ALERT_WEBHOOK?: string };

// ExecutionContext stub — the worker only calls waitUntil inside scheduled().
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function makeDB() {
  return {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
  };
}

function makeEnv(): Env {
  return { DB: makeDB(), CACHE: {} } as unknown as Env;
}

const call = (req: Request, env: Env) => worker.fetch(req, env, ctx);

let env: Env;

beforeEach(() => { env = makeEnv(); });

describe('Link Checker API', () => {
  it('GET /health returns ok', async () => {
    const res = await call(new Request('http://x/health'), env);
    const json: any = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeTruthy();
  });

  it('GET /api/targets returns the query result', async () => {
    const targets = [{ id: 1, url: 'https://example.com' }];
    env.DB.all.mockResolvedValueOnce({ results: targets });

    const res = await call(new Request('http://x/api/targets'), env);
    const json: any = await res.json();

    expect(res.status).toBe(200);
    expect(json.targets).toHaveLength(1);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('FROM targets'));
  });

  it('POST /api/targets rejects a missing url with 400', async () => {
    const res = await call(new Request('http://x/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), env);

    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.error).toBe('url required');
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });

  it('POST /api/targets creates and returns 201', async () => {
    const created = { id: 7, url: 'https://example.com', name: 'Example' };
    env.DB.first.mockResolvedValueOnce(created);

    const res = await call(new Request('http://x/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', name: 'Example' }),
    }), env);

    expect(res.status).toBe(201);
    const json: any = await res.json();
    expect(json.target).toEqual(created);
    expect(env.DB.run).toHaveBeenCalled();
  });

  it('POST /api/targets maps a UNIQUE violation to 409', async () => {
    env.DB.run.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));

    const res = await call(new Request('http://x/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://dup.com' }),
    }), env);

    expect(res.status).toBe(409);
    const json: any = await res.json();
    expect(json.error).toContain('already exists');
  });

  it('GET /api/targets/:id returns 404 when missing', async () => {
    env.DB.first.mockResolvedValueOnce(null);

    const res = await call(new Request('http://x/api/targets/99'), env);

    expect(res.status).toBe(404);
    const json: any = await res.json();
    expect(json.error).toBe('Not found');
  });

  it('DELETE /api/targets/:id acknowledges deletion', async () => {
    const res = await call(new Request('http://x/api/targets/3', { method: 'DELETE' }), env);

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(env.DB.run).toHaveBeenCalled();
  });
});
