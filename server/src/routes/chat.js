import { Router } from "express";
import mongoose from "mongoose";

import { protect } from "../middleware/auth.js";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const router =
  Router();

/* =========================================================
   CREATE / GET CONVERSATION
========================================================= */

router.post(
  "/conversations",
  protect,
  async (req, res, next) => {
    try {
      const userId =
        req.user?._id;

      const otherUserId =
        req.body?.userId;

      /* ==============================================
         Validate user
      ============================================== */

      if (
        !otherUserId ||
        !mongoose.isValidObjectId(
          otherUserId
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid user",
          });
      }

      if (
        String(userId) ===
        String(otherUserId)
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Cannot create conversation with yourself",
          });
      }

      /* ==============================================
         Check other user
      ============================================== */

      const other =
        await User.findOne(
          {
            _id:
              otherUserId,

            is_verified:
              true,
          }
        );

      if (!other) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "User not found",
          });
      }

      /* ==============================================
         Sorted participants

         This makes sure A+B and B+A
         don't create separate conversations.
      ============================================== */

      const participantIds = [
        String(userId),
        String(other._id),
      ].sort();

      /* ==============================================
         Find existing
      ============================================== */

      let conversation =
        await Conversation.findOne(
          {
            participants: {
              $all:
                participantIds,

              $size: 2,
            },
          }
        );

      /* ==============================================
         Create if not found
      ============================================== */

      if (!conversation) {
        conversation =
          await Conversation.create(
            {
              participants:
                participantIds,
            }
          );
      }

      return res.json({
        success:
          true,

        conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   GET MESSAGES
========================================================= */

router.get(
  "/messages/:conversationId",
  protect,
  async (req, res, next) => {
    try {
      const {
        conversationId,
      } = req.params;

      /* ==============================================
         Validate conversation ID
      ============================================== */

      if (
        !mongoose.isValidObjectId(
          conversationId
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid conversation",
          });
      }

      /* ==============================================
         Check access
      ============================================== */

      const conversation =
        await Conversation.findOne(
          {
            _id:
              conversationId,

            participants:
              req.user._id,
          }
        );

      if (!conversation) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Access denied",
          });
      }

      /* ==============================================
         Get messages
      ============================================== */

      const messages =
        await Message.find(
          {
            conversation:
              conversation._id,
          }
        )
          .sort({
            createdAt: 1,
          })
          .limit(500);

      return res.json({
        success:
          true,

        messages,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   DELETE / CLEAR CONVERSATION
========================================================= */

router.delete(
  "/messages/:conversationId",
  protect,
  async (req, res, next) => {
    try {
      const {
        conversationId,
      } = req.params;

      /* ==============================================
         Validate
      ============================================== */

      if (
        !mongoose.isValidObjectId(
          conversationId
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid conversation",
          });
      }

      /* ==============================================
         Check access
      ============================================== */

      const conversation =
        await Conversation.findOne(
          {
            _id:
              conversationId,

            participants:
              req.user._id,
          }
        );

      if (!conversation) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Access denied",
          });
      }

      /* ==============================================
         Delete all messages
      ============================================== */

      const result =
        await Message.deleteMany(
          {
            conversation:
              conversation._id,
          }
        );

      return res.status(200).json({
        success:
          true,
        message:
          "Conversation cleared successfully",

        deletedCount:
          result.deletedCount,
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   SERVERLESS-FRIENDLY SEND MESSAGE
   Used by Vercel because persistent Socket.IO connections
   are not available in Vercel Functions.
========================================================= */

router.post(
  "/messages",
  protect,
  async (req, res, next) => {
    try {
      const { conversationId, receiverId, text, message_type = "text" } = req.body || {};

      if (!conversationId || !receiverId || typeof text !== "string" || !text.trim() || text.length > 5000) {
        return res.status(400).json({
          success: false,
          message: "Invalid message",
        });
      }

      if (String(req.user._id) === String(receiverId)) {
        return res.status(400).json({
          success: false,
          message: "Cannot send message to yourself",
        });
      }

      if (!mongoose.isValidObjectId(conversationId) || !mongoose.isValidObjectId(receiverId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation or receiver",
        });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: { $all: [req.user._id, receiverId], $size: 2 },
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      const message = await Message.create({
        conversation: conversation._id,
        sender: req.user._id,
        receiver: receiverId,
        text: text.trim(),
        message_type: ["text", "image"].includes(message_type) ? message_type : "text",
      });

      return res.status(201).json({
        success: true,
        message: {
          ...message.toObject(),
          status: "sent",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/* =========================================================
   SERVERLESS-FRIENDLY MARK READ
========================================================= */

router.post(
  "/messages/:conversationId/read",
  protect,
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;

      if (!mongoose.isValidObjectId(conversationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation",
        });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: req.user._id,
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const result = await Message.updateMany(
        {
          conversation: conversationId,
          receiver: req.user._id,
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        },
      );

      return res.json({
        success: true,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;