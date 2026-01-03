import type { PrismaClient } from "@prisma/client";
import {
  CreateChatRoomInput,
  InviteToChatInput,
  SendMessageInput,
  UpdateChatRoomInput,
} from "./chat.types";

type RoomSummary = {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  createdByUserId: string | null;
  role: string;
  status: string;
  participantsCount: number;
  latestMessageAt: string | null;
  latestMessageText: string | null;
};

type MessageDto = {
  id: string;
  chatRoomId: string;
  senderUserId: string;
  text: string;
  createdAt: Date;
  senderNickname: string | null;
  senderFirstName: string | null;
  senderAvatarUrl?: string | null;
};

type ChatParticipant = {
  id: string;
  userId: string;
  chatRoomId: string;
  role: string;
  status: string;
  createdAt: Date;
};

type ChatRoomDetail = {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  createdByUserId: string | null;
  myRole: string;
  myStatus: string;
  participantsCount: number;
};

async function getAcceptedRoomCount(prisma: PrismaClient, userId: string): Promise<number> {
  const count = await prisma.chatRoomParticipant.count({
    where: {
      userId,
      status: "accepted",
    },
  });
  return count;
}

async function ensureCanJoinAnotherRoom(prisma: PrismaClient, userId: string) {
  const count = await getAcceptedRoomCount(prisma, userId);
  if (count >= 3) {
    const err: any = new Error("User is already in the maximum number of rooms (3)");
    err.status = 400;
    throw err;
  }
}

export async function listChatRoomsForUser(
  prisma: PrismaClient,
  userId: string
): Promise<{ rooms: RoomSummary[]; invites: RoomSummary[] }> {
  const participants = await prisma.chatRoomParticipant.findMany({
    where: { userId },
    include: {
      chatRoom: {
        include: {
          participants: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, text: true },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rooms: RoomSummary[] = [];
  const invites: RoomSummary[] = [];

  for (const p of participants) {
    const room = p.chatRoom;
    const latest = room.messages?.[0] ?? null;
    const summary: RoomSummary = {
      id: room.id,
      name: room.name,
      isActive: room.isActive,
      createdAt: room.createdAt,
      createdByUserId: room.createdByUserId,
      role: p.role,
      status: p.status,
      participantsCount: room.participants.filter(
        (rp: ChatParticipant) => rp.status === "accepted"
      ).length,
      latestMessageAt: latest ? latest.createdAt.toISOString() : null,
      latestMessageText: latest ? latest.text : null,
    };

    if (p.status === "pending") {
      invites.push(summary);
    } else if (p.status === "accepted") {
      rooms.push(summary);
    }
  }

  return { rooms, invites };
}

export async function createChatRoom(
  prisma: PrismaClient,
  ownerUserId: string,
  input: CreateChatRoomInput
): Promise<{ roomId: string }> {
  const {name, participantIds} = input;
  // Enforce: user can own at most 1 active room (accepted)
  const ownedCount = await prisma.chatRoomParticipant.count({
    where: {
      userId: ownerUserId,
      role: "owner",
      status: "accepted",
    },
  });
  if (ownedCount >= 1) {
    const err: any = new Error("User already owns a chat room");
    err.status = 400;
    throw err;
  }

  // Enforce: owner can be in at most 3 accepted rooms
  await ensureCanJoinAnotherRoom(prisma, ownerUserId);

  // Filter out duplicates and self from participants
  const uniqueParticipantIds = Array.from(
    new Set(input.participantIds.filter((id) => id !== ownerUserId))
  );

  if (uniqueParticipantIds.length === 0) {
    const err: any = new Error("Chat room must include at least one other user");
    err.status = 400;
    throw err;
  }

  // Enforce: invited users must also be able to join
  const participantsAcceptedCounts = await prisma.chatRoomParticipant.groupBy({
    by: ["userId"],
    where: {
      userId: { in: uniqueParticipantIds },
      status: "accepted",
    },
    _count: {
      userId: true,
    },
  });

  const countsByUser: Record<string, number> = {};
  for (const row of participantsAcceptedCounts) {
    countsByUser[row.userId] = row._count.userId;
  }

  for (const participantId of uniqueParticipantIds) {
    if ((countsByUser[participantId] || 0) >= 3) {
      const err: any = new Error(
        `User ${participantId} is already in the maximum number of rooms (3)`
      );
      err.status = 400;
      throw err;
    }
  }

  const room = await prisma.chatRoom.create({
    data: {
      name: name ?? null,
      createdByUserId: ownerUserId,
      isActive: true,
      participants: {
        create: [
          {
            userId: ownerUserId,
            role: "owner",
            status: "accepted",
          },
          ...uniqueParticipantIds.map((pid) => ({
            userId: pid,
            role: "member",
            status: "pending",
          })),
        ],
      },
    },
  });

  return { roomId: room.id };
}

export async function inviteToChatRoom(
  prisma: PrismaClient,
  requesterId: string,
  roomId: string,
  input: InviteToChatInput
): Promise<void> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: true,
    },
  });

  if (!room || !room.isActive) {
    const err: any = new Error("Chat room not found or inactive");
    err.status = 404;
    throw err;
  }

const requester = room.participants.find(
    (p: ChatParticipant) => p.userId === requesterId
);

  if (!requester || requester.status !== "accepted") {
    const err: any = new Error("Only room participants can invite others");
    err.status = 403;
    throw err;
  }
  const existingUserIds = new Set(
    room.participants.map((p: ChatParticipant) => p.userId)
  );
  const newParticipantIds = input.participantIds.filter(
    (id) => !existingUserIds.has(id)
  );

  if (newParticipantIds.length === 0) {
    return;
  }

  // Enforce room limit for new invitees
  const participantsAcceptedCounts = await prisma.chatRoomParticipant.groupBy({
    by: ["userId"],
    where: {
      userId: { in: newParticipantIds },
      status: "accepted",
    },
    _count: {
      userId: true,
    },
  });

  const countsByUser: Record<string, number> = {};
  for (const row of participantsAcceptedCounts) {
    countsByUser[row.userId] = row._count.userId;
  }

  for (const participantId of newParticipantIds) {
    if ((countsByUser[participantId] || 0) >= 3) {
      const err: any = new Error(
        `User ${participantId} is already in the maximum number of rooms (3)`
      );
      err.status = 400;
      throw err;
    }
  }

  await prisma.chatRoomParticipant.createMany({
    data: newParticipantIds.map((pid) => ({
      chatRoomId: roomId,
      userId: pid,
      role: "member",
      status: "pending",
    })),
  });
}

