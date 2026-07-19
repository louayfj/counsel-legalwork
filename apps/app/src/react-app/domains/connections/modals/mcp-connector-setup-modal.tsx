/** @jsxImportSource react */
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { McpDirectoryInfo } from "@/app/constants";

const PLACEHOLDER_RE = /\{([^}]+)\}/g;

function extractPlaceholders(url: string | undefined): string[] {
  if (!url) return [];
  const out: string[] = [];
  for (const match of url.matchAll(PLACEHOLDER_RE)) {
    if (!out.includes(match[1])) out.push(match[1]);
  }
  return out;
}

function labelFor(name: string): string {
  const map: Record<string, string> = {
    instance: "HighQ instance (subdomain)",
    site: "Site / context name",
    tenant_id: "Microsoft tenant ID",
    tenantHostname: "Relativity tenant hostname",
    region: "Region",
    customer: "Customer subdomain",
  };
  return map[name] ?? name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type McpConnectorSetupModalProps = {
  entry: McpDirectoryInfo | null;
  open: boolean;
  onClose: () => void;
  onConnect: (entry: McpDirectoryInfo) => void;
};

/**
 * Collects the organization-specific bits a connector needs before its one-click OAuth can
 * fire: any {placeholder} segments in the URL (instance/tenant/site) and, for
 * vendors without OAuth dynamic client registration, the organization's own OAuth app
 * clientId/secret. It then hands a fully-resolved entry to connectMcp, which
 * already knows how to write `url` + `oauth` into the engine config.
 */
export function McpConnectorSetupModal(props: McpConnectorSetupModalProps) {
  const entry = props.entry;
  const placeholders = useMemo(() => extractPlaceholders(entry?.url), [entry?.url]);
  const needsCreds = entry?.requiresOauthClient === true;
  // Public OAuth client (PKCE): collect only a client ID, never a secret.
  const clientIdOnly = entry?.oauthClientIdOnly === true;
  // Token-authed connectors (e.g. iManage) whose OAuth the local engine can't do:
  // collect an access token and connect via Authorization: Bearer instead.
  const needsToken = entry?.requiresToken === true;
  const requiredEnvironment = entry?.requiredEnvironment ?? [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scope, setScope] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setEnvironmentValue = (key: string, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const reset = () => {
    setValues({});
    setClientId("");
    setClientSecret("");
    setScope("");
    setToken("");
    setError(null);
  };

  const close = () => {
    reset();
    props.onClose();
  };

  const allPlaceholdersFilled = placeholders.every((p) => (values[p] ?? "").trim().length > 0);
  const credsOk = !needsCreds || (clientId.trim().length > 0 && (clientIdOnly || clientSecret.trim().length > 0));
  const tokenOk = !needsToken || token.trim().length > 0;
  const environmentOk = requiredEnvironment.every((field) => (values[field.key] ?? "").trim().length > 0);
  const canSubmit = Boolean(entry) && allPlaceholdersFilled && credsOk && tokenOk && environmentOk;

  const previewUrl = (entry?.url ?? "").replace(PLACEHOLDER_RE, (_, key: string) =>
    (values[key]?.trim() ? values[key].trim() : `{${key}}`),
  );

  const submit = () => {
    if (!entry || !canSubmit) return;
    const url = (entry.url ?? "").replace(PLACEHOLDER_RE, (_, key: string) => (values[key] ?? "").trim());
    if (/[{}]/.test(url)) {
      setError("Fill in every field before connecting.");
      return;
    }
    const oauthConfig = needsCreds
      ? {
          clientId: clientId.trim(),
          ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
          ...(scope.trim() ? { scope: scope.trim() } : {}),
        }
      : entry.oauthConfig;
    // Token connectors hand off Authorization: Bearer headers; connectMcp uses these
    // and skips OAuth (entry.oauth is already false for these connectors).
    const headers = needsToken && token.trim()
      ? { Authorization: `Bearer ${token.trim()}` }
      : entry.headers;
    const environment = { ...entry.environment };
    for (const field of requiredEnvironment) {
      environment[field.key] = (values[field.key] ?? "").trim();
    }
    props.onConnect({
      ...entry,
      url,
      oauthConfig,
      ...(headers ? { headers } : {}),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
    });
    close();
  };

  const inputClass =
    "w-full rounded-xl border border-dls-border bg-dls-hover px-3 py-2 text-sm text-dls-text focus:outline-none focus:ring-2 focus:ring-[rgba(var(--dls-accent-rgb),0.25)]";

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="flex max-h-[90vh] min-h-0 w-full max-w-lg flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set up {entry?.name ?? "connector"}</DialogTitle>
          <DialogDescription>
            {clientIdOnly
              ? "Enter your instance details and the OAuth client ID your provider issued, then connect."
              : needsCreds
              ? "This service has no automatic app registration, so enter your organization's OAuth app details. Then connect."
              : needsToken
              ? "This service's OAuth isn't supported by the local engine — paste an access token to connect instead."
              : requiredEnvironment.length > 0
              ? "Enter the credential required by this local connector. It is saved only in your local Counsel MCP configuration."
              : "Enter your instance details, then connect."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-px py-1">
          {error ? (
            <div className="rounded-xl border border-red-7/20 bg-red-1/40 px-4 py-3 text-xs text-red-12">{error}</div>
          ) : null}

          {placeholders.map((p) => (
            <label key={p} className="block space-y-1.5">
              <span className="text-xs font-medium text-dls-text">{labelFor(p)}</span>
              <input
                value={values[p] ?? ""}
                onChange={(event) => setEnvironmentValue(p, event.currentTarget.value)}
                placeholder={`{${p}}`}
                spellCheck={false}
                className={inputClass}
              />
            </label>
          ))}

          {needsCreds ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-dls-text">OAuth client ID</span>
                <input value={clientId} onChange={(event) => setClientId(event.currentTarget.value)} spellCheck={false} className={inputClass} />
              </label>
              {clientIdOnly ? null : (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-dls-text">OAuth client secret</span>
                    <input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.currentTarget.value)} className={inputClass} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-dls-text">Scope (optional)</span>
                    <input
                      value={scope}
                      onChange={(event) => setScope(event.currentTarget.value)}
                      placeholder="space-separated scopes"
                      spellCheck={false}
                      className={inputClass}
                    />
                  </label>
                </>
              )}
            </>
          ) : null}

          {needsToken ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-dls-text">API token</span>
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.currentTarget.value)}
                placeholder="Paste your access token"
                spellCheck={false}
                className={inputClass}
              />
              <span className="block text-[11px] leading-relaxed text-dls-secondary">
                Sent as <span className="font-mono">Authorization: Bearer …</span> — skips OAuth.
              </span>
            </label>
          ) : null}

          {requiredEnvironment.map((field) => (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-medium text-dls-text">{field.label}</span>
              <input
                type={field.secret ? "password" : "text"}
                value={values[field.key] ?? ""}
                onChange={(event) => setEnvironmentValue(field.key, event.currentTarget.value)}
                placeholder={field.placeholder}
                spellCheck={false}
                className={inputClass}
              />
              {field.description ? (
                <span className="block text-[11px] leading-relaxed text-dls-secondary">
                  {field.description}
                </span>
              ) : null}
            </label>
          ))}

          {entry?.url ? (
            <div className="break-all rounded-xl border border-dls-border bg-dls-hover px-3 py-2 font-mono text-[11px] text-dls-secondary">
              {previewUrl}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
