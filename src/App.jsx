import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { authAPI, customerAPI, txnAPI, paymentAPI } from './api.js';
import { fmt, fmtDate, todayStr, txnTotal, exportCSV, downloadExcel, downloadPDF } from './utils.js';

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════ */
const C = {
  bg: '#f0f2f8', surface: '#ffffff', nav: '#0f172a',
  primary: '#3b6ef5', primaryDark: '#2952d9',
  success: '#10b981', danger: '#ef4444', warning: '#f59e0b', purple: '#7c3aed',
  text: '#0f172a', mid: '#475569', light: '#94a3b8', border: '#e2e8f0', hover: '#f1f5fd',
};

const IS = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: `1.5px solid ${C.border}`, fontSize: 14,
  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500,
  color: C.text, background: '#fafbff', boxSizing: 'border-box',
  transition: 'border 0.18s, box-shadow 0.18s',
};

const ITEM_NAMES = ['LLDPE Granules', 'HDPE Granules', 'LD Granules', 'Others'];
const PAY_MODES  = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Hawala', 'Other'];

/* ═══════════════════════════════════════════════════
   AUTH CONTEXT
═══════════════════════════════════════════════════ */
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem('lp_user')); } catch { return null; } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('lp_token');
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then((r) => { setUser(r.data.user); localStorage.setItem('lp_user', JSON.stringify(r.data.user)); })
      .catch(() => { localStorage.removeItem('lp_token'); localStorage.removeItem('lp_user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('lp_token', token);
    localStorage.setItem('lp_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('lp_token');
    localStorage.removeItem('lp_user');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

/* ═══════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════ */
function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

/* ═══════════════════════════════════════════════════
   UI PRIMITIVES
═══════════════════════════════════════════════════ */
function Toast({ toasts }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ position:'fixed', bottom: isMobile?76:24, right: isMobile?10:24, left: isMobile?10:'auto', zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type==='error'?'#fee2e2':t.type==='warning'?'#fef3c7':'#dcfce7',
          color: t.type==='error'?'#991b1b':t.type==='warning'?'#92400e':'#166534',
          border:`1px solid ${t.type==='error'?'#fca5a5':t.type==='warning'?'#fcd34d':'#86efac'}`,
          borderRadius:12, padding:'12px 18px', fontWeight:600, fontSize:14,
          boxShadow:'0 8px 30px rgba(0,0,0,0.15)', animation:'slideInRight 0.3s ease',
          display:'flex', alignItems:'center', gap:8,
        }}>
          {t.type==='error'?'✗':t.type==='warning'?'⚠':'✓'} {t.msg}
        </div>
      ))}
    </div>
  );
}

function Spinner({ size = 20, color = C.primary }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', border:`2.5px solid ${color}30`, borderTopColor:color, animation:'spin 0.7s linear infinite', flexShrink:0 }} />
  );
}

function Btn({ children, onClick, variant='primary', size='md', style:s={}, disabled, loading, fullWidth }) {
  const V = {
    primary:      { background:`linear-gradient(135deg,${C.primary},${C.primaryDark})`, color:'#fff', boxShadow:'0 3px 14px rgba(59,110,245,0.35)' },
    success:      { background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', boxShadow:'0 3px 14px rgba(16,185,129,0.3)' },
    danger:       { background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', boxShadow:'0 3px 14px rgba(239,68,68,0.3)' },
    warning:      { background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', boxShadow:'0 3px 14px rgba(245,158,11,0.25)' },
    ghost:        { background:'#f1f5f9', color:C.mid, boxShadow:'none' },
    outlineLight: { background:'rgba(255,255,255,0.1)', color:'#cbd5e1', border:'1px solid rgba(255,255,255,0.2)', boxShadow:'none' },
  };
  const isDisabled = disabled || loading;
  return (
    <button onClick={isDisabled?undefined:onClick} disabled={isDisabled} style={{
      border:'none', borderRadius:10, fontWeight:600, cursor:isDisabled?'not-allowed':'pointer',
      transition:'all 0.18s', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
      fontFamily:"'Plus Jakarta Sans',sans-serif", opacity:isDisabled?0.6:1,
      fontSize:size==='sm'?12.5:size==='xs'?11.5:14,
      padding:size==='sm'?'7px 13px':size==='xs'?'5px 10px':'10px 20px',
      whiteSpace:'nowrap', width:fullWidth?'100%':'auto',
      ...V[variant], ...s,
    }}
      onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.transform='translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform='translateY(0)'; }}
    >
      {loading ? <Spinner size={14} color='currentColor' /> : null}
      {children}
    </button>
  );
}

function Field({ label, children, required, error }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontWeight:600, fontSize:12.5, color:C.mid, marginBottom:6, letterSpacing:'0.03em' }}>
        {label}{required && <span style={{ color:C.danger }}> *</span>}
      </label>
      {children}
      {error && <div style={{ color:C.danger, fontSize:12, marginTop:4, fontWeight:600 }}>⚠ {error}</div>}
    </div>
  );
}

