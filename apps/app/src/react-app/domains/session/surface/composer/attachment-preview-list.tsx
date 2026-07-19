/** @jsxImportSource react */
import { X } from "lucide-react";

import { ArtifactIcon } from "@/components/chat/artifact-icon";
import { formatBytes } from "@/app/utils";
import { getArtifactType } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

type AttachmentPreviewItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
};

type AttachmentPreviewListProps = {
  items: AttachmentPreviewItem[];
  onRemove: (ids: string[]) => void;
  className?: string;
};

function extensionLabel(name: string) {
  const extension = name.split(".").pop();
  return extension && extension !== name ? extension.toUpperCase() : "FILE";
}

function RemoveButton(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-gray-9 transition-colors hover:bg-gray-3 hover:text-gray-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-7"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onClick();
      }}
      aria-label={props.label}
      title={props.label}
    >
      <X size={13} />
    </button>
  );
}

function FilePreview(props: { item: AttachmentPreviewItem; onRemove: () => void }) {
  const { item } = props;
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5 rounded-2xl border border-gray-6 bg-gray-2/70 px-3 py-2.5 sm:w-auto sm:min-w-[220px]">
      {item.previewUrl ? (
        <img src={item.previewUrl} alt="" className="size-9 shrink-0 rounded-lg border border-gray-6 object-cover" />
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-3">
          <ArtifactIcon type={getArtifactType(item.name)} className="size-[18px]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-12" title={item.name}>{item.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-gray-9">
          <span>{extensionLabel(item.name)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(item.size)}</span>
        </div>
      </div>
      <RemoveButton label={`Remove ${item.name}`} onClick={props.onRemove} />
    </div>
  );
}

export function AttachmentPreviewList({ items, onRemove, className }: AttachmentPreviewListProps) {
  return (
    <div className={cn("flex flex-wrap items-start gap-2", className)} aria-label="Attached files">
      {items.map((item) => (
        <FilePreview key={item.id} item={item} onRemove={() => onRemove([item.id])} />
      ))}
    </div>
  );
}
