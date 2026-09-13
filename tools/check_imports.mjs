// Static check: every relative import resolves, and every named import is
// actually exported by its target. There is no build step or type checker
// here, so a renamed export otherwise fails only in the browser at runtime.
//
// Run: node tools/check_imports.mjs

import fs from "fs";
import path from "path";

const dir = new URL("../src/", import.meta.url).pathname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
const problems = [];

const exportsOf = (src) => {
  const named = [...src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g
  )].map((m) => m[1]);
  // `export { a, b }` form
  const grouped = [...src.matchAll(/export\s*\{([^}]*)\}(?!\s*from)/g)]
    .flatMap((m) => m[1].split(",").map((n) => n.trim().split(/\s+as\s+/).pop()))
    .filter(Boolean);
  return new Set([...named, ...grouped]);
};

for (const file of files) {
  const src = fs.readFileSync(path.join(dir, file), "utf8");
  for (const m of src.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*["']\.\/([^"']+)["']/g
  )) {
    const target = m[2].split("?")[0];
    const targetPath = path.join(dir, target);
    if (!fs.existsSync(targetPath)) {
      problems.push(`${file}: imports missing module "${target}"`);
      continue;
    }
    const available = exportsOf(fs.readFileSync(targetPath, "utf8"));
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name && !available.has(name)) {
        problems.push(`${file}: "${name}" is not exported by ${target}`);
      }
    }
  }
}

if (problems.length) {
  console.error(problems.map((p) => "  " + p).join("\n"));
  console.error(`\n${problems.length} broken import(s)`);
  process.exit(1);
}
console.log(`${files.length} modules, all imports resolve`);
