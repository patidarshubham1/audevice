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

  const refreshed = await fetch(`${baseUrl}/api/dashboard/refresh`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' },
    body: JSON.stringify({})
  });
  assert.equal(refreshed.status, 200);
  const refreshedPayload = await refreshed.json();
  assert.equal(refreshedPayload.devices[0].status, 'available');
  assert.equal(refreshedPayload.devices[0].assignedTo, null);
  assert.equal(refreshedPayload.devices[0].assignedAt, null);
  assert.equal(refreshedPayload.devices[0].submittedAt, null);

  const addedDevice = await fetch(`${baseUrl}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' },
    body: JSON.stringify({ name: 'Pixel Test', platform: 'Android', identifier: 'ANDROID-T' })
  });
  assert.equal(addedDevice.status, 201);
  const addedPayload = await addedDevice.json();
  const newDevice = addedPayload.devices.find((device) => device.identifier === 'ANDROID-T');
  assert.equal(newDevice.status, 'available');
  assert.equal(newDevice.assignedTo, null);

  const editedDevice = await fetch(`${baseUrl}/api/devices/${newDevice.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' },
    body: JSON.stringify({ name: 'Pixel Edited', platform: 'Android', identifier: 'ANDROID-T2' })
  });
  assert.equal(editedDevice.status, 200);
  const editedPayload = await editedDevice.json();
  assert.equal(editedPayload.devices.find((device) => device.id === newDevice.id).name, 'Pixel Edited');

  const assignedAgain = await fetch(`${baseUrl}/api/devices/${newDevice.id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' },
    body: JSON.stringify({ personId: 'p1' })
  });
  assert.equal(assignedAgain.status, 200);

  const deletedPerson = await fetch(`${baseUrl}/api/people/p1`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' }
  });
  assert.equal(deletedPerson.status, 200);
  const deletedPersonPayload = await deletedPerson.json();
  assert.equal(deletedPersonPayload.people.length, 0);
  assert.equal(deletedPersonPayload.devices.find((device) => device.id === newDevice.id).assignedTo, null);

  const deletedDevice = await fetch(`${baseUrl}/api/devices/${newDevice.id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-token' }
  });
  assert.equal(deletedDevice.status, 200);
  const deletedDevicePayload = await deletedDevice.json();
  assert.equal(deletedDevicePayload.devices.some((device) => device.id === newDevice.id), false);

});
