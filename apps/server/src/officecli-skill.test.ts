import { describe, expect, test } from "bun:test";

import { CORE_OPENCODE_FILES } from "./core-skills.js";

describe("OfficeCLI bundled skill", () => {
  test("is seeded with the safe document workflow", () => {
    const skill = CORE_OPENCODE_FILES.find((file) => file.path === ".opencode/skills/officecli/SKILL.md");
    expect(skill).toBeDefined();
    expect(skill?.content).toContain("use the bundled `docx-edit` skill instead");
    expect(skill?.content).toContain("Preserve the source by default");
    expect(skill?.content).toContain("Run OfficeCLI validation");
  });
});
