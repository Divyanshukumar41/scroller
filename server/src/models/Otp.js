import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  purpose: { type: String, enum: ["signup","login"], required: true },
  code_hash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  consumed: { type: Boolean, default: false }
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("Otp", otpSchema);