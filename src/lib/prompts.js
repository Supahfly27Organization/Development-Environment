import * as p from "@clack/prompts";
import path from "node:path";

function bail(value) {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }
  return value;
}

export async function collectInitAnswers(defaultTarget) {
  const targetFolder = bail(
    await p.text({ message: "Target project folder", initialValue: defaultTarget })
  );

  const projectName = bail(
    await p.text({
      message: "Project name",
      initialValue: path.basename(String(targetFolder)),
    })
  );

  const description = bail(
    await p.text({
      message: "One-line project description",
      placeholder: "e.g. Internal tool for X",
      defaultValue: "",
    })
  );

  const techStack = bail(
    await p.text({
      message: "Primary tech stack (comma-separated)",
      placeholder: "e.g. Node.js, React, PostgreSQL",
      defaultValue: "",
    })
  );

  const tools = bail(
    await p.multiselect({
      message: "Which tools should this project be wired up for?",
      options: [
        { value: "claude", label: "Claude Code" },
        { value: "codex", label: "Codex" },
        { value: "copilot", label: "GitHub Copilot" },
      ],
      initialValues: ["claude", "codex", "copilot"],
    })
  );

  const wantsSecrets = bail(
    await p.confirm({
      message: "Set up a .env with secrets now (GitHub PAT, SonarQube token)?",
      initialValue: true,
    })
  );

  return {
    targetFolder: String(targetFolder),
    projectName: String(projectName),
    description: String(description ?? ""),
    techStack: String(techStack ?? ""),
    tools,
    wantsSecrets,
  };
}
