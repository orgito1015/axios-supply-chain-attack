"use strict";

/**
 * tests/cleanup.test.js
 *
 * Tests for the forensic self-cleanup logic documented in cleanup/cleanup.js.
 *
 * Because cleanup.js is a runnable script (not a module exporting functions),
 * the tests exercise the same three-step cleanup steps directly:
 *
 *   Step 1 - Remove the postinstall hook from package.json
 *   Step 2 - Replace package.json with the clean manifest from package.md
 *   Step 3 - Delete setup.js from disk
 *
 * All tests operate on a temporary copy of the plain-crypto-js directory so
 * the real source files are never modified.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

// ── Helpers ───────────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── Shared fixture ────────────────────────────────────────────────────────────

const SOURCE_DIR = path.join(__dirname, "..", "plain-crypto-js");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("cleanup steps (unit)", () => {
  // ── Step 1: Remove postinstall hook from package.json ─────────────────────

  describe("step 1 - remove postinstall hook from package.json", () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-step1-"));
      copyDir(SOURCE_DIR, tmpDir);
    });

    after(() => rmDir(tmpDir));

    it("package.json in the fixture contains a postinstall hook", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, "package.json"), "utf8"));
      assert.ok(pkg.scripts?.postinstall, "Expected a postinstall hook to be present before cleanup");
    });

    it("deleting scripts from parsed package.json removes the postinstall hook", () => {
      const pkgPath = path.join(tmpDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      delete pkg.scripts;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

      const updated = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      assert.equal(updated.scripts, undefined);
    });
  });

  // ── Step 2: Replace package.json with clean manifest (package.md) ─────────

  describe("step 2 - replace package.json with clean manifest", () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-step2-"));
      copyDir(SOURCE_DIR, tmpDir);
    });

    after(() => rmDir(tmpDir));

    it("package.md exists in the fixture", () => {
      assert.ok(fs.existsSync(path.join(tmpDir, "package.md")));
    });

    it("overwriting package.json with package.md content removes the scripts block", () => {
      const pkgPath = path.join(tmpDir, "package.json");
      const mdPath = path.join(tmpDir, "package.md");

      const cleanManifest = fs.readFileSync(mdPath, "utf8");
      fs.writeFileSync(pkgPath, cleanManifest);

      const updated = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      assert.equal(updated.scripts, undefined, "Clean manifest must not contain a scripts block");
    });

    it("the replaced package.json preserves the package name and version", () => {
      const pkgPath = path.join(tmpDir, "package.json");
      const mdPath = path.join(tmpDir, "package.md");

      fs.writeFileSync(pkgPath, fs.readFileSync(mdPath, "utf8"));

      const original = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, "package.json"), "utf8"));
      const clean = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

      assert.equal(clean.name, original.name);
      assert.equal(clean.version, original.version);
    });
  });

  // ── Step 3: Delete setup.js ────────────────────────────────────────────────

  describe("step 3 - delete setup.js from disk", () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-step3-"));
      copyDir(SOURCE_DIR, tmpDir);
    });

    after(() => rmDir(tmpDir));

    it("setup.js exists in the fixture before cleanup", () => {
      assert.ok(fs.existsSync(path.join(tmpDir, "setup.js")));
    });

    it("renaming and then unlinking setup.js removes it from disk", () => {
      const setupPath = path.join(tmpDir, "setup.js");
      const deadPath = setupPath + ".dead";

      fs.renameSync(setupPath, deadPath);
      fs.unlinkSync(deadPath);

      assert.equal(fs.existsSync(setupPath), false);
      assert.equal(fs.existsSync(deadPath), false);
    });
  });
});

// ── Dry-run mode (full script) ────────────────────────────────────────────────

describe("cleanup.js dry-run mode", () => {
  it("executes without error and does not modify any source files", () => {
    const cleanupScript = path.join(__dirname, "..", "cleanup", "cleanup.js");

    // Capture stdout; must not throw
    let output;
    assert.doesNotThrow(() => {
      output = execFileSync(process.execPath, [cleanupScript], {
        encoding: "utf8",
        timeout: 10_000,
      });
    });

    assert.ok(output.includes("[DRY RUN]"), "Expected dry-run output from cleanup.js");

    // Source files must remain unmodified
    assert.ok(
      fs.existsSync(path.join(SOURCE_DIR, "setup.js")),
      "setup.js must not have been deleted in dry-run mode"
    );

    const pkg = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, "package.json"), "utf8"));
    assert.ok(
      pkg.scripts?.postinstall,
      "postinstall hook must remain in package.json after a dry run"
    );
  });

  it("reports the correct file paths that would be modified", () => {
    const cleanupScript = path.join(__dirname, "..", "cleanup", "cleanup.js");

    const output = execFileSync(process.execPath, [cleanupScript], {
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.ok(output.includes("package.json"), "Output must mention package.json");
    assert.ok(output.includes("setup.js"), "Output must mention setup.js");
    assert.ok(output.includes("package.md"), "Output must mention package.md");
  });
});
