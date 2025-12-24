import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/config/db";
import { Prisma } from "@prisma/client";

type Row = {
  code: string;
  text: string;
  helperText?: string;
  type: string;
  options?: string;
  category?: string;
  isActive?: string;
};

function parseBool(v: unknown, defaultValue: boolean): boolean {
  if (v === undefined || v === null) return defaultValue;
  const s = String(v).trim();
  if (s === "") return defaultValue;
  if (/^(true|t|1|yes|y)$/i.test(s)) return true;
  if (/^(false|f|0|no|n)$/i.test(s)) return false;
  throw new Error(`Invalid boolean value: "${s}"`);
}

function parseOptionsJson(raw: unknown): any[] | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) {
      throw new Error("options must be a JSON array");
    }
    // Ensure all options are strings
    const out = parsed.map((x) => String(x));
    return out;
  } catch (e: any) {
    throw new Error(`Invalid JSON in options: ${e.message}. Raw="${s}"`);
  }
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      "Usage: npx tsx scripts/import-questions.ts <path-to-csv>"
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`CSV file not found: ${abs}`);
    process.exit(1);
  }

  const content = fs.readFileSync(abs, "utf8");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  if (records.length === 0) {
    console.log("No rows found in CSV.");
    return;
  }

  // Basic validation + normalization
  const data: Prisma.CompatibilityQuestionCreateManyInput[] = records.map((r, idx) => {
    const code = (r.code || "").trim();
    const text = (r.text || "").trim();
    const helperText = (r.helperText ?? "").trim() || null;

    // NOTE: your CSV shows `single_choice ` (space). This fixes that.
    const type = (r.type || "").trim();

    const category = (r.category ?? "").trim() || "general";
    const isActive = parseBool(r.isActive, true);
    const options = parseOptionsJson(r.options);

    if (!code) throw new Error(`Row ${idx + 2}: missing code`);
    if (!text) throw new Error(`Row ${idx + 2}: missing text`);
    if (!type) throw new Error(`Row ${idx + 2}: missing type`);

    // Enforce type/options consistency (MVP rules)
    if (type === "free_text") {
      // free text should have no options
      return {
        code,
        text,
        helperText,
        type,
        options: Prisma.DbNull,
        category,
        isActive,
      };
    } else {
      // structured questions should have options
      if (!options || options.length === 0) {
        throw new Error(`Row ${idx + 2} (${code}): options required for type="${type}"`);
      }
      return {
        code,
        text,
        helperText,
        type,
        options: options as Prisma.InputJsonValue, // safe
        category,
        isActive,
      };
    }
  });

  // Optional: detect duplicate codes inside the CSV
  const seen = new Set<string>();
  for (const row of data) {
    if (seen.has(row.code)) {
      throw new Error(`Duplicate code in CSV: ${row.code}`);
    }
    seen.add(row.code);
  }

  const result = await prisma.compatibilityQuestion.createMany({
    data,
    skipDuplicates: true, // safe even if rerun
  });

  console.log(`Imported ${result.count} questions (duplicates skipped).`);
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
