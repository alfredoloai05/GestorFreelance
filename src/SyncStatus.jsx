import React, { useEffect, useState } from 'react';

const copy = {
  synced: ['Sincronizado', 'Tus cambios están guardados en Supabase.'],
  pending: ['Cambios pendientes', 'Preparando la sincronización…'],
  saving: ['Guardando', 'Enviando tus cambios a Supabase…'],
  error: ['Error de sincronización', 'No pude confirmar el guardado. Revisa tu conexión.'],
};

export default function SyncStatus() {
  const [status, setStatus] = useState('synced');
  useEffect(() => {
    const handler = (event) => setStatus(event.detail || 'synced');
    window.addEventListener('vencodex-sync-status', handler);
    return () => window.removeEventListener('vencodex-sync-status', handler);
  }, []);
  const [title, detail] = copy[status] || copy.synced;
  return <div className={`sync-card ${status}`}><strong><i/>{title}</strong><p>{detail}</p></div>;
}
