import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true, sparse: true },
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone_number: { type: String, trim: true, maxlength: 25 },
  password_hash: { type: String, required: true, select: false },
  profile_picture: { type: String, default: "" },
  status: { type: String, enum: ["online","offline"], default: "offline" },
  last_active: { type: Date, default: Date.now },
  timezone: { type: String, default: "Asia/Kolkata" },
  language: { type: String, default: "English" },
  bio: { type: String, maxlength: 240, default: "" },
  is_verified: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id, user_id: this.user_id, fullName: this.fullName,
    email: this.email, phone_number: this.phone_number, profile_picture: this.profile_picture,
    status: this.status, last_active: this.last_active, timezone: this.timezone,
    language: this.language, bio: this.bio, is_verified: this.is_verified
  };
};
export default mongoose.model("User", userSchema);