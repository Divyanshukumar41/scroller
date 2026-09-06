import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

/* =========================================================
   SOCKET.IO IS USED FOR LOCAL / NON-SERVERLESS DEPLOYMENTS.
   Vercel uses the REST API + frontend polling instead.
========================================================= */

const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : ["http://localhost:5173"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error("Token missing");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub);

    if (!user || !user.is_verified) throw new Error("Unauthorized");

    socket.userId = String(user._id);
    next();
  } catch (error) {
    console.error("Socket auth:", error.message);
    next(new Error("Unauthorized"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.userId;

  try {
    await User.findByIdAndUpdate(userId, {
      status: "online",
      last_active: new Date(),
    });
    socket.broadcast.emit("user:online", { userId });
  } catch (error) {
    console.error("Online update:", error.message);
  }

  socket.on("conversation:join", async ({ conversationId }) => {
    try {
      if (!conversationId) return;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) return;

      const room = `conversation:${conversationId}`;
      socket.join(room);

      const unread = await Message.find({
        conversation: conversationId,
        receiver: userId,
        read: false,
      }).select("_id");

      if (unread.length) {
        const ids = unread.map((message) => message._id);

        await Message.updateMany(
          { _id: { $in: ids }, receiver: userId },
          { $set: { read: true, readAt: new Date() } },
        );

        io.to(room).emit("message:read", {
          messageIds: ids.map(String),
        });
      }
    } catch (error) {
      console.error("conversation:join:", error.message);
    }
  });

  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit("typing:start", { userId });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit("typing:stop", { userId });
  });

  socket.on(
    "message:send",
    async ({ conversationId, receiverId, text, message_type = "text", localId }, ack) => {
      try {
        if (!conversationId || !receiverId) {
          return ack?.({ success: false, message: "Invalid conversation", localId });
        }

        if (typeof text !== "string" || !text.trim() || text.length > 5000) {
          return ack?.({ success: false, message: "Invalid message", localId });
        }

        if (String(userId) === String(receiverId)) {
          return ack?.({ success: false, message: "Cannot send message to yourself", localId });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: { $all: [userId, receiverId], $size: 2 },
        });

        if (!conversation) {
          return ack?.({ success: false, message: "Conversation not found", localId });
        }

        const message = await Message.create({
          conversation: conversation._id,
          sender: userId,
          receiver: receiverId,
          text: text.trim(),
          message_type,
        });

        const payload = {
          ...message.toObject(),
          localId: localId || null,
        };

        io.to(`conversation:${conversationId}`).emit("message:new", payload);

        ack?.({
          success: true,
          messageId: String(message._id),
          localId: localId || null,
        });
      } catch (error) {
        console.error("message:send:", error.message);
        ack?.({ success: false, message: "Unable to send message", localId });
      }
    },
  );

  socket.on("message:read", async ({ conversationId }) => {
    try {
      if (!conversationId) return;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) return;

      const unread = await Message.find({
        conversation: conversationId,
        receiver: userId,
        read: false,
      }).select("_id");

      if (!unread.length) return;

      const ids = unread.map((message) => message._id);

      await Message.updateMany(
        { _id: { $in: ids }, receiver: userId },
        { $set: { read: true, readAt: new Date() } },
      );

      io.to(`conversation:${conversationId}`).emit("message:read", {
        messageIds: ids.map(String),
      });
    } catch (error) {
      console.error("message:read:", error.message);
    }
  });

  socket.on("disconnect", async () => {
    try {
      await User.findByIdAndUpdate(userId, {
        status: "offline",
        last_active: new Date(),
      });
      socket.broadcast.emit("user:offline", { userId });
    } catch (error) {
      console.error("disconnect:", error.message);
    }
  });
});

const port = Number(process.env.PORT || 8080);

connectDB()
  .then(() => {
    server.listen(port, () => {
      console.log(`Scroller API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });
