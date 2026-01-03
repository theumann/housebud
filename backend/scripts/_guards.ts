export function assertSafeSeedEnv(expected: "dev" | "test") {
  const url = process.env.DATABASE_URL;
  const env = process.env.NODE_ENV;

  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (expected === "dev") {
    if (!url.includes("bunkbuddy")) {
      throw new Error(`Unsafe DATABASE_URL for dev seed: ${url}`);
    }
    if (url.includes("prod")) {
      throw new Error("Refusing to seed production database");
    }
  }

  if (expected === "test") {
    if (!url.includes("bunkbuddy_test")) {
      throw new Error(`Unsafe DATABASE_URL for test seed: ${url}`);
    }
  }

  if (env === "production") {
    throw new Error("Refusing to run seed scripts in production");
  }
}