function Modal({ title, onClose, children, width=520 }) {
  const isMobile = useIsMobile();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key==='Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow=prev; window.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div onClick={(e) => e.target===e.currentTarget && onClose()} style={{
      position:'fixed', inset:0, background:'rgba(10,14,30,0.65)', backdropFilter:'blur(6px)',
      zIndex:1000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:16,
    }}>
      <div style={{
        background:C.surface, borderRadius:isMobile?'20px 20px 0 0':18,
        width:'100%', maxWidth:isMobile?'100%':width, maxHeight:isMobile?'92vh':'90vh',
        overflowY:'auto', boxShadow:'0 30px 80px rgba(0,0,0,0.35)',
        animation:isMobile?'slideUp 0.3s ease':'popIn 0.22s ease',
      }}>
        {isMobile && <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}><div style={{ width:40, height:4, background:'#dde1f0', borderRadius:99 }} /></div>}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px 16px', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, background:C.surface, zIndex:1, borderRadius:isMobile?'20px 20px 0 0':'18px 18px 0 0' }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background:'#f1f5f9', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:20, color:C.mid, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div style={{ padding:'20px 22px 28px' }}>{children}</div>
      </div>
    </div>
  );
}

function Confirm({ msg, onYes, onNo, dangerous=true }) {
  return (
    <Modal title="⚠️ Confirm" onClose={onNo} width={380}>
      <p style={{ color:C.mid, marginBottom:24, lineHeight:1.7, fontSize:15 }}>{msg}</p>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <Btn variant="ghost" onClick={onNo}>Cancel</Btn>
        <Btn variant={dangerous?'danger':'primary'} onClick={onYes}>Confirm</Btn>
      </div>
    </Modal>
  );
}

function StatCard({ label, value, icon, color=C.primary, small }) {
  const len = String(value).length;
  let fs;
  if (small) { fs = len<=8?16:len<=11?14:len<=14?12:11; }
  else       { fs = len<=10?22:len<=14?18:15; }
  return (
    <div style={{ background:C.surface, borderRadius:14, padding:small?'11px 11px':'18px 20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:small?9:14, minWidth:0, flex:small?'1 1 calc(50% - 6px)':'1 1 180px' }}>
      {icon && <div style={{ width:small?34:46, height:small?34:46, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:small?17:22, flexShrink:0 }}>{icon}</div>}
      <div style={{ minWidth:0, flex:1, overflow:'hidden' }}>
        <div style={{ fontSize:small?9.5:11, color:C.light, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
        <div style={{ fontSize:fs, fontWeight:800, color, lineHeight:1.3, marginTop:2, whiteSpace:'nowrap', overflow:'visible' }}>{value}</div>
      </div>
    </div>
  );
}

function BalanceBadge({ balance }) {
  const st = { fontWeight:800, whiteSpace:'nowrap', fontSize:14 };
  if (balance > 0) return <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}><span style={{ ...st, color:C.danger }}>₹{fmt(balance)}</span><span style={{ fontSize:11, background:'#fee2e2', color:'#991b1b', padding:'2px 8px', borderRadius:99, fontWeight:700, flexShrink:0 }}>DUE</span></div>;
  if (balance < 0) return <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}><span style={{ ...st, color:C.purple }}>₹{fmt(Math.abs(balance))}</span><span style={{ fontSize:11, background:'#ede9fe', color:'#6d28d9', padding:'2px 8px', borderRadius:99, fontWeight:700, flexShrink:0 }}>ADVANCE</span></div>;
  return <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ ...st, color:C.success }}>₹0.00</span><span style={{ fontSize:11, background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>CLEAR</span></div>;
}

/* ═══════════════════════════════════════════════════
   AUTH PAGES
═══════════════════════════════════════════════════ */
function AuthLayout({ children, title, subtitle }) {
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:460, animation:'popIn 0.3s ease' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, background:'linear-gradient(135deg,#3b6ef5,#7c3aed)', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:12 }}>📒</div>
          <h1 style={{ fontSize:26, fontWeight:800, color:'#f1f5f9', margin:0, letterSpacing:'-0.03em' }}>LedgerPro</h1>
          <p style={{ color:'#64748b', fontSize:13, margin:'4px 0 0' }}>Customer Ledger Manager</p>
        </div>
        <div style={{ background:'#fff', borderRadius:20, padding:'32px 32px 28px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }}>
          <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:C.text }}>{title}</h2>
          {subtitle && <p style={{ margin:'0 0 24px', color:C.mid, fontSize:14 }}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}



// ── PASSWORD INPUT with show/hide toggle ──
function PasswordInput({ value, onChange, placeholder = 'Password', autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <input
        style={{ ...IS, paddingRight:44 }}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
          background:'none', border:'none', cursor:'pointer', padding:4,
          color:C.light, fontSize:16, display:'flex', alignItems:'center',
        }}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

// ── REGISTER PAGE ──
function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name:'', email:'', password:'', businessName:'' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const r = await authAPI.register(form);
      // Immediately log in — no email verification needed
      login(r.data.token, r.data.user);
      navigate('/', { replace: true });
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Create account" subtitle="Start managing your customer ledger">
      {err && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:9, marginBottom:16, fontSize:13, fontWeight:600 }}>⚠ {err}</div>}
      <form onSubmit={submit}>
        <Field label="Full Name" required>
          <input style={IS} value={form.name} onChange={set('name')} placeholder="Ragnesh Kumar" required autoFocus />
        </Field>
        <Field label="Email Address" required>
          <input style={IS} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
        </Field>
        <Field label="Password" required>
          <PasswordInput value={form.password} onChange={set('password')} placeholder="Min. 6 characters" />
        </Field>
        <Field label="Business Name (optional)">
          <input style={IS} value={form.businessName} onChange={set('businessName')} placeholder="e.g. Dadhania Polymers" />
        </Field>
        <Btn variant="primary" fullWidth loading={loading} onClick={submit} style={{ marginTop:8, padding:'13px 20px', fontSize:15 }}>
          Create Account &amp; Sign In
        </Btn>
      </form>
      <p style={{ textAlign:'center', marginTop:20, color:C.mid, fontSize:14 }}>
        Already have an account?{' '}
        <span onClick={() => navigate('/login')} style={{ color:C.primary, fontWeight:700, cursor:'pointer' }}>Sign in</span>
      </p>
    </AuthLayout>
  );
}

