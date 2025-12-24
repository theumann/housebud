import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import {
  listChatRoomsHandler,
  createChatRoomHandler,
  inviteToChatRoomHandler,
  acceptInviteHandler,
  declineInviteHandler,
  leaveChatRoomHandler,
  kickParticipantHandler,
  getMessagesHandler,
  sendMessageHandler,
  getChatRoomDetailsHandler,
  renameChatRoomHandler,
} from "./chat.controller";

const router = Router();

// List rooms + invites
router.get("/", authMiddleware, listChatRoomsHandler);

// Room details for current user
router.get("/:roomId", authMiddleware, getChatRoomDetailsHandler);

// Rename room (owner only)
router.patch("/:roomId", authMiddleware, renameChatRoomHandler);

// Create room
router.post("/", authMiddleware, createChatRoomHandler);

// Invite more participants
router.post("/:roomId/invite", authMiddleware, inviteToChatRoomHandler);

// Accept / decline invite
router.post("/:roomId/accept", authMiddleware, acceptInviteHandler);
router.post("/:roomId/decline", authMiddleware, declineInviteHandler);

// Leave room
router.post("/:roomId/leave", authMiddleware, leaveChatRoomHandler);

// Kick participant (owner only)
router.post("/:roomId/kick", authMiddleware, kickParticipantHandler);

// Messages (polling)
router.get("/:roomId/messages", authMiddleware, getMessagesHandler);
router.post("/:roomId/messages", authMiddleware, sendMessageHandler);

export default router;
