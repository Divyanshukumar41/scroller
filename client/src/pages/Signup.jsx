import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { AuthShell, Alert } from "./Login";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone_number: "+91",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      navigate("/verify-otp", { state: { mode: "signup", email: form.email } });
    } catch (e) {
      setError(e.response?.data?.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthShell
      title="Create account"
      subtitle="Create your account, then verify the one-time code sent to your email."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field
          icon={UserRound}
          label="Full name"
          value={form.fullName}
          onChange={(v) => set("fullName", v)}
          placeholder="Your name"
        />
        <Field
          icon={Mail}
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => set("email", v)}
          placeholder="you@example.com"
        />
        <Field
          icon={Phone}
          label="Phone (optional)"
          value={form.phone_number}
          onChange={(v) => set("phone_number", v)}
          placeholder="+91…"
        />
        <Field
          icon={LockKeyhole}
          label="Password"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
          placeholder="At least 8 characters"
        />
        {error && <Alert>{error}</Alert>}
        <button className="btn-primary mt-2" disabled={loading}>
          {loading ? (
            "Creating…"
          ) : (
            <>
              Create account <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <p className="auth-link">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
function Field({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </span>
      <div className="input-wrap">
        <Icon size={18} />
        <input
          required={label !== "Phone (optional)"}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}