// ── LOGIN PAGE ──
function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm]   = useState({ email:'', password:'' });
  const [loading, setL]   = useState(false);
  const [err, setErr]     = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setL(true);
    try {
      const r = await authAPI.login(form);
      login(r.data.token, r.data.user);
      navigate('/', { replace: true });
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Login failed');
    } finally { setL(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your LedgerPro account">
      {err && (
        <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:9, marginBottom:16, fontSize:13, fontWeight:600 }}>
          ⚠ {err}
        </div>
      )}
      <form onSubmit={submit}>
        <Field label="Email Address" required>
          <input style={IS} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required autoFocus />
        </Field>
        <Field label="Password" required>
          <PasswordInput value={form.password} onChange={set('password')} placeholder="Your password" />
        </Field>
        <Btn variant="primary" fullWidth loading={loading} onClick={submit} style={{ padding:'13px 20px', fontSize:15, marginTop:16 }}>
          Sign In
        </Btn>
      </form>
      <p style={{ textAlign:'center', marginTop:20, color:C.mid, fontSize:14 }}>
        No account?{' '}
        <span onClick={() => navigate('/register')} style={{ color:C.primary, fontWeight:700, cursor:'pointer' }}>Create one free</span>
      </p>
    </AuthLayout>
  );
}

// ── CHANGE PASSWORD MODAL ──
function ChangePasswordModal({ onClose, toast }) {
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [loading, setL] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setErr('');
    if (form.newPassword !== form.confirmPassword) { setErr('New passwords do not match'); return; }
    if (form.newPassword.length < 6) { setErr('New password must be at least 6 characters'); return; }
    setL(true);
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast('Password changed successfully!');
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Failed to change password');
    } finally { setL(false); }
  };

  return (
    <Modal title="🔑 Change Password" onClose={onClose} width={420}>
      {err && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:9, marginBottom:14, fontSize:13, fontWeight:600 }}>⚠ {err}</div>}
      <Field label="Current Password" required>
        <PasswordInput value={form.currentPassword} onChange={set('currentPassword')} placeholder="Your current password" autoFocus />
      </Field>
      <Field label="New Password" required>
        <PasswordInput value={form.newPassword} onChange={set('newPassword')} placeholder="Min. 6 characters" />
      </Field>
      <Field label="Confirm New Password" required>
        <PasswordInput value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat new password" />
      </Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} onClick={submit}>Change Password</Btn>
      </div>
    </Modal>
  );
}



/* ═══════════════════════════════════════════════════
   MODALS — Transaction / Payment / Customer
═══════════════════════════════════════════════════ */
function AddTransactionModal({ customerId, onSave, onClose, editing }) {
  const isEdit = !!editing;
  const [form, setForm] = useState(() => {
    if (isEdit) {
      const customItem = ITEM_NAMES.slice(0,-1).includes(editing.itemName) ? '' : editing.itemName;
      const itemName   = ITEM_NAMES.slice(0,-1).includes(editing.itemName) ? editing.itemName : 'Others';
      return { ...editing, itemName, customItem };
    }
    return { itemName:ITEM_NAMES[0], customItem:'', quantity:'', pricePerUnit:'', extraMoney:'0', date:todayStr(), note:'' };
  });
  const [loading, setL] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const total = (Number(form.quantity)||0)*(Number(form.pricePerUnit)||0)+(Number(form.extraMoney)||0);

  const submit = async () => {
    if (!form.quantity || !form.pricePerUnit || !form.date) { setErr('Fill Quantity, Price and Date'); return; }
    setErr(''); setL(true);
    try {
      const itemName = form.itemName==='Others' ? (form.customItem.trim()||'Others') : form.itemName;
      const data = { customerId, itemName, quantity:Number(form.quantity), pricePerUnit:Number(form.pricePerUnit), extraMoney:Number(form.extraMoney)||0, date:form.date, note:form.note };
      if (isEdit) { const r = await txnAPI.update(editing._id, data); onSave(r.data); }
      else        { const r = await txnAPI.create(data);               onSave(r.data); }
    } catch (ex) { setErr(ex.response?.data?.message || 'Failed'); }
    finally { setL(false); }
  };

  return (
    <Modal title={isEdit?'✏️ Edit Transaction':'➕ Add Transaction'} onClose={onClose}>
      {err && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:9, marginBottom:14, fontSize:13, fontWeight:600 }}>⚠ {err}</div>}
      <Field label="Item Name" required>
        <select value={form.itemName} onChange={set('itemName')} style={IS}>{ITEM_NAMES.map((n)=><option key={n}>{n}</option>)}</select>
      </Field>
      {form.itemName==='Others' && <Field label="Custom Item Name" required><input style={IS} value={form.customItem} onChange={set('customItem')} placeholder="Enter item name" /></Field>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Quantity" required><input style={IS} type="number" min="0" value={form.quantity} onChange={set('quantity')} placeholder="0" /></Field>
        <Field label="Price / Unit (₹)" required><input style={IS} type="number" min="0" step="0.01" value={form.pricePerUnit} onChange={set('pricePerUnit')} placeholder="0.00" /></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Extra / Discount (₹)"><input style={IS} type="number" step="0.01" value={form.extraMoney} onChange={set('extraMoney')} placeholder="0.00" /></Field>
        <Field label="Date" required><input style={IS} type="date" value={form.date} onChange={set('date')} /></Field>
      </div>
      <Field label="Note"><input style={IS} value={form.note} onChange={set('note')} placeholder="Optional remark..." /></Field>
      <div style={{ background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', borderRadius:12, padding:'14px 18px', marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #c7d2fe' }}>
        <div>
          <div style={{ fontSize:11, color:'#6d28d9', fontWeight:700, textTransform:'uppercase' }}>Total Amount</div>
          <div style={{ fontSize:12, color:'#a78bfa', marginTop:2 }}>{form.quantity||0} × ₹{form.pricePerUnit||0} + ₹{form.extraMoney||0}</div>
        </div>
        <div style={{ fontSize:24, fontWeight:800, color:C.primary }}>₹{fmt(total)}</div>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} onClick={submit}>{isEdit?'Update':'Save Transaction'}</Btn>
      </div>
    </Modal>
  );
}

