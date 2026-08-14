import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';

export default function SupabaseGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
        setSession(nextSession || null);
        setError('');
        setMessage('');
        return;
      }
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setPassword('');
      setError('Correo o contraseña incorrectos.');
    }
  };

  const sendRecovery = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (recoveryError) {
      setError('No pude enviar el correo de recuperación. Inténtalo nuevamente.');
      return;
    }
    setMessage('Te envié un enlace de recuperación. Revisa tu correo y también Spam.');
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError('No pude actualizar la contraseña. Solicita un nuevo enlace de recuperación.');
      return;
    }
    setPassword('');
    setConfirmPassword('');
    setMessage('Contraseña actualizada. Ya puedes continuar.');
    setMode('login');
  };

  if (session === undefined) {
    return <div className="loading-screen"><span className="brand-mark">VX</span><p>Verificando sesión segura…</p></div>;
  }

  if (mode === 'recovery') {
    return <div className="login-page">
      <div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/>
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark">VX</span><div><strong>Vencodex</strong><small>Recuperar acceso</small></div></div>
        <div className="login-copy"><span className="mini-label">✦ NUEVA CONTRASEÑA</span><h1>Recupera tu<br/><span>workspace.</span></h1><p>Define una nueva contraseña para tu cuenta de administración.</p></div>
        <form onSubmit={updatePassword} className="login-form">
          <label>Nueva contraseña<input value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoFocus type="password" autoComplete="new-password" placeholder="••••••••••" required/></label>
          <label>Confirmar contraseña<input value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} type="password" autoComplete="new-password" placeholder="••••••••••" required/></label>
          {error && <div className="login-error">{error}</div>}
          {message && <div className="login-success">{message}</div>}
          <button className="btn btn-primary login-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar nueva contraseña →'}</button>
        </form>
        <p className="login-foot">Recuperación segura mediante Supabase Auth</p>
      </section>
    </div>;
  }

  if (!session) {
    return <div className="login-page">
      <div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/>
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark">VX</span><div><strong>Vencodex</strong><small>Internal workspace</small></div></div>
        <div className="login-copy"><span className="mini-label">✦ WORKSPACE PRIVADO</span><h1>Todo Vencodex,<br/><span>en un solo lugar.</span></h1><p>Proyectos, operación, cobros y equipo protegidos con tu sesión de Supabase.</p></div>
        {mode === 'forgot' ? <form onSubmit={sendRecovery} className="login-form">
          <label>Correo<input value={email} onChange={(e) => { setEmail(e.target.value); setError(''); setMessage(''); }} autoFocus autoComplete="email" type="email" placeholder="tu@correo.com" required/></label>
          {error && <div className="login-error">{error}</div>}
          {message && <div className="login-success">{message}</div>}
          <button className="btn btn-primary login-button" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace →'}</button>
          <button className="login-link" type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>← Volver al login</button>
        </form> : <form onSubmit={login} className="login-form">
          <label>Correo<input value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} autoFocus autoComplete="username" type="email" placeholder="tu@correo.com" required/></label>
          <label>Contraseña<input value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} type="password" autoComplete="current-password" placeholder="••••••••••" required/></label>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary login-button" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar →'}</button>
          <button className="login-link" type="button" onClick={() => { setMode('forgot'); setPassword(''); setError(''); setMessage(''); }}>Olvidé mi contraseña</button>
        </form>}
        <p className="login-foot">Acceso protegido · Supabase Auth + Row Level Security</p>
      </section>
    </div>;
  }

  return children;
}
