import './styles/index.css';
import { useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { DataProvider } from './api/DataProvider';
import { ThemeProvider } from './theme';
import { Shell } from './app/Shell';
import { AppRoutes, routeToDocPath } from './routes';
import type { TocEntry } from './markdown';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toc } from './components/Toc';
import { SearchModal } from './components/SearchModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { useHydrateAuth } from './hooks';

// Inner shell — lives inside DataProvider/Router/Theme so hooks resolve.
function AppShell() {
  // Hydrate the auth store (drives UserChip / canWrite). Reads stay open in v0;
  // the SignInGate/requireRead gate is enabled when SSO is wired for deploy.
  useHydrateAuth();

  const [toc, setToc] = useState<TocEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const docPath = routeToDocPath(useLocation().pathname);

  return (
    <>
      <Shell
        header={
          <Header
            onMenuClick={() => setSidebarOpen(true)}
            onHistoryClick={() => setHistoryOpen(true)}
          />
        }
        sidebar={<Sidebar />}
        toc={<Toc entries={toc} />}
      >
        <AppRoutes onTocChange={setToc} />
      </Shell>

      {/* Mobile off-canvas sidebar drawer (the in-flow column above hides < 768px). */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Global search overlay — renders nothing until the store opens. */}
      <SearchModal />

      {/* Git-history drawer for the current document (opened from the header). */}
      <HistoryDrawer
        isOpen={historyOpen}
        path={docPath}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </BrowserRouter>
    </DataProvider>
  );
}