function AddPaymentModal({ customerId, onSave, onClose, editing }) {
  const isEdit = !!editing;
  const [form, setForm] = useState(() => {
    if (isEdit) {
      const customMode = PAY_MODES.slice(0,-1).includes(editing.mode)?'':editing.mode;
      const mode = PAY_MODES.slice(0,-1).includes(editing.mode)?editing.mode:'Other';
      return { ...editing, mode, customMode };
    }
    return { mode:PAY_MODES[0], customMode:'', amount:'', date:todayStr(), note:'' };
  });
  const [loading, setL] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.amount || !form.date) { setErr('Fill Amount and Date'); return; }
    setErr(''); setL(true);
    try {
      const mode = form.mode==='Other' ? (form.customMode.trim()||'Other') : form.mode;
      const data = { customerId, mode, amount:Number(form.amount), date:form.date, note:form.note };
      if (isEdit) { const r = await paymentAPI.update(editing._id, data); onSave(r.data); }
      else        { const r = await paymentAPI.create(data);               onSave(r.data); }
    } catch (ex) { setErr(ex.response?.data?.message || 'Failed'); }
    finally { setL(false); }
  };

  return (
    <Modal title={isEdit?'✏️ Edit Payment':'💳 Add Payment'} onClose={onClose}>
      {err && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:9, marginBottom:14, fontSize:13, fontWeight:600 }}>⚠ {err}</div>}
      <Field label="Mode of Payment" required>
        <select value={form.mode} onChange={set('mode')} style={IS}>{PAY_MODES.map((m)=><option key={m}>{m}</option>)}</select>
      </Field>
      {form.mode==='Other' && <Field label="Specify Mode"><input style={IS} value={form.customMode} onChange={set('customMode')} placeholder="e.g. UPI, NEFT..." /></Field>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Amount (₹)" required><input style={IS} type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" /></Field>
        <Field label="Date" required><input style={IS} type="date" value={form.date} onChange={set('date')} /></Field>
      </div>
      <Field label="Note"><input style={IS} value={form.note} onChange={set('note')} placeholder="Optional remark..." /></Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" loading={loading} onClick={submit}>{isEdit?'Update':'Save Payment'}</Btn>
      </div>
    </Modal>
  );
}

function AddCustomerModal({ onSave, onClose, editing }) {
  const [form, setForm] = useState({ name:editing?.name||'', mobile:editing?.mobile||'' });
  const [loading, setL] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Customer name is required'); return; }
    setErr(''); setL(true);
    try {
      if (editing) { const r = await customerAPI.update(editing._id, form); onSave(r.data); }
      else         { const r = await customerAPI.create(form);               onSave(r.data); }
    } catch (ex) { setErr(ex.response?.data?.message || 'Failed'); }
    finally { setL(false); }
  };

  return (
    <Modal title={editing?'✏️ Edit Customer':'👤 Add Customer'} onClose={onClose} width={420}>
      {err && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:9, marginBottom:14, fontSize:13, fontWeight:600 }}>⚠ {err}</div>}
      <Field label="Customer Name" required><input style={IS} value={form.name} onChange={set('name')} placeholder="e.g. Ramesh Enterprises" autoFocus onKeyDown={(e)=>e.key==='Enter'&&submit()} /></Field>
      <Field label="Mobile Number"><input style={IS} type="tel" value={form.mobile} onChange={set('mobile')} placeholder="+91 98765 43210" onKeyDown={(e)=>e.key==='Enter'&&submit()} /></Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} onClick={submit}>{editing?'Update':'Add Customer'}</Btn>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   NAV BAR
