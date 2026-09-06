import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  text: { type: String, maxlength: 5000, default: "" },
  message_type: { type: String, enum: ["text", "image"], default: "text" },
  media_url: { type: String, default: "" },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Message", messageSchema);
