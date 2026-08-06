import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { resolveTargetFolder } from "../src/lib/target-path.js";

test("resolveTargetFolder preserves absolute Windows drive paths", () => {
  assert.equal(resolveTargetFolder("C:\\projects\\Jack", "/tmp/workspace"), "C:\\projects\\Jack");
  assert.equal(resolveTargetFolder("C:/projects/Jack", "/tmp/workspace"), "C:\\projects\\Jack");
});

test("resolveTargetFolder preserves Windows UNC paths", () => {
  assert.equal(resolveTargetFolder("\\\\server\\share\\Jack", "/tmp/workspace"), "\\\\server\\share\\Jack");
});

test("resolveTargetFolder resolves non-Windows paths from cwd", () => {
  assert.equal(resolveTargetFolder("project", "/tmp/workspace"), path.resolve("/tmp/workspace", "project"));
});
