
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';
import { MonitoredAchievementsProvider } from './contexts/MonitoredAchievementsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <MonitoredAchievementsProvider>
          <App />
        </MonitoredAchievementsProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
