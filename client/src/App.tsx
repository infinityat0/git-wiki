import './styles/index.css';
import { BrowserRouter } from 'react-router-dom';
import { DataProvider } from './api/DataProvider';
import { ThemeProvider } from './theme';
import { Shell } from './app/Shell';
import { AppRoutes } from './routes';

// The Shell's header/sidebar/toc slots are filled by U5/U1/U2 as they land;
// for now the content zone renders the routed DocView (U3).
export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <ThemeProvider>
          <Shell>
            <AppRoutes />
          </Shell>
        </ThemeProvider>
      </BrowserRouter>
    </DataProvider>
  );
}
