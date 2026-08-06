import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";

/**
 * Writes `content` to `filePath`, never silently clobbering a differing
 * existing file. Returns one of: "created" | "unchanged" | "overwritten" | "appended" | "kept".
 *
 * @param {string} filePath
 * @param {string} content
 * @param {{ select?: Function }} [deps] - Optional injectable prompt dependencies for testing.
 */
export async function writeManaged(filePath, content, deps = {}) {
  const select = deps.select ?? ((...args) => p.select(...args));

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    return "created";
  }

  const existing = fs.readFileSync(filePath, "utf8");
  if (existing === content) {
    return "unchanged";
  }

  const choice = await select({
    message: `${path.relative(process.cwd(), filePath)} already exists and differs from the generated version. What do you want to do?`,
    options: [
      { value: "keep", label: "Keep existing file (skip)" },
      { value: "overwrite", label: "Overwrite with the generated version" },
      { value: "append", label: "Append the generated content to the existing file" },
      { value: "diff", label: "Show a short diff first" },
    ],
  });

  if (p.isCancel(choice)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }

  if (choice === "diff") {
    printShortDiff(existing, content);
    return writeManaged(filePath, content, deps);
  }

  if (choice === "overwrite") {
    fs.writeFileSync(filePath, content);
    return "overwritten";
  }

  if (choice === "append") {
    const separator = existing.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(filePath, existing + separator + content);
    return "appended";
  }

  return "kept";
}

function printShortDiff(existing, next) {
  const a = existing.split("\n");
  const b = next.split("\n");
  const max = Math.max(a.length, b.length);
  let shown = 0;
  for (let i = 0; i < max && shown < 20; i++) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) console.log(`  - ${a[i]}`);
      if (b[i] !== undefined) console.log(`  + ${b[i]}`);
      shown++;
    }
  }
  if (shown === 0) console.log("  (only whitespace/line-ending differences)");
}
