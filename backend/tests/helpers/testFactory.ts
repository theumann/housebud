import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/db";
import { expect } from "vitest";

type SignupResult = {
  token: string;
  userId?: string; // if your /auth/signup returns it (optional)
};

let userSeq = 1;

export async function signupUser(params?: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;   // "YYYY-MM-DD"
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
}>) {
  const n = userSeq++;

  const body = {
    email: params?.email ?? `user${n}@example.com`,
    password: params?.password ?? "Password123!",
    firstName: params?.firstName ?? "John",
    lastName: params?.lastName ?? "Doe",
    nickname: params?.nickname ?? `user${n}`,
    birthDate: params?.birthDate ?? "2005-09-15",
    school: params?.school ?? "USF",
    collegeYear: params?.collegeYear ?? "Freshman",
    targetCity: params?.targetCity ?? "San Francisco",
    targetState: params?.targetState ?? "CA",
    targetZip: params?.targetZip ?? "94117",
  };

  const res = await request(app).post("/auth/signup").send(body);

  if (res.status !== 201) {
    throw new Error(`signup failed ${res.status}: ${JSON.stringify(res.body)}`);
  }

  const token = res.body?.token as string;
  if (!token) throw new Error(`signup missing token: ${JSON.stringify(res.body)}`);

  // Get userId reliably
  const me = await request(app)
    .get("/profile/me")
    .set("Authorization", `Bearer ${token}`);

  const userId = me.body?.profile?.userId ?? me.body?.userId;
  if (!userId) throw new Error(`Could not determine userId from /profile/me: ${JSON.stringify(me.body)}`);

  return { token, userId, body };
}

export async function setProfileCreatedAt(userId: string, createdAt: Date) {
  await prisma.userProfile.update({
    where: { userId },
    data: { createdAt, updatedAt: createdAt },
  });
}

export async function createQuestion(params: {
  code: string;
  text: string;
  options?: string[] | null;
  category?: string;
  helperText?: string | null;
  isActive?: boolean;
  orderIndex?: number;
  type?: "single_choice" | "scale_1_5" | "free_text";
}) {
  return prisma.compatibilityQuestion.create({
    data: {
      code: params.code,
      text: params.text,
      type: params.type ?? "single_choice",
      options: (params.options ?? null) as any,
      category: params.category ?? "General",
      helperText: params.helperText ?? null,
      isActive: params.isActive ?? true,
      orderIndex: params.orderIndex ?? 0,
    },
  });
}

export async function loginUser(app: any, email: string, password: string) {
  const res = await request(app).post("/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return {
    token: res.body.token as string,
    userId: (res.body.user?.id ?? res.body.userId) as string | undefined,
  };
}

export async function answerQuestions(token: string, answers: { questionId: string; value: string }[]) {
  const res = await request(app)
    .put("/compatibility/answers/me")
    .set("Authorization", `Bearer ${token}`)
    .send(answers);

  if (res.status !== 200) {
    throw new Error(`answerQuestions failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function createRoom(token: string, participantIds: string[], name?: string) {
  const body: any = { participantIds };
  if (name) body.name = name;

  const res = await request(app)
    .post("/chatrooms")
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  if (res.status !== 200) {
    throw new Error(`createRoom failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as { roomId: string };
}

export async function sendMessage(token: string, roomId: string, text: string) {
  const res = await request(app)
    .post(`/chatrooms/${roomId}/messages`)
    .set("Authorization", `Bearer ${token}`)
    .send({ text });

  if (res.status !== 200) {
    throw new Error(`sendMessage failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function listRooms(token: string) {
  const res = await request(app)
    .get("/chatrooms")
    .set("Authorization", `Bearer ${token}`);

  if (res.status !== 200) {
    throw new Error(`listRooms failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as { rooms: any[]; invites: any[] };
}

export async function respondToInvite(
  app: any,
  token: string,
  roomId: string,
  action: "accept" | "decline"
) {
  const res = await request(app)
    .post(`/chatrooms/${roomId}/${action}`)
    .set("Authorization", `Bearer ${token}`);
  expect([200, 204]).toContain(res.status);
}

export async function getMyAnswers(app: any, token: string) {
  const res = await request(app)
    .get("/compatibility/answers/me")
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  // your API might return [] or { answers: [] }
  const answers = Array.isArray(res.body) ? res.body : res.body.answers;
  return answers as Array<{ questionId: string; value: string }>;
}