═══════════════════════════════════════════════════ */
function Navbar({ title, subtitle, backTo, actions, mobileActions }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const { toasts, add: toast } = useToast();

  return (
    <>
    <nav style={{ background:C.nav, position:'sticky', top:0, zIndex:200, boxShadow:'0 2px 20px rgba(0,0,0,0.4)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:isMobile?'12px 14px':'0 24px', display:'flex', alignItems:'center', gap:12, minHeight:isMobile?'auto':64, flexWrap:'nowrap' }}>
        {backTo ? (
          <button onClick={() => navigate(backTo)} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:9, color:'#cbd5e1', padding:isMobile?'7px 12px':'8px 14px', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>← Back</button>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width:36, height:36, background:'linear-gradient(135deg,#3b6ef5,#7c3aed)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📒</div>
            {!isMobile && <div><div style={{ fontSize:17, fontWeight:800, color:'#f1f5f9', lineHeight:1, letterSpacing:'-0.02em' }}>LedgerPro</div><div style={{ fontSize:11, color:'#475569' }}>Ledger Manager</div></div>}
          </div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          {title && <div style={{ fontSize:isMobile?15:17, fontWeight:800, color:'#f1f5f9', lineHeight:1 }} className="truncate">{title}</div>}
          {subtitle && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{subtitle}</div>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          {!isMobile && actions}
          {/* User menu */}
          <div style={{ position:'relative' }}>
            <button
              onClick={() => setShowUserMenu(v=>!v)}
              style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:9, color:'#cbd5e1', padding:'7px 12px', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
              👤 {!isMobile && (user?.name?.split(' ')[0] || 'Me')}
            </button>
            {showUserMenu && (
              <div
                style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#fff', borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,0.18)', border:`1px solid ${C.border}`, minWidth:200, zIndex:300, overflow:'hidden', animation:'popIn 0.15s ease' }}
                onClick={() => setShowUserMenu(false)}>
                {/* User info */}
                <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{user?.name}</div>
                  <div style={{ fontSize:12, color:C.light, marginTop:2 }}>{user?.email}</div>
                  {user?.businessName && <div style={{ fontSize:12, color:C.mid, marginTop:1 }}>🏢 {user.businessName}</div>}
                </div>
                {/* Change Password */}
                <button
                  onClick={() => { setShowUserMenu(false); setShowChangePw(true); }}
                  style={{ width:'100%', background:'none', border:'none', borderBottom:`1px solid ${C.border}`, padding:'11px 16px', textAlign:'left', cursor:'pointer', color:C.text, fontWeight:600, fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:8 }}>
                  🔑 Change Password
                </button>
                {/* Logout */}
                <button
                  onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }}
                  style={{ width:'100%', background:'none', border:'none', padding:'11px 16px', textAlign:'left', cursor:'pointer', color:C.danger, fontWeight:600, fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:8 }}>
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile action strip */}
      {isMobile && mobileActions && (
        <div className="mobile-scroll" style={{ display:'flex', gap:8, padding:'8px 14px 12px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          {mobileActions}
        </div>
      )}
    </nav>
    {/* Change Password Modal */}
    {showChangePw && (
      <ChangePasswordModal
        onClose={() => setShowChangePw(false)}
        toast={toast}
      />
    )}
    <Toast toasts={toasts} />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   CUSTOMER LIST PAGE  (Dashboard)
═══════════════════════════════════════════════════ */
function DashboardPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toasts, add: toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sort, setSort]           = useState('name');
  const [showAdd, setShowAdd]     = useState(false);
  const [editC, setEditC]         = useState(null);
  const [confirm, setConfirm]     = useState(null);
  const [allTxns, setAllTxns]     = useState([]);
  const [allPays, setAllPays]     = useState([]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const r = await customerAPI.list();
      setCustomers(r.data);
    } catch { toast('Failed to load customers', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCustomers(); }, []);

  const deleteCustomer = async (id) => {
    try {
      await customerAPI.delete(id);
      setCustomers((p) => p.filter((c) => c._id !== id));
      toast('Customer deleted', 'warning');
    } catch { toast('Failed to delete', 'error'); }
  };

  const list = useMemo(() => {
    let c = [...customers];
    if (search) { const s = search.toLowerCase(); c = c.filter((x) => x.name.toLowerCase().includes(s) || (x.mobile||'').includes(search)); }
    if (sort==='name')         c.sort((a,b) => a.name.localeCompare(b.name));
    else if (sort==='balance') c.sort((a,b) => b.balance - a.balance);
    else if (sort==='due')     c.sort((a,b) => (b.balance>0?1:0)-(a.balance>0?1:0));
    return c;
  }, [customers, search, sort]);

  const totalDue = customers.reduce((s,c) => s+Math.max(0,c.balance||0), 0);
  const withDue  = customers.filter((c) => (c.balance||0) > 0).length;

  const handleCSVExport = () => {
    // Build lightweight objects for export
    const cust = customers.map((c) => ({ _id:c._id, name:c.name, mobile:c.mobile||'' }));
    exportCSV(cust, [], []);
    toast('Customers exported to CSV');
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <Navbar
        actions={<>
          <Btn size="sm" variant="outlineLight" onClick={handleCSVExport}>⬇ Export</Btn>
          <Btn size="sm" onClick={() => setShowAdd(true)}>＋ Add Customer</Btn>
        </>}
        mobileActions={<>
          <Btn size="sm" variant="outlineLight" onClick={handleCSVExport}>⬇ Export</Btn>
          <Btn size="sm" onClick={() => setShowAdd(true)}>＋ Add Customer</Btn>
        </>}
      />

      <div style={{ maxWidth:1200, margin:'0 auto', padding:isMobile?'16px 12px 100px':'28px 24px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          <StatCard label="Total Customers" value={customers.length} icon="👥" color={C.purple} small={isMobile} />
          <StatCard label="Total Outstanding" value={`₹${fmt(totalDue)}`} icon="💰" color={C.danger} small={isMobile} />
          <StatCard label="With Due Balance" value={withDue} icon="⚠️" color={C.warning} small={isMobile} />
        </div>

        {/* Search + Sort */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:isMobile?'wrap':'nowrap' }}>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="🔍 Search by name or mobile..." style={{ ...IS, flex:1, minWidth:isMobile?'100%':200 }} />
          <select value={sort} onChange={(e)=>setSort(e.target.value)} style={{ ...IS, width:isMobile?'100%':'auto', minWidth:190 }}>
            <option value="name">Sort: Name A–Z</option>
            <option value="balance">Sort: Highest Balance</option>
            <option value="due">Sort: With Due First</option>
          </select>
        </div>

        {/* Table / Cards */}
        <div style={{ background:C.surface, borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:60, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
              <Spinner size={36} /><span style={{ color:C.light, fontWeight:600 }}>Loading customers...</span>
            </div>
          ) : list.length===0 ? (
            <div style={{ padding:isMobile?40:64, textAlign:'center' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>📭</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.mid, marginBottom:10 }}>{customers.length===0?'No customers yet':'No results found'}</div>
              <div style={{ color:C.light, marginBottom:24, fontSize:14 }}>{customers.length===0?'Add your first customer to get started.':'Try a different search term.'}</div>
              {customers.length===0 && <Btn onClick={() => setShowAdd(true)}>＋ Add First Customer</Btn>}
            </div>
          ) : isMobile ? (
            /* Mobile cards */
            <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
              {list.map((c) => (
                <div key={c._id} style={{ background:'#fafbff', borderRadius:12, border:`1px solid ${C.border}`, padding:'14px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:42, height:42, borderRadius:12, background:`linear-gradient(135deg,${C.primary}22,${C.purple}22)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:C.primary, flexShrink:0 }}>{c.name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, color:C.text, fontSize:14 }} className="truncate">{c.name}</div>
                    <div style={{ fontSize:12, color:C.light }}>{c.mobile||'No mobile'}</div>
                    <div style={{ marginTop:5 }}><BalanceBadge balance={c.balance||0} /></div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                    <Btn size="sm" onClick={() => navigate(`/customer/${c._id}`)}>View</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditC(c)}>✏️</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirm({ msg:`Delete "${c.name}"? All data removed.`, onYes:() => { setConfirm(null); deleteCustomer(c._id); } })}>🗑️</Btn>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop table */
            <div className="table-wrap">
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#f8faff' }}>
                  {['#','Customer','Mobile','Balance','Actions'].map((h) => (
                    <th key={h} style={{ padding:'12px 20px', textAlign:'left', fontSize:11, fontWeight:700, color:C.light, textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {list.map((c,i) => (
                    <tr key={c._id} style={{ background:i%2===0?C.surface:'#fafbff', transition:'background 0.12s', cursor:'pointer' }}
                      onMouseEnter={(e)=>e.currentTarget.style.background=C.hover}
                      onMouseLeave={(e)=>e.currentTarget.style.background=i%2===0?C.surface:'#fafbff'}>
                      <td style={{ padding:'14px 20px', color:C.light, fontSize:13 }}>{i+1}</td>
                      <td style={{ padding:'14px 20px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${C.primary}20,${C.purple}20)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:C.primary, flexShrink:0 }}>{c.name.charAt(0).toUpperCase()}</div>
                          <span style={{ fontWeight:700, color:C.text, fontSize:15 }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'14px 20px', color:C.mid, fontSize:14 }}>{c.mobile||'—'}</td>
                      <td style={{ padding:'14px 20px' }}><BalanceBadge balance={c.balance||0} /></td>
                      <td style={{ padding:'14px 20px' }}>
                        <div style={{ display:'flex', gap:8 }}>
                          <Btn size="sm" onClick={() => navigate(`/customer/${c._id}`)}>👁 View</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setEditC(c)}>✏️ Edit</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirm({ msg:`Delete "${c.name}"? All transactions and payments will be removed.`, onYes:() => { setConfirm(null); deleteCustomer(c._id); } })}>🗑️</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {list.length>0 && <div style={{ textAlign:'center', marginTop:14, fontSize:13, color:C.light }}>Showing {list.length} of {customers.length} customers</div>}
      </div>

      {showAdd && <AddCustomerModal onSave={(c) => { setCustomers((p) => [...p,{...c,balance:0}]); setShowAdd(false); toast('Customer added!'); }} onClose={() => setShowAdd(false)} />}
      {editC   && <AddCustomerModal editing={editC} onSave={(c) => { setCustomers((p) => p.map((x)=>x._id===c._id?{...x,...c}:x)); setEditC(null); toast('Customer updated!'); }} onClose={() => setEditC(null)} />}
      {confirm && <Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={() => setConfirm(null)} />}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CUSTOMER DETAIL PAGE
═══════════════════════════════════════════════════ */
function CustomerDetailPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const custId    = location.pathname.split('/customer/')[1]?.split('/')[0];
  const isMobile  = useIsMobile();
  const { toasts, add: toast } = useToast();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTxn, setShowTxn] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [editPay, setEditPay] = useState(null);
  const [editCust,setEditCust]= useState(null);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await customerAPI.detail(custId);
      setData(r.data);
    } catch { toast('Failed to load', 'error'); navigate('/'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [custId]);

  const history = useMemo(() => {
    if (!data) return [];
    let items = [
      ...data.transactions.map((t) => ({ ...t, _type:'txn' })),
      ...data.payments.map((p) => ({ ...p, _type:'pmt' })),
    ];
    if (filter==='txn') items=items.filter((i)=>i._type==='txn');
    if (filter==='pmt') items=items.filter((i)=>i._type==='pmt');
    if (search) { const s=search.toLowerCase(); items=items.filter((i)=>(i.itemName||'').toLowerCase().includes(s)||(i.mode||'').toLowerCase().includes(s)||(i.note||'').toLowerCase().includes(s)); }
    items.sort((a,b) => { const d=new Date(b.date)-new Date(a.date); return sortDir==='desc'?d:-d; });
    return items;
  }, [data, filter, search, sortDir]);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <Navbar backTo="/" />
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
        <Spinner size={40} /><span style={{ color:C.light, fontWeight:600 }}>Loading customer data...</span>
      </div>
    </div>
  );

  if (!data) return null;
  const { customer, summary } = data;

  const handleDeleteCustomer = async () => {
    try { await customerAPI.delete(customer._id); navigate('/'); toast('Customer deleted', 'warning'); }
    catch { toast('Failed', 'error'); }
  };

  const handleDeleteTxn = async (txnId) => {
    try { await txnAPI.delete(txnId); await load(); toast('Deleted', 'warning'); }
    catch { toast('Failed', 'error'); }
  };

  const handleDeletePay = async (payId) => {
    try { await paymentAPI.delete(payId); await load(); toast('Deleted', 'warning'); }
    catch { toast('Failed', 'error'); }
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <Navbar
        backTo="/"
        title={customer.name}
        subtitle={customer.mobile||'No mobile'}
        actions={<>
          <Btn size="sm" onClick={() => setShowTxn(true)}>＋ Transaction</Btn>
          <Btn size="sm" variant="success" onClick={() => setShowPay(true)}>＋ Payment</Btn>
          <Btn size="sm" variant="warning" onClick={() => downloadExcel(customer, data.transactions, data.payments)}>⬇ Excel</Btn>
          <Btn size="sm" variant="warning" onClick={() => downloadPDF(customer, data.transactions, data.payments)}>⬇ PDF</Btn>
          <Btn size="sm" variant="ghost" style={{ background:'rgba(255,255,255,0.1)', color:'#cbd5e1' }} onClick={() => setEditCust(customer)}>✏️</Btn>
          <Btn size="sm" variant="danger" onClick={() => setConfirm({ msg:`Delete "${customer.name}" and all their data permanently?`, onYes:() => { setConfirm(null); handleDeleteCustomer(); } })}>🗑</Btn>
        </>}
        mobileActions={<>
          <Btn size="sm" onClick={() => setShowTxn(true)}>＋ Sale</Btn>
          <Btn size="sm" variant="success" onClick={() => setShowPay(true)}>＋ Payment</Btn>
          <Btn size="sm" variant="warning" onClick={() => downloadExcel(customer, data.transactions, data.payments)}>⬇ Excel</Btn>
          <Btn size="sm" variant="warning" onClick={() => downloadPDF(customer, data.transactions, data.payments)}>⬇ PDF</Btn>
          <Btn size="sm" variant="ghost" style={{ background:'rgba(255,255,255,0.1)', color:'#cbd5e1', flexShrink:0 }} onClick={() => setEditCust(customer)}>✏️</Btn>
          <Btn size="sm" variant="danger" style={{ flexShrink:0 }} onClick={() => setConfirm({ msg:`Delete "${customer.name}"?`, onYes:() => { setConfirm(null); handleDeleteCustomer(); } })}>🗑</Btn>
        </>}
      />

      <div style={{ maxWidth:1200, margin:'0 auto', padding:isMobile?'16px 12px 100px':'28px 24px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          <StatCard label="Total Sales" value={data.transactions.length} icon="📦" color={C.purple} small={isMobile} />
          <StatCard label="Total Billed" value={`₹${fmt(summary.totalBilled)}`} icon="🧾" color={C.primary} small={isMobile} />
          <StatCard label="Total Paid" value={`₹${fmt(summary.totalPaid)}`} icon="💳" color={C.success} small={isMobile} />
          <StatCard label="Outstanding" value={`₹${fmt(summary.outstanding)}`} icon={summary.outstanding>0?'⚠️':'✅'} color={summary.outstanding>0?C.danger:C.success} small={isMobile} />
        </div>

        {/* History */}
        <div style={{ background:C.surface, borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <div style={{ padding:isMobile?'14px':'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <h3 style={{ margin:0, fontWeight:800, color:C.text, fontSize:isMobile?15:16, flex:1 }}>History</h3>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...IS, width:isMobile?'100%':180, padding:'8px 12px', fontSize:13 }} />
            <div style={{ display:'flex', gap:6, width:isMobile?'100%':'auto' }}>
              {[['all','All'],['txn','Sales'],['pmt','Payments']].map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ flex:isMobile?1:'none', padding:'7px 12px', borderRadius:8, border:`1.5px solid ${filter===k?C.primary:C.border}`, background:filter===k?C.primary:C.surface, color:filter===k?'#fff':C.mid, fontWeight:600, fontSize:12.5, cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{l}</button>
              ))}
              <button onClick={() => setSortDir((d)=>d==='desc'?'asc':'desc')} style={{ padding:'7px 11px', borderRadius:8, border:`1.5px solid ${C.border}`, background:C.surface, color:C.mid, fontWeight:600, fontSize:12.5, cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {sortDir==='desc'?'↓ Newest':'↑ Oldest'}
              </button>
            </div>
          </div>

          {history.length===0 ? (
            <div style={{ padding:isMobile?36:56, textAlign:'center', color:C.light }}>
              <div style={{ fontSize:44, marginBottom:12 }}>📭</div>
              <div style={{ fontWeight:600, fontSize:15 }}>No records found</div>
              <div style={{ marginTop:6, fontSize:13 }}>Add a sale or payment above.</div>
            </div>
          ) : isMobile ? (
            /* Mobile cards */
            <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
              {history.map((item) => {
                const isTxn = item._type==='txn';
                const amount = isTxn ? (item.total||txnTotal(item)) : item.amount;
                return (
                  <div key={item._id} style={{ background:'#fafbff', borderRadius:12, border:`1px solid ${C.border}`, padding:'13px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                          <span style={{ padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:700, background:isTxn?'#ede9fe':'#dcfce7', color:isTxn?'#6d28d9':'#15803d' }}>{isTxn?'SALE':'PAYMENT'}</span>
                          <span style={{ fontSize:12, color:C.light }}>{fmtDate(item.date)}</span>
                        </div>
                        <div style={{ fontSize:14, fontWeight:600, color:C.text }} className="truncate">{isTxn?`${item.itemName} × ${item.quantity}`:item.mode}</div>
                        {isTxn && <div style={{ fontSize:12, color:C.light, marginTop:2 }}>₹{fmt(item.pricePerUnit)}/unit{item.extraMoney!==0?` + ₹${fmt(item.extraMoney)} extra`:''}</div>}
                        {item.note && <div style={{ fontSize:12, color:C.light, marginTop:3 }}>📝 {item.note}</div>}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:16, fontWeight:800, color:isTxn?C.primary:C.success }}>{isTxn?'':'-'}₹{fmt(amount)}</div>
                        <div style={{ display:'flex', gap:6, marginTop:8, justifyContent:'flex-end' }}>
                          <Btn size="xs" variant="ghost" onClick={() => isTxn?setEditTxn(item):setEditPay(item)}>✏️</Btn>
                          <Btn size="xs" variant="ghost" onClick={() => setConfirm({ msg:'Delete this entry?', onYes:() => { setConfirm(null); isTxn?handleDeleteTxn(item._id):handleDeletePay(item._id); } })}>🗑️</Btn>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop table */
            <div className="table-wrap">
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#f8faff' }}>
                  {['Date','Type','Details','Amount (₹)','Note','Actions'].map((h)=>(
                    <th key={h} style={{ padding:'11px 18px', textAlign:'left', fontSize:11, fontWeight:700, color:C.light, textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {history.map((item,i) => {
                    const isTxn = item._type==='txn';
                    const amount = isTxn?(item.total||txnTotal(item)):item.amount;
                    return (
                      <tr key={item._id} style={{ background:i%2===0?C.surface:'#fafbff', transition:'background 0.12s' }}
                        onMouseEnter={(e)=>e.currentTarget.style.background=C.hover}
                        onMouseLeave={(e)=>e.currentTarget.style.background=i%2===0?C.surface:'#fafbff'}>
                        <td style={{ padding:'13px 18px', fontSize:13, color:C.mid, whiteSpace:'nowrap' }}>{fmtDate(item.date)}</td>
                        <td style={{ padding:'13px 18px' }}><span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:isTxn?'#ede9fe':'#dcfce7', color:isTxn?'#6d28d9':'#15803d' }}>{isTxn?'SALE':'PAYMENT'}</span></td>
                        <td style={{ padding:'13px 18px', fontSize:13, color:C.text, maxWidth:300 }}>{isTxn?`${item.itemName} — ${item.quantity} × ₹${fmt(item.pricePerUnit)}${item.extraMoney!==0?` (Extra: ₹${fmt(item.extraMoney)})`:''}`:item.mode}</td>
                        <td style={{ padding:'13px 18px', fontSize:15, fontWeight:800, color:isTxn?C.primary:C.success, whiteSpace:'nowrap' }}>{isTxn?`₹${fmt(amount)}`:`-₹${fmt(amount)}`}</td>
                        <td style={{ padding:'13px 18px', fontSize:13, color:C.light }}>{item.note||'—'}</td>
                        <td style={{ padding:'13px 18px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <Btn size="sm" variant="ghost" onClick={() => isTxn?setEditTxn(item):setEditPay(item)}>✏️ Edit</Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setConfirm({ msg:'Delete this entry?', onYes:() => { setConfirm(null); isTxn?handleDeleteTxn(item._id):handleDeletePay(item._id); } })}>🗑️</Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showTxn && <AddTransactionModal customerId={custId} onSave={() => { load(); setShowTxn(false); toast('Transaction saved!'); }} onClose={() => setShowTxn(false)} />}
      {showPay && <AddPaymentModal customerId={custId} onSave={() => { load(); setShowPay(false); toast('Payment recorded!'); }} onClose={() => setShowPay(false)} />}
      {editTxn && <AddTransactionModal customerId={custId} editing={editTxn} onSave={() => { load(); setEditTxn(null); toast('Updated!'); }} onClose={() => setEditTxn(null)} />}
      {editPay && <AddPaymentModal customerId={custId} editing={editPay} onSave={() => { load(); setEditPay(null); toast('Updated!'); }} onClose={() => setEditPay(null)} />}
      {editCust && <AddCustomerModal editing={editCust} onSave={() => { load(); setEditCust(null); toast('Customer updated!'); }} onClose={() => setEditCust(null)} />}
      {confirm && <Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={() => setConfirm(null)} />}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PROTECTED ROUTE
═══════════════════════════════════════════════════ */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg }}>
      <Spinner size={40} />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

/* ═══════════════════════════════════════════════════
   APP ROUTER
═══════════════════════════════════════════════════ */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/customer/:id" element={<ProtectedRoute><CustomerDetailPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
