import { describe, expect, it } from "vitest";
import {
  computeBalances,
  splitEqually,
  suggestTransfers,
} from "../../src/modules/expenses/expenses.service";

const total = (shares: { amountCents: number }[]) =>
  shares.reduce((sum, s) => sum + s.amountCents, 0);

describe("splitEqually", () => {
  it("splits an even amount equally", () => {
    expect(splitEqually(3000, ["a", "b", "c"])).toEqual([
      { userId: "a", amountCents: 1000 },
      { userId: "b", amountCents: 1000 },
      { userId: "c", amountCents: 1000 },
    ]);
  });

  it("gives leftover cents one each to the first user ids", () => {
    expect(splitEqually(1001, ["c", "a", "b"])).toEqual([
      { userId: "a", amountCents: 334 },
      { userId: "b", amountCents: 334 },
      { userId: "c", amountCents: 333 },
    ]);
  });

  it("comes out the same whatever order the members are given in", () => {
    expect(splitEqually(1001, ["b", "c", "a"])).toEqual(
      splitEqually(1001, ["a", "b", "c"]),
    );
  });

  it("splits less than one cent each", () => {
    expect(splitEqually(1, ["a", "b", "c"])).toEqual([
      { userId: "a", amountCents: 1 },
      { userId: "b", amountCents: 0 },
      { userId: "c", amountCents: 0 },
    ]);
  });

  it("gives everything to a single member", () => {
    expect(splitEqually(1234, ["a"])).toEqual([
      { userId: "a", amountCents: 1234 },
    ]);
  });

  it("always adds up to the total", () => {
    for (const amount of [1, 99, 100, 1001, 99999]) {
      for (const people of [1, 2, 3, 4, 7]) {
        const ids = Array.from({ length: people }, (_, i) => `u${i}`);
        const shares = splitEqually(amount, ids);
        expect(total(shares)).toBe(amount);
        const amounts = shares.map((s) => s.amountCents);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(
          1,
        );
      }
    }
  });
});

describe("computeBalances", () => {
  const expense = (paidBy: string, amount: number, among: string[]) => ({
    paidByUserId: paidBy,
    amountCents: amount,
    shares: splitEqually(amount, among),
  });

  it("credits the payer and debits each share", () => {
    const net = computeBalances([expense("a", 3000, ["a", "b", "c"])], []);
    expect(Object.fromEntries(net)).toEqual({ a: 2000, b: -1000, c: -1000 });
  });

  it("a payment moves the balance from the payer to the receiver", () => {
    const net = computeBalances(
      [expense("a", 3000, ["a", "b", "c"])],
      [{ fromUserId: "b", toUserId: "a", amountCents: 1000 }],
    );
    expect(Object.fromEntries(net)).toEqual({ a: 1000, b: 0, c: -1000 });
  });

  it("someone left out of an expense owes nothing for it", () => {
    const net = computeBalances([expense("a", 2000, ["a", "b"])], []);
    expect(net.has("c")).toBe(false);
    expect(Object.fromEntries(net)).toEqual({ a: 1000, b: -1000 });
  });

  it("always adds up to zero", () => {
    const net = computeBalances(
      [
        expense("a", 1001, ["a", "b", "c"]),
        expense("b", 4550, ["a", "b"]),
        expense("c", 777, ["a", "b", "c", "d"]),
      ],
      [{ fromUserId: "d", toUserId: "c", amountCents: 150 }],
    );
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("suggestTransfers", () => {
  const settle = (
    net: Map<string, number>,
    transfers: ReturnType<typeof suggestTransfers>,
  ) => {
    const after = new Map(net);
    for (const t of transfers) {
      after.set(t.fromUserId, after.get(t.fromUserId)! + t.amountCents);
      after.set(t.toUserId, after.get(t.toUserId)! - t.amountCents);
    }
    return after;
  };

  it("one debtor pays one creditor", () => {
    expect(
      suggestTransfers(
        new Map([
          ["a", 1300],
          ["b", -1300],
        ]),
      ),
    ).toEqual([{ fromUserId: "b", toUserId: "a", amountCents: 1300 }]);
  });

  it("the biggest debtor pays the biggest creditor first", () => {
    expect(
      suggestTransfers(
        new Map([
          ["a", 2000],
          ["b", -500],
          ["c", -1500],
        ]),
      ),
    ).toEqual([
      { fromUserId: "c", toUserId: "a", amountCents: 1500 },
      { fromUserId: "b", toUserId: "a", amountCents: 500 },
    ]);
  });

  it("leaves out people who are even", () => {
    const transfers = suggestTransfers(
      new Map([
        ["a", 500],
        ["b", 0],
        ["c", -500],
      ]),
    );
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ fromUserId: "c", toUserId: "a" });
  });

  it("suggests nothing when everyone is even", () => {
    expect(suggestTransfers(new Map([["a", 0]]))).toEqual([]);
  });

  it("breaks ties by user id, so the suggestion doesn't change between loads", () => {
    const net = new Map([
      ["b", 500],
      ["a", 500],
      ["c", -1000],
    ]);
    expect(suggestTransfers(net)).toEqual([
      { fromUserId: "c", toUserId: "a", amountCents: 500 },
      { fromUserId: "c", toUserId: "b", amountCents: 500 },
    ]);
  });

  it("settles everyone, in fewer transfers than people", () => {
    const net = new Map([
      ["a", 4210],
      ["b", -1333],
      ["c", 75],
      ["d", -2952],
      ["e", 0],
    ]);
    const transfers = suggestTransfers(net);
    expect([...settle(net, transfers).values()].every((c) => c === 0)).toBe(
      true,
    );
    expect(transfers.length).toBeLessThan(net.size);
    expect(transfers.every((t) => t.amountCents > 0)).toBe(true);
  });

  it("doesn't change the balances it was given", () => {
    const net = new Map([
      ["a", 100],
      ["b", -100],
    ]);
    suggestTransfers(net);
    expect(Object.fromEntries(net)).toEqual({ a: 100, b: -100 });
  });
});
