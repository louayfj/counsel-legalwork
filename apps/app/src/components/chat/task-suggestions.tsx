"use client"

import {
  DescriptiveButton,
  DescriptiveButtonContent,
  DescriptiveButtonDescription,
  DescriptiveButtonIcon,
  DescriptiveButtonTitle,
} from "@/components/descriptive-button"
import { useMessageList } from "@/components/chat/message-list-provider"
import { cn } from "@/lib/utils"
import { BoltIcon, DocumentTextIcon, ExclamationTriangleIcon, LockClosedIcon, ShieldCheckIcon, TableCellsIcon } from "@heroicons/react/24/solid"

const CONTRACT_REVIEW_PROMPT =
  "Review this Axleo contract or client terms document. Summarize the commercial/legal risk, flag clauses to accept/negotiate/reject, suggest fallback wording where appropriate, cite sources or internal reference files, and say what needs Axleo approval or solicitor review."

const DPA_REVIEW_PROMPT =
  "Review this DPA, privacy, or data-processing issue for Axleo. Identify controller/processor roles, data categories, GDPR/PECR risks, missing terms, suggested wording, citations, and any DPO/solicitor escalation needed."

const COMMERCIAL_DRAFT_PROMPT =
  "Draft client-facing legal/commercial wording for Axleo. Ask for any missing facts first if needed, then produce final-ready wording plus internal risk notes, citations, and an approval checklist."

const DISCLOSURE_PROMPT =
  "Check this motor finance agreement and disclosure pack against FCA CONC pre-contract disclosure expectations. Cite each rule or source you rely on, flag gaps, and log the citations."

const AD_REVIEW_PROMPT =
  "Review this vehicle advert or marketing copy against the ASA CAP Code and FCA finance-promotion expectations. Give claim-by-claim findings with citations and safer wording."

const COMPLAINT_PROMPT =
  "Draft a complaint response for this customer issue. Separate facts, missing evidence, regulatory duties, proposed outcome, and escalation risks, with citations."

interface TaskSuggestionsProps {
  className?: string
}

export function TaskSuggestions({ className }: TaskSuggestionsProps) {
  const { displaySuggestions, providerConnectedCount, dispatchAction, setPrompt } = useMessageList()

  if (!displaySuggestions) {
    return null
  }

  const noProviders = providerConnectedCount === 0

  return (
    <div className={cn("@container flex flex-col gap-4 pt-1", className)}>
      <p className="text-muted-foreground font-medium select-none">
        {noProviders ? "Connect a model provider to get started:" : "What do you need Leo to help with?"}
      </p>
      <div className="grid min-w-0 gap-2 @lg:grid-cols-2 @2xl:grid-cols-3">
        {noProviders ? (
          <DescriptiveButton
            orientation="vertical"
            className="border-blue-7/50 bg-blue-2/30 hover:bg-blue-3/40 @lg:col-span-2 @2xl:col-span-3"
            onClick={() =>
              dispatchAction({
                target: "settings",
                action: "open",
                section: "providers",
              })
            }
          >
            <DescriptiveButtonIcon>
              <BoltIcon className="size-6 text-blue-10" aria-hidden />
            </DescriptiveButtonIcon>
            <DescriptiveButtonContent>
              <DescriptiveButtonTitle>Connect a model provider</DescriptiveButtonTitle>
              <DescriptiveButtonDescription>
                Add an API key for Anthropic, OpenAI, Google, or others
              </DescriptiveButtonDescription>
            </DescriptiveButtonContent>
          </DescriptiveButton>
        ) : null}

        <DescriptiveButton orientation="vertical" onClick={() => setPrompt(CONTRACT_REVIEW_PROMPT)}>
          <DescriptiveButtonIcon>
            <DocumentTextIcon className="size-6 text-blue-10" aria-hidden />
          </DescriptiveButtonIcon>
          <DescriptiveButtonContent>
            <DescriptiveButtonTitle>Review contract</DescriptiveButtonTitle>
            <DescriptiveButtonDescription>Check terms and negotiation risk</DescriptiveButtonDescription>
          </DescriptiveButtonContent>
        </DescriptiveButton>

        <DescriptiveButton orientation="vertical" onClick={() => setPrompt(DPA_REVIEW_PROMPT)}>
          <DescriptiveButtonIcon>
            <ShieldCheckIcon className="size-6 text-green-10" aria-hidden />
          </DescriptiveButtonIcon>
          <DescriptiveButtonContent>
            <DescriptiveButtonTitle>Review DPA/privacy</DescriptiveButtonTitle>
            <DescriptiveButtonDescription>Check GDPR, roles, and wording</DescriptiveButtonDescription>
          </DescriptiveButtonContent>
        </DescriptiveButton>

        <DescriptiveButton orientation="vertical" onClick={() => setPrompt(COMMERCIAL_DRAFT_PROMPT)}>
          <DescriptiveButtonIcon>
            <LockClosedIcon className="size-6 text-purple-10" aria-hidden />
          </DescriptiveButtonIcon>
          <DescriptiveButtonContent>
            <DescriptiveButtonTitle>Draft legal wording</DescriptiveButtonTitle>
            <DescriptiveButtonDescription>Create client-ready wording for approval</DescriptiveButtonDescription>
          </DescriptiveButtonContent>
        </DescriptiveButton>

        <DescriptiveButton orientation="vertical" onClick={() => setPrompt(DISCLOSURE_PROMPT)}>
          <DescriptiveButtonIcon>
            <TableCellsIcon className="size-6 text-blue-10" aria-hidden />
          </DescriptiveButtonIcon>
          <DescriptiveButtonContent>
            <DescriptiveButtonTitle>Check finance disclosure</DescriptiveButtonTitle>
            <DescriptiveButtonDescription>Review CONC gaps with citations</DescriptiveButtonDescription>
          </DescriptiveButtonContent>
        </DescriptiveButton>

        <DescriptiveButton orientation="vertical" onClick={() => setPrompt(AD_REVIEW_PROMPT)}>
          <DescriptiveButtonIcon>
            <ExclamationTriangleIcon className="size-6 text-amber-10" aria-hidden />
          </DescriptiveButtonIcon>
          <DescriptiveButtonContent>
            <DescriptiveButtonTitle>Review an advert</DescriptiveButtonTitle>
            <DescriptiveButtonDescription>Check CAP Code and finance claims</DescriptiveButtonDescription>
          </DescriptiveButtonContent>
        </DescriptiveButton>

        <DescriptiveButton orientation="vertical" onClick={() => setPrompt(COMPLAINT_PROMPT)}>
          <DescriptiveButtonIcon>
            <DocumentTextIcon className="size-6 text-green-10" aria-hidden />
          </DescriptiveButtonIcon>
          <DescriptiveButtonContent>
            <DescriptiveButtonTitle>Draft complaint response</DescriptiveButtonTitle>
            <DescriptiveButtonDescription>Ground the reply and flag risk</DescriptiveButtonDescription>
          </DescriptiveButtonContent>
        </DescriptiveButton>
      </div>
    </div>
  )
}
