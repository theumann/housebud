// import { describe, it, expect } from "vitest";
// import request from "supertest";
// import { app } from "../../src/app";
// import { signupUser, createRoom, listRooms, sendMessage } from "../helpers/testFactory";

// describe("Chat", () => {
//   it("create room -> invitee sees pending invite -> accept -> appears in rooms", async () => {
//     const owner = await signupUser({ nickname: "owner" });
//     const invitee = await signupUser({ nickname: "invitee" });

//     const created = await createRoom(owner.token, [invitee.userId], "Test Room");
//     expect(created.roomId).toBeTruthy();

//     // invitee should see invite
//     const before = await listRooms(invitee.token);
//     expect(before.invites.some((r: any) => r.id === created.roomId)).toBe(true);

//     // accept
//     const acceptRes = await request(app)
//       .post(`/chatrooms/${created.roomId}/accept`)
//       .set("Authorization", `Bearer ${invitee.token}`);
//     expect(acceptRes.status).toBe(200);

//     const after = await listRooms(invitee.token);
//     expect(after.invites.some((r: any) => r.id === created.roomId)).toBe(false);
//     expect(after.rooms.some((r: any) => r.id === created.roomId)).toBe(true);
//   });

//   it("send message -> message appears in GET messages", async () => {
//     const owner = await signupUser({ nickname: "owner" });
//     const invitee = await signupUser({ nickname: "invitee" });

//     const created = await createRoom(owner.token, [invitee.userId], "Msg Room");

//     // accept invitee so both can read
//     await request(app)
//       .post(`/chatrooms/${created.roomId}/accept`)
//       .set("Authorization", `Bearer ${invitee.token}`);

//     await sendMessage(owner.token, created.roomId, "hello there");

//     const msgs = await request(app)
//       .get(`/chatrooms/${created.roomId}/messages`)
//       .set("Authorization", `Bearer ${invitee.token}`);

//     expect(msgs.status).toBe(200);
//     expect(Array.isArray(msgs.body)).toBe(true);
//     expect(msgs.body.some((m: any) => m.text === "hello there")).toBe(true);
//   });
// });
