'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard, { SESSION_KEY } from './components/Dashboard';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SESSION_KEY) !== 'admin') {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <main className={styles.shell}><p className={styles.message}>Opening dashboard...</p></main>;
  }

  return <Dashboard mode="admin" />;
}
