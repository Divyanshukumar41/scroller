import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { socket } from "../services/socket";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token && user) {
      socket.auth = { token };
      socket.connect();
    }

    setBooting(false);

    return () => {
      // IMPORTANT: cleanup must be a function, not a Promise.
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const onConnectError = (error) => {
      console.error("Socket connection error:", error.message);
    };

    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect_error", onConnectError);
    };
  }, []);

  const connectSocket = (token) => {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  };

  const setSession = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    connectSocket(data.token);
  };

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    return data;
  };

  const verifyLoginOtp = async (payload) => {
    const { data } = await api.post("/auth/login/verify-otp", payload);
    setSession(data);
    return data;
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    return data;
  };

  const verifySignupOtp = async (payload) => {
    const { data } = await api.post("/auth/signup/verify-otp", payload);
    setSession(data);
    return data;
  };

  const resendOtp = async (payload) => {
    const { data } = await api.post("/auth/otp/resend", payload);
    return data;
  };

  const logout = () => {
    socket.disconnect();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      verifyLoginOtp,
      signup,
      verifySignupOtp,
      resendOtp,
      logout,
      setUser,
    }),
    [user, booting],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
