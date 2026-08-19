import { useEffect, useState } from 'react';
import { contractsVersion } from '@wiki/contracts';
import './styles/index.css';
import { ThemeProvider } from './theme';
import { Shell } from './app/Shell';

interface HelloResponse {
  message: string;
  contractsVersion: string;
}

export default function App() {
  const [message, setMessage] = useState('loading…');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/hello')
      .then((res) => res.json() as Promise<HelloResponse>)
      .then((data) => {
        if (!cancelled) setMessage(data.message);
      })
      .catch(() => {
        if (!cancelled) setMessage('failed to reach API');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Zone contents (header/sidebar/toc) are provided by later U* tasks; F5
  // mounts the Shell with empty zones and a placeholder in the content slot.
  return (
    <ThemeProvider>
      <Shell>
        <h1>git-wiki</h1>
        <p>API says: {message}</p>
        <p>Contracts placeholder: {contractsVersion}</p>
      </Shell>
    </ThemeProvider>
  );
}
