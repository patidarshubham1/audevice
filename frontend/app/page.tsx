'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type Person = { id: string; name: string; createdAt: string };
type Device = {
  id: string;
  name: string;
  platform: 'Android' | 'iOS';
  identifier: string;
  status: 'available' | 'assigned' | 'submitted';
  assignedTo: string | null;
  assignedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  assignee?: Person | null;
};
type Dashboard = { people: Person[]; devices: Device[] };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'auadmin@1234';

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'Request failed');
  return json as Dashboard;
}

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard>({ people: [], devices: [] });
  const [hasEntered, setHasEntered] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [personName, setPersonName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [platform, setPlatform] = useState<'Android' | 'iOS'>('Android');
  const [selectedPeople, setSelectedPeople] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const assignedCount = useMemo(
    () => dashboard.devices.filter((device) => device.status === 'assigned').length,
    [dashboard.devices]
  );

  useEffect(() => {
    if (!hasEntered) return;
    loadDashboard();
  }, [hasEntered]);

  async function loadDashboard() {
    setLoading(true);
    setMessage('');
    try {
      const data = await request('/api/dashboard');
      setDashboard(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = adminKey.trim();
    setHasEntered(true);
    setIsAdmin(key === ADMIN_TOKEN);
    setMessage(key === ADMIN_TOKEN ? 'Admin dashboard unlocked.' : 'Invalid admin key. Continuing with view access only.');
  }

  function enterViewMode() {
    setHasEntered(true);
    setIsAdmin(false);
    setAdminKey('');
    setMessage('View access only.');
  }

  async function mutate(path: string, body: unknown, method = 'POST', successMessage = 'Updated successfully.') {
    setLoading(true);
    setMessage('');
    try {
      const data = await request(path, {
        method,
        body: JSON.stringify(body),
        headers: { 'x-admin-token': ADMIN_TOKEN }
      });
      setDashboard(data);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personName.trim()) return;
    mutate('/api/people', { name: personName }).then(() => setPersonName(''));
  }

  function addDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceName.trim() || !deviceId.trim()) return;
    mutate('/api/devices', { name: deviceName, identifier: deviceId, platform }).then(() => {
      setDeviceName('');
      setDeviceId('');
    });
  }

  function assignDevice(device: Device) {
    const personId = selectedPeople[device.id];
    if (!personId) {
      setMessage('Select a person before assigning the device.');
      return;
    }
    mutate(`/api/devices/${device.id}/assign`, { personId }, 'PATCH');
  }

  function submitDevice(device: Device) {
    mutate(`/api/devices/${device.id}/submit`, {}, 'PATCH');
  }

  function morningRefresh() {
    mutate('/api/dashboard/refresh', {}, 'PATCH', 'Morning refresh complete. Assignments are reset for today.');
  }

  if (!hasEntered) {
    return (
      <main className={`${styles.shell} ${styles.loginShell}`}>
        <section className={styles.loginCard}>
          <div className={styles.loginIntro}>
            <p className={styles.eyebrow}>AU Device Desk</p>
            <h1>Enter admin key</h1>
            <p>Use the admin key to manage devices, or continue from the side with view access only.</p>
          </div>

          <form className={styles.loginForm} onSubmit={login}>
            <input
              autoFocus
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Admin key"
              type="password"
            />
            <button disabled={!adminKey.trim()}>Login</button>
          </form>

          <aside className={styles.viewAccessCard}>
            <span>View access only</span>
            <p>No key is needed to read the device board.</p>
            <button type="button" onClick={enterViewMode}>Continue as viewer</button>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.singleHeader}>
        <h1>AU Device Assignment Dashboard</h1>
        <span>{isAdmin ? 'Admin' : 'View only'}</span>
      </header>

      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.icon}>📱</span> <span>{dashboard.devices.length}</span><p>Total devices</p></article>
        <article className={styles.statCard}><span className={styles.icon}>👥</span> <span>{dashboard.people.length}</span><p>Team members</p></article>
        <article className={styles.statCard}><span className={styles.icon}>⏱️</span> <span>{assignedCount}</span><p>Currently assigned</p></article>
      </section>

      {isAdmin && (
        <section className={styles.formsGrid}>
          <form className={styles.glassPanel} onSubmit={addPerson}>
            <h2><span className={styles.icon}>＋</span> Add person</h2>
            <input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Person name" />
            <button disabled={loading}>Add to list</button>
          </form>

          <form className={styles.glassPanel} onSubmit={addDevice}>
            <h2><span className={styles.icon}>💻</span> Add device</h2>
            <div className={styles.inlineFields}>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Device name" />
              <select value={platform} onChange={(event) => setPlatform(event.target.value as 'Android' | 'iOS')}>
                <option>Android</option>
                <option>iOS</option>
              </select>
            </div>
            <input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="Asset ID / serial" />
            <button disabled={loading}>Add device</button>
          </form>
        </section>
      )}

      {message && <p className={styles.message}>{message}</p>}

      <section className={styles.deviceBoard}>
        <div className={styles.boardHeader}>
          <div>
            <p className={styles.eyebrow}>Device list</p>
            <h2>Assign, then submit</h2>
          </div>
          <div className={styles.boardActions}>
            {!isAdmin && <span className={styles.readOnly}><span>🔒</span> Read only</span>}
            {isAdmin && <button type="button" onClick={morningRefresh} disabled={loading}>Morning refresh</button>}
            <button type="button" className={styles.secondaryButton} onClick={loadDashboard} disabled={loading}>Reload</button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Assign to</th>
                <th>Status</th>
                <th>Assign time</th>
                <th>Submit time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.devices.length === 0 ? (
                <tr>
                  <td className={styles.emptyState} colSpan={6}>No devices yet. Admin can add devices after login.</td>
                </tr>
              ) : dashboard.devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <strong>{device.name}</strong>
                    <span>{device.platform} · {device.identifier}</span>
                  </td>
                  <td>
                    <select
                      disabled={!isAdmin || device.status === 'submitted'}
                      value={selectedPeople[device.id] || device.assignedTo || ''}
                      onChange={(event) => setSelectedPeople((current) => ({ ...current, [device.id]: event.target.value }))}
                    >
                      <option value="">Select user</option>
                      {dashboard.people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}
                    </select>
                    {device.assignee && <small>Assigned to {device.assignee.name}</small>}
                  </td>
                  <td><span className={`${styles.badge} ${styles[device.status]}`}>{device.status}</span></td>
                  <td>{formatTime(device.assignedAt)}</td>
                  <td>{formatTime(device.submittedAt)}</td>
                  <td>
                    {device.status === 'assigned' ? (
                      <button className={styles.submitButton} disabled={!isAdmin || loading} onClick={() => submitDevice(device)}>Submit</button>
                    ) : (
                      <button disabled={!isAdmin || loading || device.status === 'submitted'} onClick={() => assignDevice(device)}>Assign</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
