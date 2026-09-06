import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { createOtp, verifyOtp } from "../utils/otp.js";
import { sendOtpEmail } from "../services/mailer.js";
import { signToken } from "../utils/jwt.js";

function emailOf(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}
function validPassword(v) {
  return typeof v === "string" && v.length >= 8 && v.length <= 128;
}

export async function signup(req, res, next) {
  try {
    const { fullName, email, password, phone_number } = req.body;
    const normalized = emailOf(email);
    if (
      !fullName ||
      fullName.trim().length < 2 ||
      !normalized ||
      !validPassword(password)
    )
      return res
        .status(400)
        .json({
          success: false,
          message: "Name, valid email and 8+ character password are required",
        });
    const existing = await User.findOne({ email: normalized });
    if (existing?.is_verified)
      return res
        .status(409)
        .json({
          success: false,
          message: "An account with this email already exists",
        });
    const password_hash = await bcrypt.hash(password, 12);
    const user = existing || new User({ email: normalized });
    user.fullName = fullName.trim();
    user.phone_number = phone_number?.trim() || "";
    user.password_hash = password_hash;
    user.is_verified = false;
    await user.save();
    const code = await createOtp(normalized, "signup");
    await sendOtpEmail({ email: normalized, code, purpose: "signup" });
    res
      .status(201)
      .json({
        success: true,
        requiresOtp: true,
        message: "Verification code sent",
      });
  } catch (e) {
    next(e);
  }
}

export async function verifySignup(req, res, next) {
  try {
    const email = emailOf(req.body.email),
      otp = String(req.body.otp || "");
    const result = await verifyOtp(email, "signup", otp);
    if (!result.ok)
      return res
        .status(400)
        .json({
          success: false,
          message:
            result.reason === "locked"
              ? "Too many attempts. Request a new code."
              : "Invalid or expired code",
        });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    user.is_verified = true;
    await user.save();
    res.json({
      success: true,
      token: signToken(user),
      user: user.toSafeJSON(),
    });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const email = emailOf(req.body.email),
      password = req.body.password;
    const user = await User.findOne({ email }).select("+password_hash");
    if (!user || !(await bcrypt.compare(password || "", user.password_hash)))
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    if (!user.is_verified)
      return res
        .status(403)
        .json({ success: false, message: "Verify your account first" });
    const code = await createOtp(email, "login");
    await sendOtpEmail({ email, code, purpose: "login" });
    res.json({ success: true, requiresOtp: true, message: "Login code sent" });
  } catch (e) {
    next(e);
  }
}

export async function verifyLogin(req, res, next) {
  try {
    const email = emailOf(req.body.email),
      otp = String(req.body.otp || "");
    const result = await verifyOtp(email, "login", otp);
    if (!result.ok)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired code" });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    user.last_active = new Date();
    await user.save();
    res.json({
      success: true,
      token: signToken(user),
      user: user.toSafeJSON(),
    });
  } catch (e) {
    next(e);
  }
}

export async function resendOtp(req, res, next) {
  try {
    const email = emailOf(req.body.email),
      purpose = req.body.purpose;
    if (!["signup", "login"].includes(purpose))
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP purpose" });
    const user = await User.findOne({ email });
    if (purpose === "signup" && (!user || user.is_verified))
      return res
        .status(400)
        .json({ success: false, message: "Signup verification unavailable" });
    if (purpose === "login" && !user?.is_verified)
      return res
        .status(400)
        .json({ success: false, message: "Login verification unavailable" });
    const code = await createOtp(email, purpose);
    await sendOtpEmail({ email, code, purpose });
    res.json({ success: true, message: "A new code was sent" });
  } catch (e) {
    next(e);
  }
}
