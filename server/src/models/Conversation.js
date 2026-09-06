import mongoose from "mongoose";
const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }]
}, { timestamps: true });
conversationSchema.index({ participants: 1 });
export default mongoose.model("Conversation", conversationSchema);