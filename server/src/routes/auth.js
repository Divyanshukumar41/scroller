import { Router } from "express";
import rateLimit from "express-rate-limit";
import { signup,verifySignup,login,verifyLogin,resendOtp } from "../controllers/auth.js";

const router=Router();
const otpLimiter=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false,message:{success:false,message:"Too many OTP requests. Try again later."}});
router.post("/signup",signup);
router.post("/signup/verify-otp",otpLimiter,verifySignup);
router.post("/login",login);
router.post("/login/verify-otp",otpLimiter,verifyLogin);
router.post("/otp/resend",otpLimiter,resendOtp);
export default router;