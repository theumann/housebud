import type { TestContext } from "./testFactory";

let ctx: TestContext | null = null;

export function setTestContext(c: TestContext) {
  ctx = c;
}

export function getTestContext(): TestContext {
  if (!ctx) {
    throw new Error("❌ TestContext not initialized. Did setup.ts run?");
  }
  return ctx;
}
