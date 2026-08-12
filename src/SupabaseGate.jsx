import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';

export default function SupabaseGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setPassword('');
      setError('Correo o contraseña incorrectos.');
    }
  };

  if (session === undefined) {
    return <div className="loading-screen"><span className="brand-mark">VX</span><p>Verificando sesión segura…</p></div>;
  }

  if (!session) {
    return <div className="login-page">
      <div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/>
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark">VX</span><div><strong>Vencodex</strong><small>Internal workspace</small></div></div>
        <div className="login-copy"><span className="mini-label">✦ WORKSPACE PRIVADO</span><h1>Todo tu trabajo,<br/><span>en un solo lugar.</span></h1><p>Proyectos, finanzas y equipo protegidos con tu sesión de Supabase.</p></div>
        <form onSubmit={submit} className="login-form">
          <label>Correo<input value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} autoFocus autoComplete="username" type="email" placeholder="tu@correo.com" required/></label>
          <label>Contraseña<input value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} type="password" autoComplete="current-password" placeholder="••••••••••" required/></label>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary login-button" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar →'}</button>
        </form>
        <p className="login-foot">Acceso protegido · Supabase Auth + Row Level Security</p>
      </section>
    </div>;
  }

  return children;
}
