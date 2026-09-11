import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchPublication } from "./notion.js";
import { validatePublication } from "./validate.js";
import { buildPublication, publishPublication } from "./pipeline.js";

const [, , command, slug] = process.argv;
if (!command || !slug) {
  console.error("Usage: npm run <fetch|validate|build|publish> -- <book-slug>");
  process.exit(2);
}
const book = await fetchPublication(slug);
const buildRoot = path.resolve(".build", slug);
await mkdir(buildRoot, { recursive: true });
await writeFile(path.join(buildRoot, "book.json"), JSON.stringify(book, null, 2));
if (command === "fetch") {
  console.log(`Fetched ${book.title}: ${book.pages.length} pages, ${Object.keys(book.media).length} media records.`);
  process.exit(0);
}
const issues = validatePublication(book);
for (const issue of issues) console.log(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
const errors = issues.filter((issue) => issue.severity === "error");
if (errors.length) {
  console.error(`Validation failed with ${errors.length} error(s).`);
  process.exit(1);
}
if (command === "validate") {
  console.log(`Validation passed with ${issues.length} warning(s).`);
  process.exit(0);
}
if (command === "build") {
  const result = await buildPublication(book);
  console.log(result.epubPath);
} else if (command === "publish") {
  const result = await publishPublication(book);
  console.log(result.releaseUrl);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(2);
}
