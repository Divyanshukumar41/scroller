import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import Chat from "./pages/Chat";

function Protected({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/verify-otp" element={<VerifyOtp />} />
    <Route path="/" element={<Protected><Chat /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}