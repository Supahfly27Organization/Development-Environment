import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ensureToolsComposeFile,
  waitForSonarQubeReady,
  generateSonarToken,
} from "../src/lib/docker-stack.js";

// Note: dockerAvailable/toolsStackFullyRunning/startToolsStack shell out to the
// real `docker` CLI and aren't covered here - same convention as claude-plugins.js.

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

function withMockedFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("ensureToolsComposeFile writes tools-docker-compose.yml bind-mounting the compose file's own directory", async () => {
  const dir = makeScratchDir();
  const result = await ensureToolsComposeFile(dir);

  assert.equal(result.status, "created");
  assert.equal(result.path, path.join(dir, "tools-docker-compose.yml"));

  const content = fs.readFileSync(result.path, "utf8");
  assert.ok(content.includes(".:/workspace"), "should bind-mount the compose file's directory via a relative path");
  assert.ok(content.includes("container_name: sonarqube"));
});

test("ensureToolsComposeFile is a no-op when the file already matches", async () => {
  const dir = makeScratchDir();
  await ensureToolsComposeFile(dir);
  const result = await ensureToolsComposeFile(dir);
  assert.equal(result.status, "unchanged");
});

test("waitForSonarQubeReady returns true as soon as status is UP", async () => {
  await withMockedFetch(
    async (url) => {
      assert.match(String(url), /\/api\/system\/status$/);
      return { ok: true, json: async () => ({ status: "UP" }) };
    },
    async () => {
      const ready = await waitForSonarQubeReady("http://localhost:9000", { timeoutMs: 5000 });
      assert.equal(ready, true);
    }
  );
});

test("waitForSonarQubeReady gives up after timeoutMs when never UP", async () => {
  await withMockedFetch(
    async () => ({ ok: true, json: async () => ({ status: "STARTING" }) }),
    async () => {
      const ready = await waitForSonarQubeReady("http://localhost:9000", {
        timeoutMs: 50,
        intervalMs: 20,
      });
      assert.equal(ready, false);
    }
  );
});

test("generateSonarToken revokes any existing token then returns the generated token", async () => {
  const calls = [];
  await withMockedFetch(
    async (url, opts) => {
      calls.push(String(url));
      if (String(url).includes("/api/user_tokens/revoke")) {
        return { ok: true, json: async () => ({}) };
      }
      assert.match(opts.headers.Authorization, /^Basic /);
      return { ok: true, json: async () => ({ token: "squ_abc123" }) };
    },
    async () => {
      const token = await generateSonarToken("aeco-my-project", "http://localhost:9000");
      assert.equal(token, "squ_abc123");
    }
  );
  assert.ok(calls.some((u) => u.includes("/api/user_tokens/revoke")));
  assert.ok(calls.some((u) => u.includes("/api/user_tokens/generate")));
});

test("generateSonarToken returns null when the generate call fails", async () => {
  await withMockedFetch(
    async (url) => {
      if (String(url).includes("/api/user_tokens/revoke")) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, json: async () => ({}) };
    },
    async () => {
      const token = await generateSonarToken("aeco-my-project", "http://localhost:9000");
      assert.equal(token, null);
    }
  );
});
