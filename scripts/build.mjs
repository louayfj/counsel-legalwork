import { execSync } from "node:child_process";

execSync("pnpm --filter @counsel/desktop build", { stdio: "inherit" });
