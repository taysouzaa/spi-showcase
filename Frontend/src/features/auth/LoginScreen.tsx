import { useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { buildApiUrl, pingBackend } from '../../shared/services/api';

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;

interface LoginScreenProps {
  onEnter: () => void;
  onRegister?: () => void;
  onBack?: () => void;
}

type Mode = 'login' | 'register';

const MARKETPLACE_OPTIONS = [
  { value: 'amazon',        label: 'Amazon' },
  { value: 'mercadolivre',  label: 'Mercado Livre' },
  { value: 'shopee',        label: 'Shopee' },
  { value: 'magazineluiza', label: 'Magazine Luiza' },
  { value: 'shein',         label: 'Shein' },
  { value: 'tiktok',        label: 'TikTok Shop' },
  { value: 'outros',        label: 'Outros' },
];

export function LoginScreen({ onEnter }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const loginRequestLockRef = useRef(false);
  const registerRequestLockRef = useRef(false);

  // ── Login ──────────────────────────────────────────────────────────────────
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]     = useState('');

  // ── Register ───────────────────────────────────────────────────────────────
  const [regName, setRegName]                   = useState('');
  const [regPhone, setRegPhone]                 = useState('');
  const [regConfirmPhone, setRegConfirmPhone]   = useState('');
  const [regEmail, setRegEmail]                 = useState('');
  const [regMarketplace, setRegMarketplace]     = useState('');
  const [regLoading, setRegLoading]             = useState(false);
  const [regError, setRegError]                 = useState('');
  const [regDone, setRegDone]                   = useState(false);
  const [focusedField, setFocusedField]         = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setLoginError('');
    setRegError('');
    setRegDone(false);
  };

  const handleLogin = async () => {
    if (loginRequestLockRef.current || loginLoading) return;
    if (!email || !phone) { setLoginError('Preencha e-mail e telefone para continuar.'); return; }
    loginRequestLockRef.current = true;
    setLoginLoading(true);
    setLoginError('');
    const backendOk = await pingBackend();
    if (!backendOk) {
      setLoginError('Não foi possível conectar ao servidor. Tente novamente.');
      setLoginLoading(false);
      loginRequestLockRef.current = false;
      return;
    }
    try {
      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, phone }),
      });
      const data = await response.json().catch(() => ({} as { error?: string; user?: unknown }));
      if (response.ok) {
        // Tokens chegam via cookie httpOnly — não armazenar em localStorage.
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Bem-vindo de volta!');
        onEnter();
      } else {
        const msg = response.status === 429
          ? (data.error || 'Muitas tentativas de acesso.')
          : (data.error || 'E-mail ou telefone incorretos.');
        setLoginError(msg);
        toast.error(msg);
      }
    } catch {
      setLoginError('Erro ao conectar com o servidor.');
    } finally {
      loginRequestLockRef.current = false;
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (registerRequestLockRef.current || regLoading) return;
    setRegError('');
    if (!regName.trim() || !regPhone.trim() || !regConfirmPhone.trim() || !regEmail.trim() || !regMarketplace) {
      setRegError('Preencha todos os campos obrigatórios.');
      return;
    }
    const digitsOnly = (v: string) => v.replace(/\D/g, '');
    if (digitsOnly(regPhone) !== digitsOnly(regConfirmPhone)) {
      setRegError('Os telefones não coincidem. Verifique e tente novamente.');
      return;
    }
    registerRequestLockRef.current = true;
    setRegLoading(true);
    const backendOk = await pingBackend();
    if (!backendOk) {
      setRegError('Não foi possível conectar ao servidor.');
      setRegLoading(false);
      registerRequestLockRef.current = false;
      return;
    }
    try {
      const response = await fetch(buildApiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          phone: regPhone,
          confirmPhone: regConfirmPhone,
          email: regEmail.trim(),
          marketplace: regMarketplace,
        }),
      });
      const data = await response.json().catch(() => ({} as { error?: string }));
      if (response.ok) {
        setRegDone(true);
        toast.success('Cadastro realizado! Agora é só entrar.');
        // Captura lead no n8n (fire-and-forget)
        const webhookUrl = N8N_WEBHOOK_URL;
        if (webhookUrl) {
          const params = new URLSearchParams(window.location.search);
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: regName.trim(),
              email: regEmail.trim(),
              phone: regPhone,
              marketplace: regMarketplace,
              channel:  params.get('channel')  || '',
              source:   params.get('utm_source')   || '',
              medium:   params.get('utm_medium')   || '',
              campaign: params.get('utm_campaign') || '',
              content:  params.get('utm_content')  || '',
              referrer: document.referrer || '',
              pageUrl:  window.location.href,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      } else {
        const message = response.status === 409
          ? 'Este e-mail já está cadastrado. Use a tela de acesso.'
          : (data.error || 'Erro ao realizar cadastro.');
        setRegError(message);
        toast.error(message);
      }
    } catch {
      setRegError('Erro ao conectar com o servidor.');
    } finally {
      registerRequestLockRef.current = false;
      setRegLoading(false);
    }
  };

  const fieldStyle = (field: string): React.CSSProperties => ({
    backgroundColor: 'rgba(8,12,16,0.85)',
    border: `1px solid ${focusedField === field ? 'rgba(124,255,78,0.5)' : 'rgba(255,255,255,0.14)'}`,
    boxShadow: focusedField === field ? '0 0 0 3px rgba(124,255,78,0.08)' : 'none',
    color: 'var(--text-strong)',
    padding: '12px 14px',
    width: '100%',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '6px',
  };

  return (
    <div className="app-shell app-grid min-h-screen w-full flex flex-col">

      <div className="flex-1 flex items-stretch">

        {/* ── Painel esquerdo — apenas desktop ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="hidden lg:flex flex-col justify-center"
          style={{
            width: '58%',
            paddingLeft: '15%',
            paddingRight: '4%',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ width: 'fit-content' }} className="app-badge mb-8">Multi-Marketplace</div>

          <h1
            style={{
              fontSize: 'clamp(40px, 4.5vw, 72px)',
              fontWeight: 800,
              color: 'var(--text-strong)',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              margin: '0 0 24px',
            }}
          >
            Sistema de<br />
            Processamento de<br />
            <span style={{ color: 'var(--brand)', fontStyle: 'italic' }}>Imagens.</span>
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, maxWidth: '400px', margin: 0 }}>
            Selecione o marketplace, defina as dimensões e envie múltiplas imagens para processamento em lote com padrão profissional.
          </p>
        </motion.div>

        {/* ── Painel direito — full-screen em mobile ───────────────────────── */}
        <div className="w-full lg:w-[42%] flex flex-col items-center justify-center lg:items-start lg:justify-center px-4 sm:px-8 py-10 lg:py-0 lg:pl-[4%] lg:pr-[6%]">

          {/* Marca — visível apenas em mobile (desktop usa o painel esquerdo) */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:hidden w-full mb-6"
            style={{ maxWidth: '400px' }}
          >
            <div style={{ width: 'fit-content' }} className="app-badge mb-3">Multi-Marketplace</div>
            <h1
              style={{
                fontSize: 'clamp(22px, 6vw, 30px)',
                fontWeight: 800,
                color: 'var(--text-strong)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Processamento de{' '}
              <span style={{ color: 'var(--brand)', fontStyle: 'italic' }}>Imagens.</span>
            </h1>
          </motion.div>

          <motion.div
            layout
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
            className="card-blur rounded-2xl w-full p-6 sm:p-8"
            style={{ maxWidth: '400px' }}
          >
            <AnimatePresence mode="wait">

              {/* ── LOGIN ─────────────────────────────────────────────────── */}
              {mode === 'login' && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 style={{ color: 'var(--text-strong)', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
                    Acesse sua conta
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 24px' }}>
                    Entre com suas credenciais para continuar
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      onFocus={() => setFocusedField('login-email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="seu@email.com"
                      style={fieldStyle('login-email')}
                    />
                  </div>

                  <div style={{ marginBottom: '22px' }}>
                    <label style={labelStyle}>Telefone</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPhone ? 'tel' : 'password'}
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        onFocus={() => setFocusedField('login-phone')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="(11) 99999-9999"
                        style={{ ...fieldStyle('login-phone'), paddingRight: '44px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPhone(v => !v)}
                        aria-label={showPhone ? 'Ocultar telefone' : 'Mostrar telefone'}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                        tabIndex={-1}
                      >
                        {showPhone ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {loginError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 14 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px', display: 'flex', gap: '8px', overflow: 'hidden' }}
                      >
                        <span>✕</span><span>{loginError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    onClick={handleLogin}
                    disabled={loginLoading}
                    whileHover={{ scale: loginLoading ? 1 : 1.02 }}
                    whileTap={{ scale: loginLoading ? 1 : 0.98 }}
                    className="btn-primary w-full rounded-lg text-sm font-bold uppercase flex items-center justify-center gap-2 mb-4"
                    style={{ letterSpacing: '0.12em', cursor: loginLoading ? 'not-allowed' : 'pointer', opacity: loginLoading ? 0.7 : 1, color: 'var(--brand-dark)' }}
                  >
                    {loginLoading ? <><Loader2 size={15} className="animate-spin" /> Conectando...</> : 'Acessar Plataforma'}
                  </motion.button>

                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    Não tem acesso?{' '}
                    <button
                      onClick={() => switchMode('register')}
                      style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '13px' }}
                    >
                      Quero ter acesso
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── CADASTRO ──────────────────────────────────────────────── */}
              {mode === 'register' && !regDone && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={() => switchMode('login')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '18px' }}
                  >
                    <ArrowLeft size={14} /> Voltar para o acesso
                  </button>

                  <h2 style={{ color: 'var(--text-strong)', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
                    Quero ter acesso
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px' }}>
                    Preencha os dados abaixo para criar sua conta.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {([
                      { label: 'Nome', field: 'name',         type: 'text',  value: regName,         set: setRegName,         placeholder: 'Seu nome completo' },
                      { label: 'Telefone', field: 'phone',    type: 'tel',   value: regPhone,        set: setRegPhone,        placeholder: '(11) 99999-9999' },
                      { label: 'Confirmar telefone', field: 'confirmPhone', type: 'tel', value: regConfirmPhone, set: setRegConfirmPhone, placeholder: '(11) 99999-9999' },
                      { label: 'E-mail', field: 'email',      type: 'email', value: regEmail,        set: setRegEmail,        placeholder: 'seu@email.com' },
                    ] as const).map(({ label, field, type, value, set, placeholder }) => (
                      <div key={field}>
                        <label style={labelStyle}>{label}</label>
                        <input
                          type={type}
                          value={value}
                          onChange={e => set(e.target.value)}
                          onFocus={() => setFocusedField(field)}
                          onBlur={() => setFocusedField(null)}
                          onKeyDown={e => e.key === 'Enter' && handleRegister()}
                          placeholder={placeholder}
                          style={fieldStyle(field)}
                        />
                      </div>
                    ))}

                    <div>
                      <label style={labelStyle}>Marketplace</label>
                      <select
                        value={regMarketplace}
                        onChange={e => setRegMarketplace(e.target.value)}
                        onFocus={() => setFocusedField('marketplace')}
                        onBlur={() => setFocusedField(null)}
                        style={{
                          ...fieldStyle('marketplace'),
                          color: regMarketplace ? 'var(--text-strong)' : 'var(--text-muted)',
                          appearance: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled style={{ backgroundColor: '#0b141c' }}>Selecione um marketplace</option>
                        {MARKETPLACE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} style={{ backgroundColor: '#0b141c', color: '#fff' }}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <AnimatePresence>
                    {regError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px', display: 'flex', gap: '8px', overflow: 'hidden' }}
                      >
                        <span>✕</span><span>{regError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    onClick={handleRegister}
                    disabled={regLoading}
                    whileHover={{ scale: regLoading ? 1 : 1.02 }}
                    whileTap={{ scale: regLoading ? 1 : 0.98 }}
                    className="btn-primary w-full rounded-lg text-sm font-bold uppercase flex items-center justify-center gap-2"
                    style={{ letterSpacing: '0.12em', cursor: regLoading ? 'not-allowed' : 'pointer', opacity: regLoading ? 0.7 : 1, color: 'var(--brand-dark)', marginTop: '18px' }}
                  >
                    {regLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Criando acesso...</>
                      : <>Criar acesso <ArrowRight size={14} /></>}
                  </motion.button>
                </motion.div>
              )}

              {/* ── SUCESSO ───────────────────────────────────────────────── */}
              {mode === 'register' && regDone && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ textAlign: 'center' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(124,255,78,0.12)', border: '1px solid rgba(124,255,78,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={24} style={{ color: 'var(--brand)' }} />
                    </div>
                  </div>
                  <h2 style={{ color: 'var(--text-strong)', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
                    Cadastro realizado!
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 24px' }}>
                    Seu acesso foi criado. Use seu e-mail e telefone para entrar na plataforma.
                  </p>
                  <motion.button
                    onClick={() => switchMode('login')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary w-full rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                    style={{ color: 'var(--brand-dark)' }}
                  >
                    Ir para o acesso <ArrowRight size={14} />
                  </motion.button>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>
      </div>

    </div>
  );
}
