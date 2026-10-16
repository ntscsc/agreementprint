import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonObject } from '../lib/api-input.ts';

test('JSON input limits streamed bytes, including requests without Content-Length', async () => {
  const valid = new Request('https://example.test', { method: 'POST', body: JSON.stringify({ message: 'தமிழ்' }) });
  assert.deepEqual(await readJsonObject(valid), { message: 'தமிழ்' });
  const oversized = new Request('https://example.test', { method: 'POST', body: JSON.stringify({ message: 'x'.repeat(65536) }) });
  await assert.rejects(readJsonObject(oversized), (error: any) => error.status === 413);
  for (const body of ['{', '[]', 'null', '"string"']) {
    await assert.rejects(readJsonObject(new Request('https://example.test', { method: 'POST', body })), (error: any) => error.status === 400);
  }
});
import { readApiResponse } from '../lib/api-response.ts';

test('HTML hosting failures show an availability error without exposing response content', async () => {
  await assert.rejects(readApiResponse(new Response('<!DOCTYPE html><p>private server details</p>', { status: 500, headers: { 'Content-Type': 'text/html' } })), error => {
    assert.match((error as Error).message, /temporarily unavailable.*HTTP 500/);
    assert.doesNotMatch((error as Error).message, /private server details|Unexpected token/);
    return true;
  });
});

test('JSON responses preserve API errors and successful data', async () => {
  assert.deepEqual(await readApiResponse(Response.json({ requests: [] })), { requests: [] });
  await assert.rejects(readApiResponse(Response.json({ error: 'Sign in again to continue.' }, { status: 401 })), /Sign in again/);
  await assert.rejects(readApiResponse(new Response('invalid', { headers: { 'Content-Type': 'application/json' } })), /temporarily unavailable/);
  await assert.rejects(readApiResponse(Response.json(null)), /temporarily unavailable/);
});
