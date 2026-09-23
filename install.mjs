#!/usr/bin/env node
/**
 * pi-config installer — cài tự động, cross-platform (Win/macOS/Linux), không dependency ngoài.
 *
 * Usage (clone repo về rồi chạy):
 *   node pi-config/install.mjs
 *
 * Tùy chọn:
 *   --src <repoDir>        chạy từ nơi khác, chỉ định repo (mặc định: nơi script đặt)
 *   --agentDir <dir>       đích (mặc định: ~/.pi/agent)
 *   --skip-npm             không chạy `npm install`
 *   --dry-run              chỉ in sẽ làm gì, không ghi gì
 *
 * Script làm gì:
 *   1. extensions/* → <agentDir>/extensions/   (bỏ qua node_modules, .profile, auth.json)
 *      File đích đã có nội dung khác sẽ được backup thành *.bak-<timestamp> trước khi ghi.
 *   2. skills/*     → <agentDir>/skills/        (cùng luật)
 *   3. npm/package.json → <agentDir>/npm/       (MERGE dependencies: giữ package user có,
 *      thêm cái thiếu theo version trong repo — không ghi đè version user đang dùng)
 *   4. `npm install` cho từng extension có package.json + thư mục npm/
 *
 * Việc còn lại (in ra cuối script):
 *   - (tuỳ chọn) cd extensions/browser && npx playwright install chromium  (~150MB, 1 lần)
 *   - tạo extensions/web-search/auth.json nếu dùng Exa (secret, không nằm trong repo)
 *   - tạo <agentDir>/mcp.json nếu dùng MCP servers (secret, không nằm trong repo)
 *   - restart pi hoặc /reload
 *
 * Cách dùng cho "pi tự cài": trong pi, chạy:
 *   git clone https://github.com/KaiyoDev/pi-config /tmp/pi-config && node /tmp/pi-config/install.mjs
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path, { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const DRY = args.includes("--dry-run");
const SKIP_NPM = args.includes("--skip-npm");
const srcDir = (argVal("--src") ?? dirname(fileURLToPath(import.meta.url))).replace(/[\\/]+$/, "");
const agentDir = (argVal("--agentDir") ?? join(homedir(), ".pi", "agent")).replace(/[\\/]+$/, "");

// Thư mục/file runtime & secret — không bao giờ copy
const SKIP = new Set(["node_modules", ".profile", "auth.json"]);

let nCopied = 0;
let nBackups = 0;

function log(msg) {
  console.log(`  ${msg}`);
}

function backupIfDiffers(dst, srcFile) {
  if (!existsSync(dst)) return;
  const a = readFileSync(srcFile);
  const b = readFileSync(dst);
  if (Buffer.compare(a, b) === 0) return;
  const bak = dst + ".bak-" + new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  if (DRY) log(`dry: backup ${basename(dst)} → ${basename(bak)}`);
  else {
    renameSync(dst, bak);
    nBackups++;
    log(`backup ${basename(dst)} → ${basename(bak)}`);
  }
}

function walkAndCopy(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP.has(name)) {
      log(`skip  ${join(basename(src), name)}`);
      continue;
    }
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) {
      walkAndCopy(s, d);
    } else {
      backupIfDiffers(d, s);
      if (DRY) log(`dry: copy ${s.replace(srcDir + path.sep, "")}`);
      else {
        writeFileSync(d, readFileSync(s));
        nCopied++;
        log(`copy  ${s.replace(srcDir + path.sep, "")}`);
      }
    }
  }
}

function npmInstall(cwd, label) {
  const p = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (p.status !== 0) console.warn(`  WARN: npm install ${label} thất bại (code ${p.status})`);
}

// ── 1. Extensions ────────────────────────────────────────────────
console.log(`\n[1/4] extensions/ → ${join(agentDir, "extensions")}`);
walkAndCopy(join(srcDir, "extensions"), join(agentDir, "extensions"));

// ── 2. Skills ────────────────────────────────────────────────────
console.log(`\n[2/4] skills/ → ${join(agentDir, "skills")}`);
walkAndCopy(join(srcDir, "skills"), join(agentDir, "skills"));

// ── 3. Npm packages (merge deps) ─────────────────────────────────
console.log(`\n[3/4] npm/package.json → ${join(agentDir, "npm")}`);
const srcPkgPath = join(srcDir, "npm", "package.json");
if (existsSync(srcPkgPath)) {
  const srcPkg = JSON.parse(readFileSync(srcPkgPath, "utf8"));
  const dstPkgPath = join(agentDir, "npm", "package.json");
  const dstPkg = existsSync(dstPkgPath)
    ? JSON.parse(readFileSync(dstPkgPath, "utf8"))
    : { name: "pi-extensions", private: true, dependencies: {} };
  dstPkg.dependencies = dstPkg.dependencies ?? {};
  const merged = { ...srcPkg.dependencies, ...dstPkg.dependencies }; // user version win
  const added = Object.keys(merged).filter((k) => k in srcPkg.dependencies && !(k in dstPkg.dependencies));
  if (added.length > 0) {
    dstPkg.dependencies = merged;
    if (DRY) log(`dry: merge +${added.length} dep (thêm ${added.join(", ")}, giữ version user)`);
    else {
      mkdirSync(dirname(dstPkgPath), { recursive: true });
      writeFileSync(dstPkgPath, JSON.stringify(dstPkg, null, 2) + "\n");
      log(`merged: +${added.length} dep (${added.join(", ")}); giữ nguyên ${Object.keys(dstPkg.dependencies).length - added.length} dep hiện có`);
    }
  } else {
    log(dstPkg.dependencies && Object.keys(dstPkg.dependencies).length ? "deps đã đủ, không merge" : "không có src deps");
  }
  if (!SKIP_NPM) {
    if (DRY) log("dry: npm install ~/.pi/agent/npm");
    else npmInstall(join(agentDir, "npm"), "(npm/)");
  }
} else {
  log("không có npm/package.json trong repo — bỏ qua");
}

// ── 4. npm install per-extension ─────────────────────────────────
console.log(`\n[4/4] npm install từng extension`);
if (SKIP_NPM) {
  log("--skip-npm: bỏ qua");
} else if (DRY) {
  const dirs = readdirSync(join(agentDir, "extensions"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(agentDir, "extensions", e.name, "package.json")))
    .map((e) => e.name);
  for (const d of dirs) log(`dry: npm install extensions/${d}`);
} else {
  const extRoot = join(agentDir, "extensions");
  if (existsSync(extRoot)) {
    for (const e of readdirSync(extRoot, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const pkg = join(extRoot, e.name, "package.json");
      if (existsSync(pkg)) npmInstall(join(extRoot, e.name), `extensions/${e.name}`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────
console.log(`\nXong${DRY ? " (dry-run, chưa ghi gì)" : ""}: ${nCopied} file copy, ${nBackups} backup.`);
if (!DRY) {
  console.log("\nTiếp theo (tuỳ chọn):");
  console.log("  1) cd ~/.pi/agent/extensions/browser && npx playwright install chromium");
  console.log("  2) Exa search: tạo ~/.pi/agent/extensions/web-search/auth.json (xem auth.json.example)");
  console.log("  3) MCP servers: tạo ~/.pi/agent/mcp.json (không có trong repo — secret)");
  console.log("  4) Restart pi hoặc chạy /reload");
}
