import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// Real, publicly-released tool (has GitHub releases) - not a fully manual
// prerequisite. Mirrors DeusData/codebase-memory-mcp's own install.ps1.
const REPO = "DeusData/codebase-memory-mcp";
const INSTALL_DIR = path.join(
  process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
  "Programs",
  "codebase-memory-mcp"
);
const BIN_NAME = "codebase-memory-mcp.exe";
export const BIN_PATH = path.join(INSTALL_DIR, BIN_NAME);

export function isWindows() {
  return process.platform === "win32";
}

/** Returns the absolute binary path if found, else null. */
export function detectCodebaseMemoryMcp() {
  if (fs.existsSync(BIN_PATH)) return BIN_PATH;
  try {
    const cmd = isWindows() ? "where" : "which";
    const out = execFileSync(cmd, ["codebase-memory-mcp"], { encoding: "utf8", shell: true }).trim();
    return out.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

/** Name of the release archive for the standard (ui=false) or UI-enabled (ui=true) Windows build. */
export function archiveNameForVariant(ui = false) {
  return ui ? "codebase-memory-mcp-ui-windows-amd64.zip" : "codebase-memory-mcp-windows-amd64.zip";
}

/**
 * Downloads + installs the latest Windows release. Throws on non-Windows platforms.
 * @param {object} [opts]
 * @param {boolean} [opts.ui] - install the UI-enabled build instead of the standard one.
 */
export async function installCodebaseMemoryMcp({ ui = false } = {}) {
  if (!isWindows()) {
    throw new Error(
      `Automatic install is only implemented for Windows. Install manually from https://github.com/${REPO}/releases`
    );
  }

  const baseUrl = `https://github.com/${REPO}/releases/latest/download`;
  const archiveName = archiveNameForVariant(ui);
  const archiveUrl = `${baseUrl}/${archiveName}`;
  const checksumUrl = `${baseUrl}/checksums.txt`;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbm-install-"));
  const archivePath = path.join(tmpDir, archiveName);

  await downloadFile(archiveUrl, archivePath);

  try {
    const checksums = await downloadText(checksumUrl);
    const line = checksums.split("\n").find((l) => l.includes(archiveName));
    if (line) {
      const expected = line.trim().split(/\s+/)[0];
      const actual = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
      if (expected !== actual) {
        throw new Error(`checksum mismatch: expected ${expected}, got ${actual}`);
      }
      console.log("Checksum verified.");
    }
  } catch (err) {
    console.warn(`warning: could not verify checksum (${err.message})`);
  }

  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path "${archivePath}" -DestinationPath "${tmpDir}" -Force`],
    { stdio: "inherit" }
  );

  const extractedBin = path.join(tmpDir, BIN_NAME);
  if (!fs.existsSync(extractedBin)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error("binary not found in extracted archive");
  }

  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  fs.copyFileSync(extractedBin, BIN_PATH);

  try {
    execFileSync(BIN_PATH, ["install", "-y"], { stdio: "inherit" });
  } catch {
    console.warn("Agent configuration failed (non-fatal). Run manually: codebase-memory-mcp install");
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return BIN_PATH;
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

async function downloadText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  return res.text();
}
