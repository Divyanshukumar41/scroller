import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(form);
      if (data.requiresOtp) {
        navigate("/verify-otp", {
          state: { mode: "login", email: form.email },
        });
      } else navigate("/");
    } catch (e) {
      setError(e.response?.data?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in securely with your password and a one-time code."
    >
      <form onSubmit={submit} className="space-y-5">
        <Field
          icon={Mail}
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          placeholder="you@example.com"
        />
        <Field
          icon={LockKeyhole}
          label="Password"
          type="password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          placeholder="Your password"
        />
        {error && <Alert>{error}</Alert>}
        <button className="btn-primary" disabled={loading}>
          {loading ? (
            "Checking…"
          ) : (
            <>
              Continue <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <p className="auth-link">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <main className="auth-page-enter min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <div className="grid w-full overflow-hidden auth-panel-enter rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 lg:grid-cols-[1.05fr_.95fr]">
          <div className="hidden min-h-[680px] flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 lg:flex">
            <div className="flex items-center gap-3 text-xl font-black">
              <MessageCircle /> Scroller
            </div>
            <div>
              <div className="mb-5 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur">
                Private • Real-time • Secure
              </div>
              <h1 className="max-w-md text-5xl font-black leading-tight">
                Conversations that feel effortless.
              </h1>
              <p className="mt-5 max-w-md text-white/75">
                A polished chat experience built for phones, tablets and
                desktops.
              </p>
            </div>
            <div className="text-sm text-white/60">
              End-to-end transport security • OTP protected access
            </div>
          </div>
          <div className="flex min-h-[680px] items-center bg-slate-900 p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 font-black lg:hidden">
                <MessageCircle className="text-indigo-400" /> Scroller
              </div>
              <h2 className="text-3xl font-black">{title}</h2>
              <p className="mt-2 mb-8 text-sm text-slate-400">{subtitle}</p>
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
function Field({ icon: Icon, label, type, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </span>
      <div className="input-wrap">
        <Icon size={18} />
        <input
          required
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}
export function Alert({ children }) {
  return (
    <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-300">
      {children}
    </div>
  );
}
