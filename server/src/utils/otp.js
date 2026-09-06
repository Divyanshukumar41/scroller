import crypto from "crypto";
import bcrypt from "bcryptjs";
import Otp from "../models/Otp.js";

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}
export async function createOtp(email, purpose) {
  const code = generateOtp();
  await Otp.deleteMany({ email, purpose, consumed: false });
  await Otp.create({
    email, purpose,
    code_hash: await bcrypt.hash(code, 12),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });
  return code;
}
export async function verifyOtp(email, purpose, code) {
  const record = await Otp.findOne({ email, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!record || record.expiresAt.getTime() < Date.now()) return { ok:false, reason:"expired" };
  if (record.attempts >= 5) return { ok:false, reason:"locked" };
  const valid = await bcrypt.compare(code, record.code_hash);
  if (!valid) { record.attempts += 1; await record.save(); return { ok:false, reason:"invalid" }; }
  record.consumed = true; await record.save();
  return { ok:true };
}