export async function respondToInvite(
  prisma: PrismaClient,
  userId: string,
  roomId: string,
  accept: boolean
): Promise<void> {
  const participant = await prisma.chatRoomParticipant.findFirst({
    where: {
      chatRoomId: roomId,
      userId,
    },
  });

  if (!participant) {
    const err: any = new Error("Invite not found");
    err.status = 404;
    throw err;
  }

  if (participant.status !== "pending") {
    const err: any = new Error("Invite is not pending");
    err.status = 400;
    throw err;
  }

  if (!accept) {
    await prisma.chatRoomParticipant.update({
      where: { id: participant.id },
      data: { status: "declined" },
    });
    return;
  }

  // Accepting: enforce 3-room limit
  await ensureCanJoinAnotherRoom(prisma, userId);

  await prisma.chatRoomParticipant.update({
    where: { id: participant.id },
    data: { status: "accepted" },
  });
}

export async function getChatRoomDetailsForUser(
  prisma: PrismaClient,
  userId: string,
  roomId: string
): Promise<ChatRoomDetail> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: true,
    },
  });

  if (!room) {
    const err: any = new Error("Chat room not found");
    err.status = 404;
    throw err;
  }

  const myParticipant = room.participants.find(
    (p: ChatParticipant) => p.userId === userId
  );

  if (!myParticipant || myParticipant.status !== "accepted") {
    const err: any = new Error("You are not an accepted participant in this room");
    err.status = 403;
    throw err;
  }

  const participantsCount = room.participants.filter(
    (p: ChatParticipant) => p.status === "accepted"
  ).length;

  return {
    id: room.id,
    name: room.name,
    isActive: room.isActive,
    createdAt: room.createdAt,
    createdByUserId: room.createdByUserId,
    myRole: myParticipant.role,
    myStatus: myParticipant.status,
    participantsCount,
  };
}

export async function renameChatRoom(
  prisma: PrismaClient,
  requesterId: string,
  roomId: string,
  input: UpdateChatRoomInput
): Promise<void> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: true,
    },
  });

  if (!room) {
    const err: any = new Error("Chat room not found");
    err.status = 404;
    throw err;
  }

  const requester = room.participants.find(
    (p: ChatParticipant) => p.userId === requesterId
  );

  if (!requester || requester.role !== "owner" || requester.status !== "accepted") {
    const err: any = new Error("Only the room owner can rename the room");
    err.status = 403;
    throw err;
  }

  await prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      name: input.name,
    },
  });
}


