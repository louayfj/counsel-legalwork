"use client"

import { Search, TriangleAlert } from "lucide-react"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/ui/chain-of-thought"
import { Source, SourceContent, SourceTrigger } from "@/components/ui/source"
import { Tool } from "@/components/ui/tool"
import type { DynamicToolUIPart, ToolUIPart } from "ai"

interface PerplexityToolProps {
  part: ToolUIPart | DynamicToolUIPart
}

function parsePerplexityOutput(output: unknown): { citations: string[] } {
  if (typeof output !== "string") return { citations: [] }
  try {
    const parsed = JSON.parse(output)
    const citations: string[] = Array.isArray(parsed?.citations) ? parsed.citations : []
    return { citations }
  } catch {
    // Extract bare URLs from plain-text output
    const urls = Array.from(output.matchAll(/https?:\/\/[^\s\]\)>"]+/g)).map(m => m[0])
    return { citations: [...new Set(urls)] }
  }
}

function getQuery(input: unknown): string {
  if (input && typeof input === "object") {
    const q = (input as Record<string, unknown>).query
    if (typeof q === "string" && q.trim()) return q.trim()
  }
  return "Perplexity search"
}

export function PerplexityTool({ part }: PerplexityToolProps) {
  if (part.state !== "output-available") {
    return <Tool toolPart={part} />
  }

  const query = getQuery(part.input)
  const { citations } = parsePerplexityOutput(part.output)

  return (
    <ChainOfThought>
      <ChainOfThoughtStep>
        <ChainOfThoughtTrigger leftIcon={<Search className="size-4" />}>
          Searched Perplexity for &ldquo;{query}&rdquo;
        </ChainOfThoughtTrigger>
        <ChainOfThoughtContent>
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <TriangleAlert className="size-3 shrink-0" />
            Web source — verify before citing
          </div>
          {citations.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {citations.map((url) => (
                <Source href={url} key={url}>
                  <SourceTrigger showFavicon />
                  <SourceContent title={url} />
                </Source>
              ))}
            </div>
          )}
        </ChainOfThoughtContent>
      </ChainOfThoughtStep>
    </ChainOfThought>
  )
}
