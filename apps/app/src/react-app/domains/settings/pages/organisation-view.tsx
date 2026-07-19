/** @jsxImportSource react */
import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Network,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LegalworkServerClient } from "@/app/lib/legalwork-server";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionTitle,
  LayoutStack,
} from "../settings-layout";

type OrganisationMode = "dealership" | "dealer-group" | "axleo-internal";

type OrganisationForm = {
  name: string;
  mode: OrganisationMode;
  description: string;
  approvalLabel: string;
  instructions: string;
};

type OrganisationTextField = Exclude<keyof OrganisationForm, "mode">;

const organisationModes: Array<{
  value: OrganisationMode;
  label: string;
  description: string;
  icon: typeof Store;
}> = [
  {
    value: "dealership",
    label: "Dealership",
    description: "Compliance and legal work for one dealership.",
    icon: Store,
  },
  {
    value: "dealer-group",
    label: "Dealer group",
    description: "Shared policies across multiple dealerships.",
    icon: Network,
  },
  {
    value: "axleo-internal",
    label: "Axleo internal",
    description: "SaaS contracts, privacy and internal approvals.",
    icon: Building2,
  },
];

export type OrganisationViewProps = {
  client: LegalworkServerClient | null;
  workspaceId: string | null;
  workspaceName: string;
  onSaved?: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function modeValue(value: unknown): OrganisationMode {
  return value === "dealer-group" || value === "axleo-internal" ? value : "dealership";
}

function initialForm(workspaceName: string): OrganisationForm {
  return {
    name: workspaceName.trim() || "My organisation",
    mode: "dealership",
    description: "",
    approvalLabel: "",
    instructions: "",
  };
}

function formFromConfig(value: unknown, workspaceName: string): OrganisationForm {
  const fallback = initialForm(workspaceName);
  if (!isRecord(value)) return fallback;
  return {
    name: textValue(value.name) || fallback.name,
    mode: modeValue(value.mode),
    description: textValue(value.description),
    approvalLabel: textValue(value.approvalLabel),
    instructions: textValue(value.instructions),
  };
}

export function OrganisationView(props: OrganisationViewProps) {
  const [form, setForm] = useState(() => initialForm(props.workspaceName));
  const [savedForm, setSavedForm] = useState(() => initialForm(props.workspaceName));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = props.client;
    const workspaceId = props.workspaceId;
    if (!client || !workspaceId) {
      const nextForm = initialForm(props.workspaceName);
      setForm(nextForm);
      setSavedForm(nextForm);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    client.getConfig(workspaceId)
      .then((config) => {
        if (!cancelled) {
          const nextForm = formFromConfig(config.legalwork.organisation, props.workspaceName);
          setForm(nextForm);
          setSavedForm(nextForm);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load the organisation profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.client, props.workspaceId, props.workspaceName]);

  const update = (key: OrganisationTextField, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const save = async () => {
    const client = props.client;
    const workspaceId = props.workspaceId;
    if (!client || !workspaceId) {
      setMessage("Connect this workspace before saving its organisation profile.");
      return;
    }
    if (!form.name.trim()) {
      setMessage("Enter the organisation name.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await client.patchConfig(workspaceId, {
        legalwork: {
          organisation: {
            name: form.name.trim(),
            mode: form.mode,
            description: form.description.trim(),
            approvalLabel: form.approvalLabel.trim(),
            instructions: form.instructions.trim(),
          },
        },
      });
      setSavedForm(form);
      setMessage("Organisation profile saved. New agent sessions will use it.");
      props.onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the organisation profile.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const activeMode = organisationModes.find((mode) => mode.value === form.mode) ?? organisationModes[0];
  const ActiveModeIcon = activeMode.icon;
  const profileName = form.name.trim() || "Your organisation";

  return (
    <LayoutStack className="max-w-5xl gap-y-6">
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle className="text-[15px]">Organisation profile</LayoutSectionTitle>
          <LayoutSectionDescription>
            Set the context Leo uses for this workspace. The shared UK automotive compliance pack stays available.
          </LayoutSectionDescription>
        </LayoutSectionHeader>

        <div className="overflow-hidden rounded-[22px] border border-dls-border bg-dls-surface shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 border-b border-dls-border bg-dls-hover/35 px-5 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--dls-accent-rgb),0.10)] text-dls-accent">
              <ActiveModeIcon size={19} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-dls-text">{profileName}</div>
              <div className="text-xs text-dls-secondary">{activeMode.label} workspace</div>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-dls-border bg-dls-surface px-3 py-1.5 text-[11px] font-medium text-dls-secondary sm:flex">
              <ShieldCheck size={13} />
              Workspace only
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-6">
            <section className="space-y-4">
              <div>
                <h4 className="text-[13px] font-semibold text-dls-text">Identity</h4>
                <p className="mt-0.5 text-[12px] text-dls-secondary">Choose who Leo is working for in this workspace.</p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-dls-text">Organisation name</span>
                <Input
                  value={form.name}
                  disabled={loading || saving}
                  placeholder="Example Motor Group"
                  className="bg-dls-surface"
                  onChange={(event) => update("name", event.currentTarget.value)}
                />
              </label>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-dls-text">Workspace type</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
                  {organisationModes.map((mode) => {
                    const selected = form.mode === mode.value;
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        disabled={loading || saving}
                        aria-pressed={selected}
                        onClick={() => {
                          setForm((current) => ({ ...current, mode: mode.value }));
                          setMessage(null);
                        }}
                        className={`relative min-h-[112px] rounded-2xl border p-3.5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-[rgba(var(--dls-accent-rgb),0.25)] disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-dls-accent bg-[rgba(var(--dls-accent-rgb),0.07)] shadow-[inset_0_0_0_1px_rgba(var(--dls-accent-rgb),0.12)]" : "border-dls-border bg-dls-surface hover:bg-dls-hover/50"}`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <Icon size={17} className={selected ? "text-dls-accent" : "text-dls-secondary"} />
                          <span className={`flex size-5 items-center justify-center rounded-full border ${selected ? "border-dls-accent bg-dls-accent text-white" : "border-dls-border"}`}>
                            {selected ? <Check size={12} strokeWidth={2.5} /> : null}
                          </span>
                        </div>
                        <div className="text-[12px] font-semibold text-dls-text">{mode.label}</div>
                        <div className="mt-1 text-[11px] leading-[1.4] text-dls-secondary">{mode.description}</div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            <div className="h-px bg-dls-border" />

            <section className="space-y-4">
              <div className="flex items-start gap-2.5">
                <Sparkles size={16} className="mt-0.5 text-dls-accent" />
                <div>
                  <h4 className="text-[13px] font-semibold text-dls-text">How Leo should work</h4>
                  <p className="mt-0.5 text-[12px] text-dls-secondary">Optional details that shape answers, drafts and approvals.</p>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-dls-text">Operating context</span>
                  <Input
                    value={form.description}
                    disabled={loading || saving}
                    placeholder="What does this organisation do?"
                    className="bg-dls-surface"
                    onChange={(event) => update("description", event.currentTarget.value)}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-dls-text">Approval wording</span>
                  <Input
                    value={form.approvalLabel}
                    disabled={loading || saving}
                    placeholder={`${form.name || "Organisation"} approval`}
                    className="bg-dls-surface"
                    onChange={(event) => update("approvalLabel", event.currentTarget.value)}
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-dls-text">Special instructions</span>
                <Textarea
                  value={form.instructions}
                  disabled={loading || saving}
                  rows={4}
                  className="min-h-[104px] resize-y bg-dls-surface"
                  placeholder="Policies, escalation rules, drafting tone or commercial positions Leo should follow."
                  onChange={(event) => update("instructions", event.currentTarget.value)}
                />
                <span className="block text-[11px] leading-relaxed text-dls-secondary">
                  Add source folders under Permissions. Keep credentials and confidential documents out of this field.
                </span>
              </label>
            </section>
          </div>

          <div className="flex min-h-16 flex-col gap-3 border-t border-dls-border bg-dls-hover/25 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className={`text-xs ${message?.includes("saved") ? "text-dls-accent" : "text-dls-secondary"}`}>
              {message ?? (isDirty ? "You have unsaved changes." : "This profile is used when a new agent session starts.")}
            </span>
            <Button disabled={loading || saving || !form.name.trim() || !isDirty} onClick={() => void save()}>
              {saving ? "Saving…" : isDirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>
      </LayoutSection>
    </LayoutStack>
  );
}
