# Counsel

A local AI agent for document work. Point it at a folder and ask in plain English — it reads, drafts, and redlines documents on your own machine, using the model you connect. Everything stays on your device.
## What it does

- **Review & redline** documents as tracked changes, right in Word.
- **Tabular review** — extract terms across many documents into a sourced grid.
- **Draft** memos, contracts, and engagement letters.
- **Bring your own model** — AWS Bedrock, Azure OpenAI, or any provider. Your data is only ever shared with the model you choose.
- **Runs on this machine** by default; connect a remote worker only when you want to.
- **Extend it** with skills, plugins, and MCP connectors, managed in **Settings → Extensions** and shared across every workspace.

## Develop

Requirements: Node.js + `pnpm@10.27.0`, **Bun 1.3.9+**, the Rust toolchain (Tauri), and the `opencode` CLI on PATH. macOS needs Xcode Command Line Tools; Linux needs the WebKitGTK 4.1 dev packages.

```bash
pnpm install
pnpm dev        # desktop app (isolated dev engine state)
pnpm dev:ui     # web UI only
```

Checks: `pnpm typecheck` · `pnpm build` · `pnpm test:e2e`.

## Contributing

Read `AGENTS.md` first. Run `pnpm install`, then verify with `pnpm typecheck` and `pnpm test:e2e` before opening a PR.

## License

MIT — see `LICENSE`.
