import { useEffect, useState } from 'react';
import { contractsVersion } from '@wiki/contracts';

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

  return (
    <main>
      <h1>git-wiki</h1>
      <p>API says: {message}</p>
      <p>Contracts placeholder: {contractsVersion}</p>
    </main>
  );
}