export async function leaveChatRoom(
  prisma: PrismaClient,
  userId: string,
  roomId: string
): Promise<void> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: true,
    },
  });

  if (!room) {
    const err: any = new Error("Chat room not found");
    err.status = 404;
    throw err;
  }

  const participant = room.participants.find(
    (p: ChatParticipant) => p.userId === userId
);
  if (!participant || participant.status !== "accepted") {
    const err: any = new Error("User is not an active participant in this room");
    err.status = 400;
    throw err;
  }

  // Mark user as left
  await prisma.chatRoomParticipant.update({
    where: { id: participant.id },
    data: { status: "left" },
  });

  // If user was owner, transfer ownership to oldest accepted member
  if (participant.role === "owner") {
    const remainingAccepted = room.participants
    .filter(
        (p: ChatParticipant) =>
        p.userId !== userId && p.status === "accepted"
    )
    .sort(
        (a: ChatParticipant, b: ChatParticipant) =>
        a.createdAt.getTime() - b.createdAt.getTime()
    );

    if (remainingAccepted.length > 0) {
      const newOwner = remainingAccepted[0];

      await prisma.$transaction([
        prisma.chatRoomParticipant.update({
          where: { id: newOwner.id },
          data: { role: "owner" },
        }),
        prisma.chatRoom.update({
          where: { id: roomId },
          data: { createdByUserId: newOwner.userId },
        }),
      ]);
    }
  }

  // After leaving, if < 2 accepted participants remain, mark room inactive
  const acceptedCount = await prisma.chatRoomParticipant.count({
    where: {
      chatRoomId: roomId,
      status: "accepted",
    },
  });

  if (acceptedCount < 2) {
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { isActive: false },
    });
  }
}

export async function kickParticipant(
  prisma: PrismaClient,
  requesterId: string,
  roomId: string,
  targetUserId: string
): Promise<void> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: true,
    },
  });

  if (!room) {
    const err: any = new Error("Chat room not found");
    err.status = 404;
    throw err;
  }

  const requester = room.participants.find(
  (p: ChatParticipant) => p.userId === requesterId
);
  if (!requester || requester.role !== "owner" || requester.status !== "accepted") {
    const err: any = new Error("Only the owner can kick participants");
    err.status = 403;
    throw err;
  }

const target = room.participants.find(
  (p: ChatParticipant) => p.userId === targetUserId
);
  if (!target) {
    const err: any = new Error("Target user is not a participant in this room");
    err.status = 400;
    throw err;
  }

  if (target.role === "owner") {
    const err: any = new Error("Cannot kick the owner");
    err.status = 400;
    throw err;
  }

  await prisma.chatRoomParticipant.update({
    where: { id: target.id },
    data: { status: "removed" },
  });

  // After kicking, if < 2 accepted participants remain, mark room inactive
  const acceptedCount = await prisma.chatRoomParticipant.count({
    where: {
      chatRoomId: roomId,
      status: "accepted",
    },
  });

  if (acceptedCount < 2) {
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { isActive: false },
    });
  }
}

export async function getMessages(
  prisma: PrismaClient, 
  userId: string,
  roomId: string,
  after?: Date,
): Promise<MessageDto[]> {
  const participant = await prisma.chatRoomParticipant.findFirst({
    where: {
      chatRoomId: roomId,
      userId,
      status: "accepted",
    },
  });

  if (!participant) {
    const err: any = new Error("User is not an accepted participant in this room");
    err.status = 403;
    throw err;
  }

  const where: any = { chatRoomId: roomId };
  if (after) {
    where.createdAt = { gt: after };
  }

  const messages = await prisma.chatMessage.findMany({
    where: { chatRoomId: roomId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        include: {
          profile: true,
        },
      },
    },
  });

  return messages.map((m) => ({
    id: m.id,
    chatRoomId: m.chatRoomId,
    senderUserId: m.senderUserId,
    text: m.text,
    createdAt: m.createdAt,
    senderNickname: m.sender.profile?.nickname ?? null,
    // adjust this line to your real schema:
    senderFirstName: m.sender.profile?.firstName ?? null,
    senderAvatarUrl: m.sender.profile?.avatarUrl ?? null,
  }));
}

export async function sendMessage(
  prisma: PrismaClient,
  userId: string,
  roomId: string,
  input: SendMessageInput
): Promise<MessageDto> {
  const participant = await prisma.chatRoomParticipant.findFirst({
    where: {
      chatRoomId: roomId,
      userId,
      status: "accepted",
    },
  });

  if (!participant) {
    const err: any = new Error("User is not an accepted participant in this room");
    err.status = 403;
    throw err;
  }

  const msg = await prisma.chatMessage.create({
    data: {
      chatRoomId: roomId,
      senderUserId: userId,
      text: input.text,
    },
    include: {
      sender: {
        include: {
          profile: true,
        },
      },
    },
  });
  return {
    id: msg.id,
    chatRoomId: msg.chatRoomId,
    senderUserId: msg.senderUserId,
    text: msg.text,
    createdAt: msg.createdAt,
    senderNickname: msg.sender.profile?.nickname ?? null,
    senderFirstName: msg.sender.profile?.firstName ?? null,
    senderAvatarUrl: msg.sender.profile?.avatarUrl ?? null,
  };
}
