---
description: Agentic Word editing — tracked changes and comments on a .docx
---

Edit a **Word document** with AI — write back **comments and tracked changes**
the user reviews and accepts in the in-app viewer.

Load and follow the **`docx-edit`** skill, then carry out this request:

`$ARGUMENTS`

Reminders from the skill:

- `inspect` the `.docx` first to get the stable paragraph map; anchor every edit to a
  0-based `paragraphIndex`.
- For a full review pass, fan out the **`docx-redliner`** subagent (Task tool); for a
  small targeted change, build the plan yourself.
- `comments` are margin notes (the *why*); `proposals` are tracked-change edits. Every
  `search` string must be **verbatim** from the paragraph.
- `apply` writes a non-destructive `<base>.redlined.docx` by default — open it in the
  viewer to see the tracked changes inline. Use `--in-place` only if asked.
- Report any ops that didn't match verbatim instead of dropping them; never fabricate
  parties, numbers, or terms.

If no document is named in the arguments, ask which `.docx` to edit first.
