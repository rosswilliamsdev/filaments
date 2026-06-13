import type { FilamentStatus, FilamentType } from "@/lib/types";

/* Small shared building blocks — composition over configuration
   (design-system.md → Usage Notes). */

const TYPE_LABEL: Record<FilamentType, string> = {
  voice: "Voice",
  document: "Document",
  text: "Text",
};

const TYPE_CLASS: Record<FilamentType, string> = {
  voice: "bg-type-voice/10 text-type-voice",
  document: "bg-type-document/10 text-type-document",
  text: "bg-type-text/10 text-type-text",
};

export function TypeBadge({ type }: { type: FilamentType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${TYPE_CLASS[type]}`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

const STATUS_META: Record<
  FilamentStatus,
  { label: string; className: string } | null
> = {
  pending_upload: {
    label: "Uploading…",
    className: "bg-warning-light text-warning",
  },
  processing: {
    label: "Processing…",
    className: "bg-warning-light text-warning",
  },
  failed: { label: "Failed", className: "bg-error-light text-error" },
  done: null, // the quiet default — no badge (AI works in the background)
};

export function StatusBadge({ status }: { status: FilamentStatus }) {
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export function TagPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700">
      {name}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-neutral-300 disabled:text-neutral-400",
  secondary:
    "bg-brand-100 text-brand-700 hover:bg-brand-200 active:bg-brand-300 disabled:bg-neutral-100 disabled:text-neutral-400",
  ghost:
    "bg-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:text-neutral-400",
  destructive:
    "bg-error text-white hover:opacity-90 active:opacity-80 disabled:bg-neutral-300 disabled:text-neutral-400",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-12 px-5 text-lg",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  className = "",
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  busy?: boolean;
}) {
  return (
    <button
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 ease-in-out disabled:pointer-events-none ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-serif text-xl text-neutral-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-neutral-500">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-error-light px-3 py-2 text-sm text-error"
    >
      {message}
    </p>
  );
}
