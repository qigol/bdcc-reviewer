import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import { App } from './app/App';
import { ModuleStoreProvider } from './modules/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ModuleStoreProvider>
        <App />
      </ModuleStoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
