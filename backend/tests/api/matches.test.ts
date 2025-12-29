// import { describe, it, expect } from "vitest";
// import request from "supertest";
// import { app } from "../../src/app";
// import { signupUser, createQuestion, answerQuestions } from "../helpers/testFactory";
// import { resetDb } from "../helpers/resetDb";
// import { setProfileCreatedAt } from "../helpers/testFactory";

// describe("Matches", () => {
//   it("filters candidates by 3-digit targetZip prefix and excludes self", async () => {
//     const me = await signupUser({ targetZip: "94117", nickname: "me" });

//     const samePrefix1 = await signupUser({ targetZip: "94110", nickname: "same1" });
//     const samePrefix2 = await signupUser({ targetZip: "94199", nickname: "same2" });

//     const otherPrefix = await signupUser({ targetZip: "94016", nickname: "other" }); // different prefix

//     const res = await request(app)
//         .get("/matches?page=1")
//         .set("Authorization", `Bearer ${me.token}`);

//     expect(res.status).toBe(200);
//     const items = res.body?.items ?? [];

//     // never include self
//     expect(items.some((x: any) => x.userId === me.userId)).toBe(false);

//     // include same 3-digit prefix users
//     expect(items.some((x: any) => x.userId === samePrefix1.userId)).toBe(true);
//     expect(items.some((x: any) => x.userId === samePrefix2.userId)).toBe(true);

//     // exclude different prefix users
//     expect(items.some((x: any) => x.userId === otherPrefix.userId)).toBe(false);
//   });

//   it("computes score when both users have >=20% coverage and shared answers", async () => {
//     const me = await signupUser({ nickname: "me", targetZip: "94117" });
//     const a = await signupUser({ nickname: "a", targetZip: "94111" }); // same prefix
//     const b = await signupUser({ nickname: "b", targetZip: "94112" }); // same prefix

//     // 10 active questions
//     const qs = await Promise.all(
//         Array.from({ length: 10 }).map((_, i) =>
//         createQuestion({
//             code: `T_Q${i + 1}`,
//             text: `Test Q${i + 1}?`,
//             options: ["A", "B"],
//             isActive: true,
//             orderIndex: i + 1,
//         })
//         )
//     );

//     // me answers 2/10 => 20%
//     await answerQuestions(me.token, [
//         { questionId: qs[0].id, value: "A" },
//         { questionId: qs[1].id, value: "A" },
//     ]);

//     // a matches both => score 100
//     await answerQuestions(a.token, [
//         { questionId: qs[0].id, value: "A" },
//         { questionId: qs[1].id, value: "A" },
//     ]);

//     // b answers 2 but mismatches => score 0 (still not null)
//     await answerQuestions(b.token, [
//         { questionId: qs[0].id, value: "B" },
//         { questionId: qs[1].id, value: "B" },
//     ]);

//     const res = await request(app)
//         .get("/matches?page=1")
//         .set("Authorization", `Bearer ${me.token}`);

//     expect(res.status).toBe(200);
//     const items = res.body?.items ?? [];

//     const aItem = items.find((x: any) => x.userId === a.userId);
//     const bItem = items.find((x: any) => x.userId === b.userId);

//     expect(aItem).toBeTruthy();
//     expect(bItem).toBeTruthy();

//     expect(aItem.score).toBe(100);
//     expect(bItem.score).toBe(0);

//     // coverage should be 0.2 for both candidates (2/10)
//     expect(aItem.coverage).toBeCloseTo(0.2, 5);
//     expect(bItem.coverage).toBeCloseTo(0.2, 5);
//   });
// });


// describe("GET /matches ordering", () => {
//   it("orders scored first by score desc, then createdAt desc", async () => {
//     await resetDb();

//     const me = await signupUser({ nickname: "me", targetZip: "94117" });

//     // 10 active questions
//     const qs = await Promise.all(
//       Array.from({ length: 10 }).map((_, i) =>
//         createQuestion({
//           code: `T_Q${i + 1}`,
//           text: `Q${i + 1}?`,
//           options: ["A", "B"],
//           isActive: true,
//           orderIndex: i + 1,
//         })
//       )
//     );

//     // me answers 2/10 => 20%
//     await answerQuestions(me.token, [
//       { questionId: qs[0].id, value: "A" },
//       { questionId: qs[1].id, value: "A" },
//     ]);

//     const A = await signupUser({ nickname: "A", targetZip: "94110" }); // same prefix
//     const B = await signupUser({ nickname: "B", targetZip: "94111" }); // same prefix
//     const C = await signupUser({ nickname: "C", targetZip: "94112" }); // same prefix (but unscored)

//     // set createdAt just so ties are deterministic if needed
//     await setProfileCreatedAt(A.userId, new Date("2025-01-03T00:00:00.000Z"));
//     await setProfileCreatedAt(B.userId, new Date("2025-01-02T00:00:00.000Z"));
//     await setProfileCreatedAt(C.userId, new Date("2025-01-01T00:00:00.000Z"));

