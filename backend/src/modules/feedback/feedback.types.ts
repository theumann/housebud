import { z } from "zod";

// About 3 MB of image; the app sends a JPEG of the visible page, well under.
export const MAX_SCREENSHOT_CHARS = 4_000_000;

const dataUrl = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/;

const ScreenshotSchema = z
  .string()
  .max(MAX_SCREENSHOT_CHARS)
  .regex(dataUrl, "must be a JPEG, PNG or WebP data URL")
  .transform((value) => {
    const [, type, base64] = value.match(dataUrl)!;
    return { type, data: Buffer.from(base64, "base64") };
  });

export const CreateFeedbackSchema = z
  .object({
    message: z.string().trim().max(5000).default(""),
    page: z.string().trim().min(1).max(500),
    viewport: z.string().trim().max(20).optional(),
    screenshot: ScreenshotSchema.optional(),
  })
  .refine((f) => f.message || f.screenshot, {
    message: "Describe the problem or include a screenshot",
  });

export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;
