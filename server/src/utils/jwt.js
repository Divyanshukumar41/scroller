import jwt from "jsonwebtoken";
export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
}