//     // A: coverage >= 20 and matches both => score 100
//     await answerQuestions(A.token, [
//       { questionId: qs[0].id, value: "A" },
//       { questionId: qs[1].id, value: "A" },
//     ]);

//     // B: coverage >= 20 but mismatches => score 0 (still scored group)
//     await answerQuestions(B.token, [
//       { questionId: qs[0].id, value: "B" },
//       { questionId: qs[1].id, value: "B" },
//     ]);

//     // C: < 20% coverage => score null
//     await answerQuestions(C.token, [{ questionId: qs[0].id, value: "A" }]); // 1/10 = 10%

//     const res = await request(app)
//       .get("/matches?page=1&limit=20")
//       .set("Authorization", `Bearer ${me.token}`);

//     expect(res.status).toBe(200);

//     const ids = (res.body.items ?? []).map((x: any) => x.userId);

//     // scored first by score desc
//     expect(ids.indexOf(A.userId)).toBeLessThan(ids.indexOf(B.userId));
//     // scored group before unscored group
//     expect(ids.indexOf(B.userId)).toBeLessThan(ids.indexOf(C.userId));

//     const AItem = res.body.items.find((x: any) => x.userId === A.userId);
//     const BItem = res.body.items.find((x: any) => x.userId === B.userId);
//     const CItem = res.body.items.find((x: any) => x.userId === C.userId);

//     expect(AItem.score).toBe(100);
//     expect(BItem.score).toBe(0);
//     expect(CItem.score).toBeNull();
//   });
//   it("orders unscored by same zip first, then createdAt desc", async () => {
//     await resetDb();

//     const me = await signupUser({ nickname: "me", targetZip: "94117" });

//     // 10 active questions so 1 answer => unscored (<20%)
//     const qs = await Promise.all(
//         Array.from({ length: 10 }).map((_, i) =>
//         createQuestion({
//             code: `U_Q${i + 1}`,
//             text: `UQ${i + 1}?`,
//             options: ["A", "B"],
//             isActive: true,
//             orderIndex: i + 1,
//         })
//         )
//     );

//     // me answers 2/10 => 20% (required so we're not the reason scores are null)
//     await answerQuestions(me.token, [
//         { questionId: qs[0].id, value: "A" },
//         { questionId: qs[1].id, value: "A" },
//     ]);

//     // Unscored candidates (each answers only 1/10 => 10% coverage)
//     const sameZipOld = await signupUser({ nickname: "sameZipOld", targetZip: "94117" });
//     const sameZipNew = await signupUser({ nickname: "sameZipNew", targetZip: "94117" });
//     const nearbyDiffZip = await signupUser({ nickname: "nearbyDiffZip", targetZip: "94110" });

//     await answerQuestions(sameZipOld.token, [{ questionId: qs[0].id, value: "A" }]);
//     await answerQuestions(sameZipNew.token, [{ questionId: qs[0].id, value: "A" }]);
//     await answerQuestions(nearbyDiffZip.token, [{ questionId: qs[0].id, value: "A" }]);

//     // Control createdAt
//     await setProfileCreatedAt(sameZipOld.userId, new Date("2025-01-01T00:00:00.000Z"));
//     await setProfileCreatedAt(sameZipNew.userId, new Date("2025-01-03T00:00:00.000Z"));
//     await setProfileCreatedAt(nearbyDiffZip.userId, new Date("2025-01-02T00:00:00.000Z"));

//     const res = await request(app)
//         .get("/matches?page=1&limit=20")
//         .set("Authorization", `Bearer ${me.token}`);

//     expect(res.status).toBe(200);

//     const items = res.body.items ?? [];

//     // Find positions
//     const idxOld = items.findIndex((x: any) => x.userId === sameZipOld.userId);
//     const idxNew = items.findIndex((x: any) => x.userId === sameZipNew.userId);
//     const idxNear = items.findIndex((x: any) => x.userId === nearbyDiffZip.userId);

//     // same zip first
//     expect(idxNew).toBeLessThan(idxNear);
//     expect(idxOld).toBeLessThan(idxNear);

//     // within same zip: newer first (sameZipNew should come before sameZipOld)
//     expect(idxNew).toBeLessThan(idxOld);

//     // all should be unscored
//     const oldItem = items.find((x: any) => x.userId === sameZipOld.userId);
//     const newItem = items.find((x: any) => x.userId === sameZipNew.userId);
//     const nearItem = items.find((x: any) => x.userId === nearbyDiffZip.userId);

//     expect(oldItem.score).toBeNull();
//     expect(newItem.score).toBeNull();
//     expect(nearItem.score).toBeNull();
//   });
// });
