import { describe, expect, it, vi } from 'vitest';
import { API_ROUTES } from '@wiki/contracts';
import type { ApiError, DocResponse, TreeResponse } from '@wiki/contracts';
import { createApiClient, type FetchLike } from './client';
import { ApiClientError } from './errors';

/** Build a stub `fetch` that resolves with the given status + JSON body. */
function stubFetch(status: number, body: unknown): FetchLike {
  return vi.fn(
    async () =>
      new Response(body === undefined ? '' : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('apiClient — success paths', () => {
  it('returns the typed tree payload on 200', async () => {
    const tree: TreeResponse = [
      { name: 'a.md', path: 'a.md', title: 'A', type: 'file' },
    ];
    const client = createApiClient(stubFetch(200, tree));
    await expect(client.getTree()).resolves.toEqual(tree);
  });

  it('builds the doc URL with an encoded ?path= query', async () => {
    const doc: DocResponse = {
      path: 'guide/intro.md',
      content: '# hi',
      lastModified: '2026-08-18T05:22:15Z',
    };
    const fetchImpl = stubFetch(200, doc);
    const client = createApiClient(fetchImpl);

    await client.getDoc('guide/intro.md');

    expect(fetchImpl).toHaveBeenCalledWith(
      `${API_ROUTES.doc}?path=guide%2Fintro.md`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('sends a JSON body + content-type on POST (devLogin)', async () => {
    const fetchImpl = stubFetch(200, {
      success: true,
      user: { name: 'Dev', email: 'd@e.com', provider: 'dev', canWrite: true },
    });
    const client = createApiClient(fetchImpl);

    await client.devLogin({ username: 'dev', password: 'pw' });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ username: 'dev', password: 'pw' }),
    });
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });
});

describe('apiClient — ApiError mapping (features spec §10)', () => {
  it('maps a NOT_FOUND envelope to ApiClientError with code + status', async () => {
    const envelope: ApiError = {
      error: { code: 'NOT_FOUND', message: 'No such doc' },
    };
    const client = createApiClient(stubFetch(404, envelope));

    await expect(client.getDoc('missing.md')).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'NOT_FOUND',
      status: 404,
      message: 'No such doc',
    });
  });

  it('preserves each contract error code', async () => {
    const client = createApiClient(
      stubFetch(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    );
    const err = await client.getTree().catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('falls back to INTERNAL when the body is not a contract envelope', async () => {
    const client = createApiClient(stubFetch(500, { unexpected: 'shape' }));
    await expect(client.getHealth()).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 500,
    });
  });

  it('maps a rejected transport (network failure) to INTERNAL/status 0', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = createApiClient(fetchImpl);
    await expect(client.getTree()).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 0,
      message: 'Failed to fetch',
    });
  });
});
