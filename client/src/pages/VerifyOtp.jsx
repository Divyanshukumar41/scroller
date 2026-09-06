import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Alert, AuthShell } from "./Login";

export default function VerifyOtp(){
 const {state}=useLocation(); const navigate=useNavigate();
 const {verifySignupOtp,verifyLoginOtp,resendOtp}=useAuth();
 const email=state?.email||""; const mode=state?.mode||"signup";
 const [code,setCode]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 const [seconds,setSeconds]=useState(45); const inputs=useRef([]);
 useEffect(()=>{const t=setInterval(()=>setSeconds(s=>s>0?s-1:0),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!email)navigate("/login",{replace:true})},[email]);
 const change=(i,v)=>{if(!/^\d?$/.test(v))return; const a=code.padEnd(6," ").split("");a[i]=v;const next=a.join("").replace(/ /g,"");setCode(next);if(v&&i<5)inputs.current[i+1]?.focus()};
 async function verify(e){e.preventDefault();setError("");setLoading(true);try{
   const fn=mode==="signup"?verifySignupOtp:verifyLoginOtp; await fn({email,otp:code});navigate("/");
 }catch(e){setError(e.response?.data?.message||"Invalid or expired code.")}finally{setLoading(false)}}
 async function resend(){if(seconds)return;try{await resendOtp({email,purpose:mode});setSeconds(45)}catch(e){setError(e.response?.data?.message||"Could not resend code.")}}
 return <AuthShell title="Verify your email" subtitle={`Enter the 6-digit code sent to ${email}.`}>
   <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400"><ShieldCheck/></div>
   <form onSubmit={verify}>
    <div className="mb-5 grid grid-cols-6 gap-2 sm:gap-3">{Array.from({length:6}).map((_,i)=><input key={i} ref={e=>inputs.current[i]=e} inputMode="numeric" maxLength={1} value={code[i]||""} onChange={e=>change(i,e.target.value)} className="h-14 w-full rounded-xl border border-white/10 bg-slate-950 text-center text-xl font-black outline-none focus:border-indigo-500" />)}</div>
    {error&&<Alert>{error}</Alert>}
    <button className="btn-primary mt-4" disabled={loading||code.length!==6}>{loading?"Verifying…":"Verify & continue"}</button>
   </form>
   <button onClick={resend} disabled={seconds>0} className="mt-5 w-full text-center text-sm text-slate-400 disabled:opacity-50">{seconds>0?`Resend code in ${seconds}s`:"Resend code"}</button>
   <Link to="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to login</Link>
 </AuthShell>;
}