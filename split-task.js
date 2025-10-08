// split_tasks.js
import fs from "fs";
import path from "path";

// === CONFIGURATION ===
// Path to your Label Studio export JSON file
const INPUT_FILE = "./export_192012_project-192012-at-2025-10-02-20-33-30fbfd7f.json";
// Where to store the split tasks
const OUTPUT_DIR = "./data/export_192012_project-192012-at-2025-10-06-15-39-b11df1e3";

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`❌ Input file not found: ${INPUT_FILE}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

// Label Studio exports can vary: array or object
const tasks = Array.isArray(raw)
  ? raw
  : raw.tasks || raw.results || [];

if (tasks.length === 0) {
  console.error("❌ No tasks found in the file.");
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
console.log(`📁 Created output directory: ${OUTPUT_DIR}`);

let count = 0;
tasks.forEach((task, i) => {
  const taskId = task.id || i + 1;
  const outputFile = path.join(OUTPUT_DIR, `task_${taskId}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(task, null, 2));
  count++;
});

console.log(`✅ Split complete! ${count} tasks written to ${OUTPUT_DIR}`);
