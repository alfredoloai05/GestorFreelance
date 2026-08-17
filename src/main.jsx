import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SupabaseGate from './SupabaseGate';
import './smartTaskImport';
import './styles.css';
import './enhancements.css';
import './projectPolish.css';
import './companyPolish.css';
import './jarvisPolish.css';
import './calendarPolish.css';
import './projectModalPro.css';
import './taskTablePolish.css';
import './assistantPolish.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SupabaseGate>
      <App />
    </SupabaseGate>
  </React.StrictMode>,
);
