import { Router } from "express";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
const router=Router();
router.get("/",protect,async(req,res,next)=>{try{
 const users=await User.find({_id:{$ne:req.user._id},is_verified:true}).select("-password_hash").sort({fullName:1}).limit(100);
 res.json({success:true,users});
}catch(e){next(e)}});
export default router;