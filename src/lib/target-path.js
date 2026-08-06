import path from "node:path";

function isWindowsAbsolutePath(targetFolder) {
  return /^[a-zA-Z]:[\\/]/.test(targetFolder) || /^\\\\[^\\]+\\[^\\]+/.test(targetFolder);
}

export function resolveTargetFolder(targetFolder, cwd = process.cwd()) {
  const value = String(targetFolder);
  if (isWindowsAbsolutePath(value)) {
    return path.win32.normalize(value);
  }

  return path.resolve(cwd, value);
}
