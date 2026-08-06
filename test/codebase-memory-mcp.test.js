import { test } from "node:test";
import assert from "node:assert/strict";
import {
  archiveNameForVariant,
  installCodebaseMemoryMcp,
  isWindows,
} from "../src/lib/codebase-memory-mcp.js";

// ── archive name selection (pure logic, no I/O) ───────────────────────────────

test("archiveNameForVariant returns standard archive by default", () => {
  assert.equal(archiveNameForVariant(), "codebase-memory-mcp-windows-amd64.zip");
  assert.equal(archiveNameForVariant(false), "codebase-memory-mcp-windows-amd64.zip");
});

test("archiveNameForVariant returns ui archive when ui=true", () => {
  assert.equal(archiveNameForVariant(true), "codebase-memory-mcp-ui-windows-amd64.zip");
});

test("ui archive name differs from standard archive name", () => {
  assert.notEqual(archiveNameForVariant(false), archiveNameForVariant(true));
  assert.ok(archiveNameForVariant(true).includes("-ui-"));
  assert.ok(!archiveNameForVariant(false).includes("-ui-"));
});

// ── non-Windows guard ─────────────────────────────────────────────────────────

test("installCodebaseMemoryMcp throws on non-Windows", async () => {
  if (isWindows()) return; // skip on actual Windows runners
  await assert.rejects(
    () => installCodebaseMemoryMcp(),
    /Automatic install is only implemented for Windows/
  );
});

test("installCodebaseMemoryMcp({ ui: true }) also throws on non-Windows", async () => {
  if (isWindows()) return;
  await assert.rejects(
    () => installCodebaseMemoryMcp({ ui: true }),
    /Automatic install is only implemented for Windows/
  );
});
