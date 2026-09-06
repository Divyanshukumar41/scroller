import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req,res,next) {
  try {
    const header=req.headers.authorization;
    if(!header?.startsWith("Bearer ")) return res.status(401).json({success:false,message:"Authentication required"});
    const token=header.slice(7);
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    const user=await User.findById(decoded.sub);
    if(!user||!user.is_verified) return res.status(401).json({success:false,message:"Invalid session"});
    req.user=user; next();
  } catch { return res.status(401).json({success:false,message:"Invalid or expired token"}); }
}