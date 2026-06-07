'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';
import { ADMIN_TOKEN, SESSION_KEY } from '../components/Dashboard';

export default function Login() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (localStorage.getItem(SESSION_KEY) === 'admin') router.replace('/');
  }, [router]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminKey.trim() !== ADMIN_TOKEN) {
      setMessage('Invalid admin key. Please try again or use /view for read-only access.');
      return;
    }
    localStorage.setItem(SESSION_KEY, 'admin');
    router.push('/');
  }

  return (
    <main className={`${styles.shell} ${styles.loginShell}`}>
      <section className={styles.loginCard}>
        <div className={styles.loginIntro}>
          <p className={styles.eyebrow}>AU Device Desk</p>
          <h1>Admin login</h1>
          <p>Admins can add people, add devices, edit or delete devices, refresh assignments, and assign devices.</p>
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
          <p>Users should open /view. No key is needed and action buttons are hidden.</p>
          <button type="button" onClick={() => router.push('/view')}>Open view page</button>
        </aside>
        {message && <p className={styles.message}>{message}</p>}
      </section>
    </main>
  );
}
