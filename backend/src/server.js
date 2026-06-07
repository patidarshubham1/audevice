import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readState, updateState } from './store.js';

const PORT = process.env.PORT || 4000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'auadmin@1234';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

function allowedOrigin(req) {
  const origin = req.headers.origin || FRONTEND_ORIGIN.split(',')[0];
  const allowed = FRONTEND_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : allowed[0];
}

function send(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin(req),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
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

function cleanPlatform(platform) {
  const normalized = cleanName(platform || 'Android');
  if (!['Android', 'iOS'].includes(normalized)) {
    throw Object.assign(new Error('Platform must be Android or iOS.'), { statusCode: 400 });
  }
  return normalized;
}

function resetDeviceAssignment(device) {
  device.status = 'available';
  device.assignedTo = null;
  device.assignedAt = null;
  device.submittedAt = null;
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

  if (req.method === 'OPTIONS') return send(req, res, 204, {});
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(req, res, 200, { ok: true, service: 'au-device-assignee-api', time: new Date().toISOString() });
  }
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const state = await readState();
    return send(req, res, 200, dashboardPayload(state));
  }

  if (req.method === 'PATCH' && url.pathname === '/api/dashboard/refresh') {
    requireAdmin(req);
    const state = await updateState((draft) => {
      draft.devices.forEach(resetDeviceAssignment);
      return draft;
    });
    return send(req, res, 200, dashboardPayload(state));
  }

  if (req.method === 'POST' && url.pathname === '/api/people') {
    requireAdmin(req);
    const body = await parseBody(req);
    const name = cleanName(body.name);
    if (!name) return send(req, res, 400, { message: 'Person name is required.' });

    const state = await updateState((draft) => {
      const exists = draft.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
      if (exists) throw Object.assign(new Error('This person already exists.'), { statusCode: 409 });
      draft.people.push({ id: randomUUID(), name, createdAt: new Date().toISOString() });
      return draft;
    });
    return send(req, res, 201, dashboardPayload(state));
  }

  const personMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
  if (req.method === 'DELETE' && personMatch) {
    requireAdmin(req);
    const [, personId] = personMatch;
    const state = await updateState((draft) => {
      const personIndex = draft.people.findIndex((person) => person.id === personId);
      if (personIndex === -1) throw Object.assign(new Error('Person not found.'), { statusCode: 404 });
      draft.people.splice(personIndex, 1);
      draft.devices.forEach((device) => {
        if (device.assignedTo === personId) resetDeviceAssignment(device);
      });
      return draft;
    });
    return send(req, res, 200, dashboardPayload(state));
  }

  if (req.method === 'POST' && url.pathname === '/api/devices') {
    requireAdmin(req);
    const body = await parseBody(req);
    const name = cleanName(body.name);
    const platform = cleanPlatform(body.platform);
    const identifier = cleanName(body.identifier);
    if (!name || !identifier) return send(req, res, 400, { message: 'Device name and identifier are required.' });

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
    return send(req, res, 201, dashboardPayload(state));
  }

  const deviceMatch = url.pathname.match(/^\/api\/devices\/([^/]+)$/);
  if ((req.method === 'PATCH' || req.method === 'DELETE') && deviceMatch) {
    requireAdmin(req);
    const [, deviceId] = deviceMatch;
    const body = req.method === 'PATCH' ? await parseBody(req) : {};
    const name = cleanName(body.name);
    const identifier = cleanName(body.identifier);
    const platform = req.method === 'PATCH' ? cleanPlatform(body.platform) : 'Android';
    if (req.method === 'PATCH' && (!name || !identifier)) {
      return send(req, res, 400, { message: 'Device name and identifier are required.' });
    }

    const state = await updateState((draft) => {
      const deviceIndex = draft.devices.findIndex((item) => item.id === deviceId);
      if (deviceIndex === -1) throw Object.assign(new Error('Device not found.'), { statusCode: 404 });

      if (req.method === 'DELETE') {
        draft.devices.splice(deviceIndex, 1);
        return draft;
      }

      const duplicate = draft.devices.some(
        (device) => device.id !== deviceId && device.identifier.toLowerCase() === identifier.toLowerCase()
      );
      if (duplicate) throw Object.assign(new Error('A device with this identifier already exists.'), { statusCode: 409 });
      draft.devices[deviceIndex] = { ...draft.devices[deviceIndex], name, platform, identifier };
      return draft;
    });
    return send(req, res, 200, dashboardPayload(state));
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
        draft.devices.forEach((item) => {
          if (item.id !== deviceId && item.assignedTo === person.id) resetDeviceAssignment(item);
        });
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
    return send(req, res, 200, dashboardPayload(state));
  }

  return send(req, res, 404, { message: 'Route not found.' });
}

export const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => send(req, res, error.statusCode || 500, { message: error.message || 'Something went wrong.' }));
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`AU Device Assignee API running on http://localhost:${PORT}`);
  });
}
