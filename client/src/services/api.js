import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://scrollerbackend.vercel.app/api";

export { API_URL };

const api = axios.create({
  baseURL: API_URL.replace(/\/+$/, ""),
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
