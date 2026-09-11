const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_CONCURRENCY = 3;

/**
 * プロジェクトディレクトリを検索
 */
function findProjects(baseDir, filterNames = []) {
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
          // フィルタが指定されている場合はマッチするもののみ追加
          if (filterNames.length === 0 || filterNames.includes(entry.name)) {
            projects.push(fullPath);
          }
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
 * 利用可能なプロジェクト一覧を取得
 */
function listProjects(baseDir) {
  const projects = findProjects(baseDir);
  return projects.map((p) => path.basename(p));
}

/**
 * startDir 自身または配下にある .clasp.json のディレクトリをすべて列挙する
 * startDir 自身が .clasp.json を持つ場合はそれ単体を返し、配下は探索しない。
 * プロジェクト名ではなくパスで指定できるため、カテゴリ単位の一括指定にも使える
 */
function findClaspJsonDirsUnder(startDir) {
  if (!fs.existsSync(startDir)) return [];
  if (fs.existsSync(path.join(startDir, ".clasp.json"))) return [startDir];

  const results = [];
  const queue = [startDir];
  while (queue.length > 0) {
    const dir = queue.shift();
    if (fs.existsSync(path.join(dir, ".clasp.json"))) {
      results.push(dir);
      continue;
    }
    const subDirs = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
    queue.push(...subDirs);
  }
  return results.sort();
}

/**
 * clasp を stdio 継承で実行し、終了コードを返す
 *
 * stdout を継承するのは、clasp がブラウザ起動や対話プロンプトの可否を
 * process.stdout.isTTY で判断するため。パイプすると URL を出力するだけで終わる
 */
function runClaspInherit(dir, args) {
  console.log(`Executing clasp ${args.join(" ")} in: ${path.basename(dir)}`);
  const result = spawnSync("clasp", args, { cwd: dir, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
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
 * clasp のメジャーバージョンを返す（取得できない場合は null）
 * サブコマンド名が 2.x と 3.x で異なるため、呼び分けの判定に使う
 */
let claspMajorCache;
async function getClaspMajorVersion() {
  if (claspMajorCache !== undefined) return claspMajorCache;
  const result = await runCommand("clasp", ["--version"], process.cwd());
  const match = result.success ? result.stdout.match(/(\d+)\./) : null;
  claspMajorCache = match ? Number(match[1]) : null;
  return claspMajorCache;
}

/**
 * アカウントを特定できなかったが、認証情報自体は存在する場合に返す目印
 */
const UNKNOWN_ACCOUNT = Symbol("unknown-account");

/**
 * JWT（id_token）のペイロードから email を取り出す。検証はせず表示用途にのみ使う
 */
function decodeEmailFromIdToken(idToken) {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json.email || null;
  } catch {
    return null;
  }
}

/**
 * ~/.clasprc.json から認証状態を読む（clasp 2.x には show-authorized-user が無いため）
 * 認証情報があれば email、email を特定できなければ UNKNOWN_ACCOUNT、無ければ null
 */
function readAuthorizedUserFromClasprc() {
  const clasprcPath = path.join(os.homedir(), ".clasprc.json");
  if (!fs.existsSync(clasprcPath)) return null;

  try {
    const store = JSON.parse(fs.readFileSync(clasprcPath, "utf8"));
    // clasp 2.x（V1形式）と 3.x（tokens 配下）の双方を見る
    const candidates = [store.token, ...Object.values(store.tokens || {})].filter(Boolean);
    if (candidates.length === 0) return null;

    for (const token of candidates) {
      const email = token.id_token && decodeEmailFromIdToken(token.id_token);
      if (email) return email;
    }
    return UNKNOWN_ACCOUNT;
  } catch {
    return null;
  }
}

/**
 * 現在 clasp にログインしている Google アカウントを返す（未ログイン時は null）
 *
 * clasp 3.x は show-authorized-user を持つが 2.x には無く、2.x では常に失敗する。
 * そのため 3.x のコマンドを試したあと ~/.clasprc.json の直接読み取りにフォールバックする。
 */
async function getAuthorizedUser() {
  const result = await runCommand("clasp", ["--json", "show-authorized-user"], process.cwd());
  if (result.success) {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.loggedIn && parsed.email) return parsed.email;
      if (parsed.loggedIn) return UNKNOWN_ACCOUNT;
    } catch {
      // JSON として読めない場合はフォールバックに回す
    }
  }
  return readAuthorizedUserFromClasprc();
}

/**
 * 現在ログイン中の clasp アカウントが project の scriptId にアクセスできるかを
 * 副作用のない `clasp deployments` で確認する
 */
async function hasClaspAccess(project) {
  const result = await runCommand("clasp", ["deployments"], project);
  return result.success;
}

/**
 * git の未コミット差分から、変更されたファイルのパス一覧を取得する
 * core.quotePath=false でこのコマンドに限り日本語ファイル名をエスケープさせない
 */
function findChangedFiles(baseDir) {
  const result = spawnSync(
    "git",
    ["-c", "core.quotePath=false", "diff", "--name-only", "--diff-filter=d", "HEAD"],
    { cwd: baseDir, encoding: "utf8" }
  );
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 変更されたファイルを含むプロジェクトディレクトリのみを絞り込む
 * candidateProjects はネストしない前提（findProjects は最初に見つかった .clasp.json で探索を打ち切るため）
 */
function findChangedProjectDirs(baseDir, candidateProjects) {
  const changedFiles = findChangedFiles(baseDir).map((file) => path.resolve(baseDir, file));
  return candidateProjects.filter((project) =>
    changedFiles.some((file) => {
      const rel = path.relative(project, file);
      return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    })
  );
}

/**
 * open 系サブコマンドを clasp のメジャーバージョンに合わせて解決する
 * 2.x: clasp open / clasp open --webapp
 * 3.x: clasp open-script / clasp open-web-app
 *
 * コンテナ（open-container）は .clasp.json の parentId を要求するが、
 * clasp clone は parentId を書かないため未対応
 */
function resolveOpenArgs(target, claspMajor) {
  if (claspMajor !== null && claspMajor < 3) {
    return target === "webapp" ? ["open", "--webapp"] : ["open"];
  }
  return target === "webapp" ? ["open-web-app"] : ["open-script"];
}

/**
 * .clasp.json から scriptId を読めないディレクトリを列挙する
 *
 * scriptId が無いと clasp は警告を出しつつ exit 0 で終えることがあるため、
 * 実行前にこちらで検証して確実に失敗させる
 */
function findDirsMissingScriptId(dirs) {
  return dirs.filter((dir) => {
    try {
      return !JSON.parse(fs.readFileSync(path.join(dir, ".clasp.json"), "utf8")).scriptId;
    } catch {
      return true;
    }
  });
}

/**
 * 指定パス配下のプロジェクトをブラウザで開く
 */
async function runOpenDir(baseDir, targetPath, target) {
  const projectsDir = path.join(baseDir, "projects");
  const claspDirs = findClaspJsonDirsUnder(path.resolve(projectsDir, targetPath));

  if (claspDirs.length === 0) {
    console.error(`Error: No .clasp.json found in or under: projects/${targetPath}`);
    process.exit(1);
  }

  const missingScriptId = findDirsMissingScriptId(claspDirs);
  if (missingScriptId.length > 0) {
    console.error("Error: scriptId is missing or .clasp.json is unreadable in:");
    missingScriptId.forEach((dir) => console.error(`  - ${path.relative(projectsDir, dir)}`));
    process.exit(1);
  }

  // clasp はブラウザ起動と対話プロンプトの可否を TTY で判断する。
  // webapp はデプロイ選択のプロンプトが必要なため、非TTYでは先に失敗させる
  if (!process.stdout.isTTY) {
    if (target === "webapp") {
      console.error(
        "Error: --webapp needs a TTY to prompt for a deployment. Run this from a terminal."
      );
      process.exit(1);
    }
    console.warn(
      "Warning: stdout is not a TTY. clasp will print URLs instead of opening a browser."
    );
  }

  const openArgs = resolveOpenArgs(target, await getClaspMajorVersion());

  if (claspDirs.length > 1) {
    console.log(`Opening ${claspDirs.length} project(s):`);
    claspDirs.forEach((dir) => console.log(`  - ${path.relative(projectsDir, dir)}`));
  }

  // 並列化しないのは clasp のブラウザ起動・プロンプトが TTY を要求するため。
  // 1件の失敗で残りを止めず、最後にまとめて報告する
  const failures = claspDirs.filter((dir) => runClaspInherit(dir, openArgs) !== 0);

  if (failures.length > 0) {
    console.error(`clasp ${openArgs.join(" ")} failed in ${failures.length} project(s):`);
    failures.forEach((dir) => console.error(`  - ${path.relative(projectsDir, dir)}`));
    process.exit(1);
  }
}

/**
 * 使用方法を表示
 */
function showUsage(availableProjects = []) {
  console.log(`
Usage: node scripts/clasp-runner.js <command> [options] [project...]

Commands:
  push          Push all (or -p filtered) projects to GAS
  push-updated  Push only projects with uncommitted changes (git diff vs HEAD)
  pull          Pull projects from GAS
  push-dir <path>  Push every project under a path (relative to projects/)
  pull-dir <path>  Pull every project under a path (relative to projects/)
  open-dir <path>  Open projects under a path in the browser
  list          List available projects

push / push-updated / push-dir only run against scriptIds the current clasp
account can access; projects without access are skipped (not a failure).

*-dir commands resolve by path, so passing a category directory targets every
project beneath it. Passing a project directory targets just that project.

Options:
  --force, -f       Force overwrite (push only)
  --jobs, -j <n>    Number of parallel jobs (default: 3)
  --project, -p <name>  Specify project(s) to process (can be used multiple times)
  --script          open-dir: open the Apps Script editor (default)
  --webapp          open-dir: open the deployed web app (needs a TTY)
  --help, -h        Show this help

Environment Variables:
  PARALLEL_JOBS     Number of parallel jobs (default: 3)

Examples:
  node scripts/clasp-runner.js push                      # Push all projects
  node scripts/clasp-runner.js push -p project-a         # Push specific project
  node scripts/clasp-runner.js push -p project-a -p project-b  # Push multiple projects
  node scripts/clasp-runner.js push-updated              # Push only changed projects
  node scripts/clasp-runner.js pull project-a project-b  # Push multiple projects (shorthand)
  node scripts/clasp-runner.js push-dir project-a        # Push one project by path
  node scripts/clasp-runner.js push-dir corporate-it     # Push every project in a category
  node scripts/clasp-runner.js open-dir project-a --webapp
  node scripts/clasp-runner.js list                      # List available projects
  PARALLEL_JOBS=4 node scripts/clasp-runner.js push
`);

  if (availableProjects.length > 0) {
    console.log("Available projects:");
    availableProjects.forEach((p) => console.log(`  - ${p}`));
    console.log("");
  }
}

/**
 * 引数をパース
 */
function parseArgs(args) {
  const result = {
    command: null,
    force: false,
    jobs: parseInt(process.env.PARALLEL_JOBS || DEFAULT_CONCURRENCY, 10),
    projects: [],
    openTarget: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--script") {
      result.openTarget = "script";
    } else if (arg === "--webapp") {
      result.openTarget = "webapp";
    } else if (arg === "--force" || arg === "-f") {
      result.force = true;
    } else if (arg === "--jobs" || arg === "-j") {
      result.jobs = parseInt(args[++i], 10) || DEFAULT_CONCURRENCY;
    } else if (arg === "--project" || arg === "-p") {
      const projectName = args[++i];
      if (projectName && !projectName.startsWith("-")) {
        result.projects.push(projectName);
      }
    } else if (!arg.startsWith("-")) {
      if (!result.command) {
        result.command = arg;
      } else {
        // コマンド後の引数はプロジェクト名として扱う
        result.projects.push(arg);
      }
    }
  }

  return result;
}

/**
 * メイン
 */
async function main() {
  const baseDir = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const availableProjects = listProjects(baseDir);

  if (args.help || !args.command) {
    showUsage(availableProjects);
    process.exit(args.help ? 0 : 1);
  }

  const command = args.command.toLowerCase();

  // list コマンド
  if (command === "list") {
    console.log("Available projects:");
    if (availableProjects.length === 0) {
      console.log("  No projects found.");
    } else {
      availableProjects.forEach((p) => console.log(`  - ${p}`));
    }
    process.exit(0);
  }

  // open-dir はブラウザを開くだけなので、以降の push/pull 用の処理には乗せない
  if (command === "open-dir") {
    const targetPath = args.projects[0];
    if (!targetPath || args.projects.length > 1) {
      console.error("Usage: npm run open-dir -- <path-under-projects> [--script|--webapp]");
      process.exit(1);
    }
    await runOpenDir(baseDir, targetPath, args.openTarget ?? "script");
    return;
  }

  const isDirCommand = command === "push-dir" || command === "pull-dir";
  const isPush = command === "push" || command === "push-updated" || command === "push-dir";

  if (!isPush && command !== "pull" && command !== "pull-dir") {
    console.error(`Error: Unknown command '${command}'`);
    showUsage(availableProjects);
    process.exit(1);
  }

  // *-dir はパス1つを必須引数として取る
  let dirTargets = [];
  if (isDirCommand) {
    const targetPath = args.projects[0];
    if (!targetPath || args.projects.length > 1) {
      console.error(`Usage: npm run ${command} -- <path-under-projects>`);
      process.exit(1);
    }
    dirTargets = findClaspJsonDirsUnder(path.resolve(baseDir, "projects", targetPath));
    if (dirTargets.length === 0) {
      console.error(`Error: No .clasp.json found in or under: projects/${targetPath}`);
      process.exit(1);
    }
  }

  // ブランチチェック（pushの場合のみ）
  if (isPush) {
    const branch = await getCurrentBranch();
    if (branch !== "master" && branch !== "main") {
      console.error(`Error: Can't push from branch '${branch}'`);
      console.error("Push is only allowed from master or main branch.");
      process.exit(1);
    }
  }

  // 指定されたプロジェクトの検証（*-dir はパス指定なのでこの検証は行わない）
  if (!isDirCommand && args.projects.length > 0) {
    const invalidProjects = args.projects.filter((p) => !availableProjects.includes(p));
    if (invalidProjects.length > 0) {
      console.error(`Error: Unknown project(s): ${invalidProjects.join(", ")}`);
      console.error("");
      console.error("Available projects:");
      availableProjects.forEach((p) => console.error(`  - ${p}`));
      process.exit(1);
    }
  }

  // アカウント確認（pushの場合のみ。取り違え防止のため事前にログイン中のアカウントを表示する）
  // アカウントを特定できない場合でも push 自体は止めない（認証の失敗は clasp 側が報告する）
  if (isPush) {
    const account = await getAuthorizedUser();
    if (!account) {
      console.error(
        "Error: clasp is not authorized (or not installed / not on PATH). Run `clasp login`."
      );
      process.exit(1);
    }
    if (account === UNKNOWN_ACCOUNT) {
      console.warn("Warning: clasp credentials found, but the account could not be determined.");
    } else {
      console.log(`clasp account: ${account}`);
    }
    console.log("");
  }

  // プロジェクト検索（*-dir はパス解決済みの結果を使う）
  let projects = isDirCommand ? dirTargets : findProjects(baseDir, args.projects);

  // push-updated は、フィルタ後の候補のうち git 上で変更があるものだけに絞り込む
  if (command === "push-updated") {
    projects = findChangedProjectDirs(baseDir, projects);
  }

  if (projects.length === 0) {
    console.log(command === "push-updated" ? "No changed projects to push." : "No projects found.");
    process.exit(0);
  }

  // push は、現在ログイン中のアカウントがアクセスできる scriptId のみを対象にする
  // （1プロジェクトの権限が無くても他は push されるよう、失敗ではなくスキップとして扱う）
  if (isPush) {
    const accessChecks = await Promise.all(
      projects.map(async (project) => ({ project, ok: await hasClaspAccess(project) }))
    );
    const inaccessible = accessChecks.filter((r) => !r.ok);
    inaccessible.forEach((r) => {
      console.log(
        `Skipping (current clasp account has no access to this scriptId): ${path.basename(r.project)}`
      );
    });
    projects = accessChecks.filter((r) => r.ok).map((r) => r.project);

    if (projects.length === 0) {
      console.log("");
      console.log("No accessible projects to push.");
      process.exit(0);
    }
    console.log("");
  }

  // clasp コマンド引数を構築（push-updated / *-dir は clasp 的には push / pull と同じ）
  const claspSubcommand = isPush ? "push" : "pull";
  const claspArgs = [claspSubcommand];
  if (claspSubcommand === "push" && args.force) {
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
