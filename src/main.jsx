import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SupabaseGate from './SupabaseGate';
import './styles.css';
import './enhancements.css';
import './projectPolish.css';
import './FinancePortal';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SupabaseGate>
      <App />
    </SupabaseGate>
  </React.StrictMode>,
);
