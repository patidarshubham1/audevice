import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tempDir = await mkdtemp(path.join(tmpdir(), 'au-device-api-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(tempDir, 'db.json');
process.env.ADMIN_TOKEN = 'test-token';

await writeFile(process.env.DB_PATH, JSON.stringify({
  people: [{ id: 'p1', name: 'Test Person', createdAt: '2026-06-07T08:00:00.000Z' }],
  devices: [{
    id: 'd1',
    name: 'iPhone Test',
    platform: 'iOS',
    identifier: 'IOS-T',
    status: 'available',
    assignedTo: null,
    assignedAt: null,
    submittedAt: null,
    createdAt: '2026-06-07T08:00:00.000Z'
  }]
}, null, 2));

const { server } = await import('./server.js');

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
});

test('dashboard, assignment, and submission flow', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.devices[0].status, 'available');

  const forbidden = await fetch(`${baseUrl}/api/devices/d1/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId: 'p1' })
  });
  assert.equal(forbidden.status, 403);

  const assigned = await fetch(`${baseUrl}/api/devices/d1/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' },
    body: JSON.stringify({ personId: 'p1' })
  });
  assert.equal(assigned.status, 200);
  const assignedPayload = await assigned.json();
  assert.equal(assignedPayload.devices[0].status, 'assigned');
  assert.equal(assignedPayload.devices[0].assignee.name, 'Test Person');

  const submitted = await fetch(`${baseUrl}/api/devices/d1/submit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' },
    body: JSON.stringify({})
  });
  assert.equal(submitted.status, 200);
  const submittedPayload = await submitted.json();
  assert.equal(submittedPayload.devices[0].status, 'submitted');
  assert.ok(submittedPayload.devices[0].submittedAt);
});
