/** @jsxImportSource react */
import type * as React from "react";
import { RefreshCcw } from "lucide-react";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SettingsTone = "ready" | "warning" | "neutral" | "error";

export interface SpinnerProps {
  className?: string;
  size?: number;
  spinning?: boolean;
}

export function Spinner({
  className,
  size = 13,
  spinning = true,
}: SpinnerProps) {
  return <RefreshCcw size={size} className={cn(spinning && "animate-spin", className)} />;
}

export interface RefreshButtonProps extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  busy: boolean;
  onRefresh: () => void | Promise<void>;
}

export function RefreshButton({
  busy,
  children,
  className,
  onRefresh,
  ...props
}: RefreshButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("text-muted-foreground", className)}
            onClick={() => void onRefresh()}
            {...props}
          >
            <span className="sr-only">{children}</span>
            <Spinner className="size-3.5" spinning={busy} />
          </Button>
        )}
      />
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

export interface SettingsLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsStack({ children, className }: SettingsLayoutProps) {
  return <div className={cn("@container/settings flex w-full max-w-4xl flex-col gap-y-5", className)}>{children}</div>;
}

interface SettingsSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ children, className }: SettingsSectionProps) {
  return (
    <div data-settings-section className={cn("flex flex-col gap-3", className)}>
      {children}
    </div>
  );
}

interface SettingsInsetProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsInset({ children, className }: SettingsInsetProps) {
  return (
    <div className={cn("rounded-xl border border-dls-border p-3.5", className)}>
      {children}
    </div>
  );
}

interface SettingsPillProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsPill({ children, className }: SettingsPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dls-border bg-dls-hover px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusDotVariants = cva("", {
  variants: {
    tone: {
      ready: "bg-green-9",
      warning: "bg-amber-9",
      error: "bg-red-9",
      neutral: "bg-gray-8",
    },
  },
});

export interface SettingsStatusBadgeProps {
  label: string;
  tone: SettingsTone;
  className?: string;
}

export function SettingsStatusBadge({ label, tone, className }: SettingsStatusBadgeProps) {
  return (
    <div
      className={cn(
        "flex min-h-7 shrink-0 items-center justify-start gap-1.5 rounded-lg px-2.5 py-0 text-center text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", statusDotVariants({ tone }))} />
      {label}
    </div>
  );
}

export interface SettingsNoticeProps extends SettingsLayoutProps {
  tone?: "neutral" | "error";
}

export function SettingsNotice({
  children,
  tone = "neutral",
  className,
}: SettingsNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dls-border bg-dls-hover px-3 py-2 text-[11.5px] leading-[1.45] text-muted-foreground",
        tone === "error" && "border-red-7/30 bg-red-1/40 text-red-11",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type SectionItemHeaderProps = SettingsLayoutProps;

export function SettingsSectionHeader({ children, className }: SectionItemHeaderProps) {
  return (
    <div className={cn("flex flex-col justify-between gap-2 md:flex-row md:items-start", className)}>
      {children}
    </div>
  );
}

interface SectionItemHeaderContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionHeaderContent({ children, className }: SectionItemHeaderContentProps) {
  return <div className={cn("flex flex-col gap-0.5", className)}>{children}</div>;
}

interface SettingsItemHeaderTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionHeaderTitle({ children, className }: SettingsItemHeaderTitleProps) {
  return (
    <div className={cn("flex items-center gap-2 text-[13px] font-medium leading-5 text-dls-text", className)}>
      {children}
    </div>
  );
}

interface SectionItemHeaderDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionHeaderDescription({ children, className }: SectionItemHeaderDescriptionProps) {
  return <div className={cn("text-[12px] leading-[1.45] text-muted-foreground", className)}>{children}</div>;
}


interface SectionItemHintProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionHint({ children, className }: SectionItemHintProps) {
  return <div className={cn("text-[11.5px] leading-[1.45] text-muted-foreground", className)}>{children}</div>;
}

interface SectionItemHeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionHeaderActions({ children, className }: SectionItemHeaderActionsProps) {
  return <div className={cn("flex flex-wrap items-center gap-1.5", className)}>{children}</div>;
}
