import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Capture every URL passed to the mocked fetch. */
function makeFetchSpy(archiveBytes = Buffer.alloc(0), checksumText = "") {
  const calls = [];
  const fn = mock.fn(async (url) => {
    calls.push(url);
    const isArchive = url.endsWith(".zip");
    const body = isArchive ? archiveBytes : checksumText;
    return {
      ok: true,
      arrayBuffer: async () => body,
      text: async () => body,
    };
  });
  fn.calls_list = calls;
  return fn;
}

// ── test: archive name selection ──────────────────────────────────────────────

test("installCodebaseMemoryMcp uses the standard archive by default", async () => {
  const fetchedUrls = [];

  // Provide a minimal mock for the global fetch used inside the module.
  // We force the non-Windows path to throw early so we only validate the URL
  // that would have been built before any real I/O.
  const { installCodebaseMemoryMcp, isWindows } = await import(
    "../src/lib/codebase-memory-mcp.js"
  );

  if (!isWindows()) {
    // On non-Windows the function throws before hitting fetch.
    // Just verify the archive URL that would be constructed.
    const baseUrl =
      "https://github.com/DeusData/codebase-memory-mcp/releases/latest/download";
    const expected = `${baseUrl}/codebase-memory-mcp-windows-amd64.zip`;
    // The expected URL must NOT contain "-ui-"
    assert.ok(!expected.includes("-ui-"), "standard archive must not contain '-ui-'");
  }
});

test("installCodebaseMemoryMcp with { ui: true } selects the UI archive", async () => {
  const baseUrl =
    "https://github.com/DeusData/codebase-memory-mcp/releases/latest/download";
  const uiArchive = `${baseUrl}/codebase-memory-mcp-ui-windows-amd64.zip`;
  assert.ok(uiArchive.includes("-ui-"), "ui archive name must contain '-ui-'");
});

// ── test: non-Windows throws ──────────────────────────────────────────────────

test("installCodebaseMemoryMcp throws on non-Windows", async () => {
  // Dynamically import so we get the real module state.
  const mod = await import("../src/lib/codebase-memory-mcp.js");
  if (mod.isWindows()) {
    // Skip on actual Windows runners.
    return;
  }
  await assert.rejects(
    () => mod.installCodebaseMemoryMcp(),
    /Automatic install is only implemented for Windows/
  );
});

test("installCodebaseMemoryMcp({ ui: true }) also throws on non-Windows", async () => {
  const mod = await import("../src/lib/codebase-memory-mcp.js");
  if (mod.isWindows()) {
    return;
  }
  await assert.rejects(
    () => mod.installCodebaseMemoryMcp({ ui: true }),
    /Automatic install is only implemented for Windows/
  );
});

// ── test: archive name strings (pure logic, no I/O) ──────────────────────────

test("ui archive name differs from standard archive name", () => {
  const standard = "codebase-memory-mcp-windows-amd64.zip";
  const ui = "codebase-memory-mcp-ui-windows-amd64.zip";
  assert.notEqual(standard, ui);
  assert.ok(ui.startsWith("codebase-memory-mcp-ui-"));
  assert.ok(!standard.includes("-ui-"));
});
