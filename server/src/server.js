import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import chatRoutes from "./routes/chat.js";

import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

/* =========================================================
   APP
========================================================= */

const app = express();

app.set(
  "trust proxy",
  1
);

/* =========================================================
   CORS
========================================================= */

const allowedOrigins =
  process.env.CLIENT_URL
    ?.split(",")
    .map((origin) =>
      origin.trim()
    )
    .filter(Boolean) || [
    "http://localhost:5173",
  ];

app.use(
  helmet()
);

app.use(
  cors({
    origin:
      allowedOrigins,
    credentials:
      true,
  })
);

/* =========================================================
   BODY
========================================================= */

app.use(
  express.json({
    limit: "100kb",
  })
);

/* =========================================================
   RATE LIMIT
========================================================= */

app.use(
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max: 300,

    standardHeaders:
      true,

    legacyHeaders:
      false,
  })
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      status: "ok",
    });
  }
);

/* =========================================================
   ROUTES
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api",
  chatRoutes
);

/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(app);

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(
  server,
  {
    cors: {
      origin:
        allowedOrigins,
      credentials:
        true,
    },

    transports: [
      "websocket",
      "polling",
    ],
  }
);

/* =========================================================
   SOCKET AUTH
========================================================= */

io.use(
  async (
    socket,
    next
  ) => {
    try {
      const token =
        socket.handshake
          .auth?.token;

      if (!token) {
        throw new Error(
          "Token missing"
        );
      }

      const decoded =
        jwt.verify(
          token,
          process.env
            .JWT_SECRET
        );

      const user =
        await User.findById(
          decoded.sub
        );

      if (
        !user ||
        !user.is_verified
      ) {
        throw new Error(
          "Unauthorized"
        );
      }

      socket.userId =
        String(user._id);

      next();
    } catch (error) {
      console.error(
        "Socket auth:",
        error.message
      );

      next(
        new Error(
          "Unauthorized"
        )
      );
    }
  }
);

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
  "connection",
  async (socket) => {
    const userId =
      socket.userId;

    console.log(
      `Socket connected: ${userId}`
    );

    /* =====================================================
       SET ONLINE
    ===================================================== */

    try {
      await User.findByIdAndUpdate(
        userId,
        {
          status: "online",
          last_active:
            new Date(),
        }
      );

      socket.broadcast.emit(
        "user:online",
        {
          userId,
        }
      );
    } catch (error) {
      console.error(
        "Online update:",
        error.message
      );
    }

    /* =====================================================
       JOIN CONVERSATION
    ===================================================== */

    socket.on(
      "conversation:join",
      async ({
        conversationId,
      }) => {
        try {
          if (
            !conversationId
          ) {
            return;
          }

          const conversation =
            await Conversation.findOne(
              {
                _id:
                  conversationId,

                participants:
                  userId,
              }
            );

          if (
            !conversation
          ) {
            return;
          }

          const room =
            `conversation:${conversationId}`;

          socket.join(room);

          /* ===============================================
             Mark unread messages read
          =============================================== */

          const unread =
            await Message.find(
              {
                conversation:
                  conversationId,

                receiver:
                  userId,

                read: false,
              }
            ).select("_id");

          if (unread.length) {
            const ids =
              unread.map(
                (message) =>
                  message._id
              );

            await Message.updateMany(
              {
                _id: {
                  $in: ids,
                },

                receiver:
                  userId,
              },
              {
                $set: {
                  read: true,
                  readAt:
                    new Date(),
                },
              }
            );

            io.to(room).emit(
              "message:read",
              {
                messageIds:
                  ids.map(String),
              }
            );
          }
        } catch (error) {
          console.error(
            "conversation:join:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       TYPING START
    ===================================================== */

    socket.on(
      "typing:start",
      ({
        conversationId,
      }) => {
        if (
          !conversationId
        ) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "typing:start",
            {
              userId,
            }
          );
      }
    );

    /* =====================================================
       TYPING STOP
    ===================================================== */

    socket.on(
      "typing:stop",
      ({
        conversationId,
      }) => {
        if (
          !conversationId
        ) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "typing:stop",
            {
              userId,
            }
          );
      }
    );

    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    socket.on(
      "message:send",
      async (
        {
          conversationId,
          receiverId,
          text,
          message_type = "text",
          localId,
        },
        ack
      ) => {
        try {
          /* =============================================
             Validate
          ============================================= */

          if (
            !conversationId ||
            !receiverId
          ) {
            return ack?.({
              success:
                false,

              message:
                "Invalid conversation",
              localId,
            });
          }

          if (
            typeof text !==
              "string" ||
            !text.trim() ||
            text.length >
              5000
          ) {
            return ack?.({
              success:
                false,

              message:
                "Invalid message",

              localId,
            });
          }

          /* =============================================
             Prevent self-message
          ============================================= */

          if (
            String(
              userId
            ) ===
            String(
              receiverId
            )
          ) {
            return ack?.({
              success:
                false,

              message:
                "Cannot send message to yourself",

              localId,
            });
          }

          /* =============================================
             Check conversation
          ============================================= */

          const conversation =
            await Conversation.findOne(
              {
                _id:
                  conversationId,

                participants: {
                  $all: [
                    userId,
                    receiverId,
                  ],

                  $size: 2,
                },
              }
            );

          if (
            !conversation
          ) {
            return ack?.({
              success:
                false,

              message:
                "Conversation not found",

              localId,
            });
          }

          /* =============================================
             Create message
          ============================================= */

          const message =
            await Message.create(
              {
                conversation:
                  conversation._id,

                sender:
                  userId,

                receiver:
                  receiverId,

                text:
                  text.trim(),

                message_type,
              }
            );

          /* =============================================
             IMPORTANT

             Send localId back with message:new.
             
             This is what prevents duplicate messages.
          ============================================= */

          const payload = {
            ...message.toObject(),

            localId:
              localId || null,
          };

          const room =
            `conversation:${conversationId}`;

          io.to(room).emit(
            "message:new",
            payload
          );

          /* =============================================
             ACK
          ============================================= */

          ack?.({
            success:
              true,

            messageId:
              String(
                message._id
              ),

            localId:
              localId || null,
          });
        } catch (error) {
          console.error(
            "message:send:",
            error.message
          );

          ack?.({
            success:
              false,

            message:
              "Unable to send message",

            localId,
          });
        }
      }
    );

    /* =====================================================
       READ MESSAGE
    ===================================================== */

    socket.on(
      "message:read",
      async ({
        conversationId,
      }) => {
        try {
          if (
            !conversationId
          ) {
            return;
          }

          const conversation =
            await Conversation.findOne(
              {
                _id:
                  conversationId,

                participants:
                  userId,
              }
            );

          if (
            !conversation
          ) {
            return;
          }

          const unread =
            await Message.find(
              {
                conversation:
                  conversationId,

                receiver:
                  userId,

                read: false,
              }
            ).select(
              "_id sender"
            );

          if (!unread.length) {
            return;
          }

          const ids =
            unread.map(
              (message) =>
                message._id
            );

          await Message.updateMany(
            {
              _id: {
                $in: ids,
              },

              receiver:
                userId,
            },
            {
              $set: {
                read: true,
                readAt:
                  new Date(),
              },
            }
          );

          io.to(
            `conversation:${conversationId}`
          ).emit(
            "message:read",
            {
              messageIds:
                ids.map(String),
            }
          );
        } catch (error) {
          console.error(
            "message:read:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",
      async () => {
        try {
          await User.findByIdAndUpdate(
            userId,
            {
              status:
                "offline",

              last_active:
                new Date(),
            }
          );

          socket.broadcast.emit(
            "user:offline",
            {
              userId,
            }
          );

          console.log(
            `Socket disconnected: ${userId}`
          );
        } catch (error) {
          console.error(
            "disconnect:",
            error.message
          );
        }
      }
    );
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    res
      .status(404)
      .json({
        success:
          false,

        message:
          "Route not found",
      });
  }
);

/* =========================================================
   SERVER
========================================================= */

const port =
  Number(
    process.env.PORT ||
      8080
  );

connectDB()
  .then(() => {
    server.listen(
      port,
      () => {
        console.log(
          `ChatFlow API listening on ${port}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "Database connection failed:",
      error
    );

    process.exit(1);
  });