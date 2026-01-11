const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_CONCURRENCY = 3;

/**
 * プロジェクトディレクトリを検索
 */
function findProjects(baseDir) {
  const projects = [];
  const projectsDir = path.join(baseDir, "projects");

  if (!fs.existsSync(projectsDir)) {
    return projects;
  }

  function searchDir(dir, depth = 0) {
    if (depth > 3) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        const claspJson = path.join(fullPath, ".clasp.json");
        if (fs.existsSync(claspJson)) {
          projects.push(fullPath);
        } else {
          searchDir(fullPath, depth + 1);
        }
      }
    }
  }

  searchDir(projectsDir);
  return projects;
}

/**
 * コマンド実行（Promise化）
 */
function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        error: err.message,
        code: -1
      });
    });
  });
}

/**
 * 並列実行（チャンク単位）
 */
async function runParallel(projects, claspArgs, concurrency) {
  const results = { success: [], failed: [] };

  // チャンクに分割
  const chunks = [];
  for (let i = 0; i < projects.length; i += concurrency) {
    chunks.push(projects.slice(i, i + concurrency));
  }

  console.log(`Found ${projects.length} project(s)`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Chunks: ${chunks.length}`);
  console.log("");

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkNames = chunk.map((p) => path.basename(p)).join(", ");
    console.log(`[Chunk ${i + 1}/${chunks.length}] ${chunkNames}`);

    // チャンク内を並列実行
    const promises = chunk.map(async (project) => {
      const name = path.basename(project);
      const startTime = Date.now();

      const result = await runCommand("clasp", claspArgs, project);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      return { project, name, elapsed, ...result };
    });

    const chunkResults = await Promise.all(promises);

    chunkResults.forEach((r) => {
      if (r.success) {
        console.log(`  ✓ ${r.name} (${r.elapsed}s)`);
        results.success.push({ path: r.project, name: r.name });
      } else {
        const errorMsg = r.stderr || r.error || "Unknown error";
        console.log(`  ✗ ${r.name} (${r.elapsed}s)`);
        console.log(`    Error: ${errorMsg.split("\n")[0]}`);
        results.failed.push({ path: r.project, name: r.name, error: errorMsg });
      }
    });

    console.log("");
  }

  return results;
}

/**
 * 現在のブランチを取得
 */
async function getCurrentBranch() {
  const result = await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.success ? result.stdout : null;
}

/**
 * 使用方法を表示
 */
function showUsage() {
  console.log(`
Usage: node scripts/clasp-runner.js <command> [options]

Commands:
  push    Push all projects to GAS
  pull    Pull all projects from GAS

Options:
  --force, -f       Force overwrite (push only)
  --jobs, -j <n>    Number of parallel jobs (default: 3)
  --help, -h        Show this help

Environment Variables:
  PARALLEL_JOBS     Number of parallel jobs (default: 3)

Examples:
  node scripts/clasp-runner.js push
  node scripts/clasp-runner.js push --force
  node scripts/clasp-runner.js pull --jobs 5
  PARALLEL_JOBS=4 node scripts/clasp-runner.js push
`);
}

/**
 * 引数をパース
 */
function parseArgs(args) {
  const result = {
    command: null,
    force: false,
    jobs: parseInt(process.env.PARALLEL_JOBS || DEFAULT_CONCURRENCY, 10),
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--force" || arg === "-f") {
      result.force = true;
    } else if (arg === "--jobs" || arg === "-j") {
      result.jobs = parseInt(args[++i], 10) || DEFAULT_CONCURRENCY;
    } else if (!arg.startsWith("-") && !result.command) {
      result.command = arg;
    }
  }

  return result;
}

/**
 * メイン
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    showUsage();
    process.exit(args.help ? 0 : 1);
  }

  const command = args.command.toLowerCase();

  if (!["push", "pull"].includes(command)) {
    console.error(`Error: Unknown command '${command}'`);
    showUsage();
    process.exit(1);
  }

  // ブランチチェック（pushの場合のみ）
  if (command === "push") {
    const branch = await getCurrentBranch();
    if (branch !== "master" && branch !== "main") {
      console.error(`Error: Can't push from branch '${branch}'`);
      console.error("Push is only allowed from master or main branch.");
      process.exit(1);
    }
  }

  // プロジェクト検索
  const baseDir = process.cwd();
  const projects = findProjects(baseDir);

  if (projects.length === 0) {
    console.log("No projects found.");
    process.exit(0);
  }

  // clasp コマンド引数を構築
  const claspArgs = [command];
  if (command === "push" && args.force) {
    claspArgs.push("--force");
  }

  console.log(`Running: clasp ${claspArgs.join(" ")}`);
  console.log("");

  // 並列実行
  const results = await runParallel(projects, claspArgs, args.jobs);

  // サマリー
  console.log("========== Summary ==========");
  console.log(`Success: ${results.success.length} project(s)`);
  results.success.forEach((p) => console.log(`  ✓ ${p.name}`));

  if (results.failed.length > 0) {
    console.log("");
    console.log(`Failed: ${results.failed.length} project(s)`);
    results.failed.forEach((p) => console.log(`  ✗ ${p.name}`));
    console.log("=============================");
    process.exit(1);
  }

  console.log("=============================");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
