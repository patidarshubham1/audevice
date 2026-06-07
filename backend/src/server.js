import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readState, updateState } from './store.js';

const PORT = process.env.PORT || 4000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'auadmin@1234';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

function send(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requireAdmin(req) {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    throw Object.assign(new Error('Admin access is required to change assignments.'), { statusCode: 403 });
  }
}

function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function dashboardPayload(state) {
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  return {
    people: state.people,
    devices: state.devices.map((device) => ({
      ...device,
      assignee: device.assignedTo ? peopleById.get(device.assignedTo) || null : null
    }))
  };
}

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, service: 'au-device-assignee-api', time: new Date().toISOString() });
  }
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const state = await readState();
    return send(res, 200, dashboardPayload(state));
  }


  if (req.method === 'PATCH' && url.pathname === '/api/dashboard/refresh') {
    requireAdmin(req);
    const state = await updateState((draft) => {
      draft.devices = draft.devices.map((device) => ({
        ...device,
        status: 'available',
        assignedTo: null,
        assignedAt: null,
        submittedAt: null
      }));
      return draft;
    });
    return send(res, 200, dashboardPayload(state));
  }

  if (req.method === 'POST' && url.pathname === '/api/people') {
    requireAdmin(req);
    const body = await parseBody(req);
    const name = cleanName(body.name);
    if (!name) return send(res, 400, { message: 'Person name is required.' });

    const state = await updateState((draft) => {
      const exists = draft.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
      if (exists) throw Object.assign(new Error('This person already exists.'), { statusCode: 409 });
      draft.people.push({ id: randomUUID(), name, createdAt: new Date().toISOString() });
      return draft;
    });
    return send(res, 201, dashboardPayload(state));
  }

  if (req.method === 'POST' && url.pathname === '/api/devices') {
    requireAdmin(req);
    const body = await parseBody(req);
    const name = cleanName(body.name);
    const platform = cleanName(body.platform || 'Android');
    const identifier = cleanName(body.identifier);
    if (!name || !identifier) return send(res, 400, { message: 'Device name and identifier are required.' });
    if (!['Android', 'iOS'].includes(platform)) return send(res, 400, { message: 'Platform must be Android or iOS.' });

    const state = await updateState((draft) => {
      const exists = draft.devices.some((device) => device.identifier.toLowerCase() === identifier.toLowerCase());
      if (exists) throw Object.assign(new Error('A device with this identifier already exists.'), { statusCode: 409 });
      draft.devices.push({
        id: randomUUID(),
        name,
        platform,
        identifier,
        status: 'available',
        assignedTo: null,
        assignedAt: null,
        submittedAt: null,
        createdAt: new Date().toISOString()
      });
      return draft;
    });
    return send(res, 201, dashboardPayload(state));
  }

  const assignMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/(assign|submit)$/);
  if (req.method === 'PATCH' && assignMatch) {
    requireAdmin(req);
    const [, deviceId, action] = assignMatch;
    const body = await parseBody(req);
    const state = await updateState((draft) => {
      const device = draft.devices.find((item) => item.id === deviceId);
      if (!device) throw Object.assign(new Error('Device not found.'), { statusCode: 404 });

      if (action === 'assign') {
        const person = draft.people.find((item) => item.id === body.personId);
        if (!person) throw Object.assign(new Error('Assignee not found.'), { statusCode: 404 });
        device.assignedTo = person.id;
        device.status = 'assigned';
        device.assignedAt = new Date().toISOString();
        device.submittedAt = null;
        return draft;
      }

      if (device.status !== 'assigned') {
        throw Object.assign(new Error('Only assigned devices can be submitted.'), { statusCode: 400 });
      }
      device.status = 'submitted';
      device.submittedAt = new Date().toISOString();
      return draft;
    });
    return send(res, 200, dashboardPayload(state));
  }

  return send(res, 404, { message: 'Route not found.' });
}

export const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => send(res, error.statusCode || 500, { message: error.message || 'Something went wrong.' }));
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`AU Device Assignee API running on http://localhost:${PORT}`);
  });
}
