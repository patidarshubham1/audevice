'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

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
type DashboardData = { people: Person[]; devices: Device[] };
type EditableDevice = { id: string; name: string; platform: 'Android' | 'iOS'; identifier: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'auadmin@1234';
const SESSION_KEY = 'au-device-access';

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
  return json as DashboardData;
}

export default function Dashboard({ mode }: { mode: 'admin' | 'viewer' }) {
  const router = useRouter();
  const isAdmin = mode === 'admin';
  const [dashboard, setDashboard] = useState<DashboardData>({ people: [], devices: [] });
  const [personName, setPersonName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [platform, setPlatform] = useState<'Android' | 'iOS'>('Android');
  const [selectedPeople, setSelectedPeople] = useState<Record<string, string>>({});
  const [editingDevice, setEditingDevice] = useState<EditableDevice | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const assignedCount = useMemo(
    () => dashboard.devices.filter((device) => device.status === 'assigned').length,
    [dashboard.devices]
  );

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard(successMessage = '') {
    setLoading(true);
    setMessage('');
    try {
      const data = await request('/api/dashboard');
      setDashboard(data);
      setSelectedPeople({});
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
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
      setSelectedPeople({});
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    router.push('/login');
  }

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personName.trim()) return;
    if (await mutate('/api/people', { name: personName }, 'POST', 'Person added.')) setPersonName('');
  }

  async function addDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceName.trim() || !deviceId.trim()) return;
    if (await mutate('/api/devices', { name: deviceName, identifier: deviceId, platform }, 'POST', 'Device added and ready for Select user.')) {
      setDeviceName('');
      setDeviceId('');
      setPlatform('Android');
    }
  }

  function assignDevice(device: Device) {
    const personId = selectedPeople[device.id];
    if (!personId) {
      setMessage('Select a person before assigning the device.');
      return;
    }
    mutate(`/api/devices/${device.id}/assign`, { personId }, 'PATCH', 'Device assigned.');
  }

  function submitDevice(device: Device) {
    mutate(`/api/devices/${device.id}/submit`, {}, 'PATCH', 'Device submitted.');
  }

  function morningRefresh() {
    mutate('/api/dashboard/refresh', {}, 'PATCH', 'Morning refresh complete. Every device is back to Select user.');
  }

  function deletePerson(person: Person) {
    if (confirm(`Delete ${person.name}? Assigned devices will return to Select user.`)) {
      mutate(`/api/people/${person.id}`, {}, 'DELETE', 'Person deleted and assigned devices were released.');
    }
  }

  function startEditDevice(device: Device) {
    setEditingDevice({ id: device.id, name: device.name, platform: device.platform, identifier: device.identifier });
  }

  async function saveDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDevice) return;
    if (!editingDevice.name.trim() || !editingDevice.identifier.trim()) return;
    if (await mutate(`/api/devices/${editingDevice.id}`, editingDevice, 'PATCH', 'Device details updated.')) setEditingDevice(null);
  }

  function deleteDevice(device: Device) {
    if (confirm(`Delete ${device.name}? The assigned person will be free for another device.`)) {
      mutate(`/api/devices/${device.id}`, {}, 'DELETE', 'Device deleted and removed from the list.');
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.singleHeader}>
        <h1>AU Device Assignment Dashboard</h1>
        <div className={styles.headerActions}>
          <span>{isAdmin ? 'Admin' : 'View only'}</span>
          {isAdmin ? <button type="button" onClick={logout}>Logout</button> : <button type="button" onClick={() => router.push('/login')}>Admin login</button>}
        </div>
      </header>

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

      {isAdmin && (
        <section className={styles.manageGrid}>
          <div className={styles.glassPanel}>
            <h2><span className={styles.icon}>🧑</span> Team manage</h2>
            <div className={styles.manageList}>
              {dashboard.people.map((person) => (
                <div className={styles.manageRow} key={person.id}>
                  <strong>{person.name}</strong>
                  <button className={styles.dangerButton} type="button" disabled={loading} onClick={() => deletePerson(person)}>Delete</button>
                </div>
              ))}
              {dashboard.people.length === 0 && <p className={styles.mutedText}>No team members yet.</p>}
            </div>
          </div>

          <div className={styles.glassPanel}>
            <h2><span className={styles.icon}>🛠️</span> Device manage</h2>
            {editingDevice ? (
              <form onSubmit={saveDevice}>
                <div className={styles.inlineFields}>
                  <input value={editingDevice.name} onChange={(event) => setEditingDevice({ ...editingDevice, name: event.target.value })} placeholder="Device name" />
                  <select value={editingDevice.platform} onChange={(event) => setEditingDevice({ ...editingDevice, platform: event.target.value as 'Android' | 'iOS' })}>
                    <option>Android</option>
                    <option>iOS</option>
                  </select>
                </div>
                <input value={editingDevice.identifier} onChange={(event) => setEditingDevice({ ...editingDevice, identifier: event.target.value })} placeholder="Asset ID / serial" />
                <div className={styles.boardActions}>
                  <button disabled={loading}>Save device</button>
                  <button className={styles.secondaryButton} type="button" onClick={() => setEditingDevice(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className={styles.manageList}>
                {dashboard.devices.map((device) => (
                  <div className={styles.manageRow} key={device.id}>
                    <span><strong>{device.name}</strong><small>{device.platform} · {device.identifier}</small></span>
                    <div>
                      <button className={styles.secondaryButton} type="button" disabled={loading} onClick={() => startEditDevice(device)}>Edit</button>
                      <button className={styles.dangerButton} type="button" disabled={loading} onClick={() => deleteDevice(device)}>Delete</button>
                    </div>
                  </div>
                ))}
                {dashboard.devices.length === 0 && <p className={styles.mutedText}>No devices yet.</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {message && <p className={styles.message}>{message}</p>}

      <section className={styles.deviceBoard}>
        <div className={styles.boardHeader}>
          <div>
            <p className={styles.eyebrow}>Device list</p>
            <h2>{isAdmin ? 'Assign, then submit' : 'Current assignment view'}</h2>
          </div>
          <div className={styles.boardActions}>
            {!isAdmin && <span className={styles.readOnly}><span>🔒</span> Read only</span>}
            {isAdmin && <button type="button" onClick={morningRefresh} disabled={loading}>Morning refresh</button>}
            <button type="button" className={styles.secondaryButton} onClick={() => loadDashboard()} disabled={loading}>Reload</button>
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
                {isAdmin && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {dashboard.devices.length === 0 ? (
                <tr>
                  <td className={styles.emptyState} colSpan={isAdmin ? 6 : 5}>No devices yet. Admin can add devices after login.</td>
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
                  {isAdmin && (
                    <td>
                      {device.status === 'assigned' ? (
                        <button className={styles.submitButton} disabled={loading} onClick={() => submitDevice(device)}>Submit</button>
                      ) : (
                        <button disabled={loading || device.status === 'submitted'} onClick={() => assignDevice(device)}>Assign</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.bottomStats}>
        <article><strong>{dashboard.devices.length}</strong><span>Total devices</span></article>
        <article><strong>{dashboard.people.length}</strong><span>Team members</span></article>
        <article><strong>{assignedCount}</strong><span>Currently assigned</span></article>
      </section>
    </main>
  );
}

export { SESSION_KEY, ADMIN_TOKEN };
