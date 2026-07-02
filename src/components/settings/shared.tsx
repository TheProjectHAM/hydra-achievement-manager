import React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "../Icons";

/* ─── Page layout ─────────────────────────────────────────── */

export const SettingsPage: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, children, className }) => (
  <div className={cn("mx-auto w-full max-w-2xl space-y-8 pb-8", className)}>
    <header className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </header>
    {children}
  </div>
);

export const SettingsSection: React.FC<{
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, children, className }) => (
  <section className={cn("space-y-3", className)}>
    {(title || description) && (
      <div className="space-y-0.5 px-1">
        {title && (
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        )}
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
    )}
    {children}
  </section>
);

export const SettingsPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    className={cn(
      "divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
      className,
    )}
  >
    {children}
  </div>
);

/* ─── Setting rows ────────────────────────────────────────── */

export const SettingsRow: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}> = ({ label, description, children, disabled, className }) => (
  <div
    className={cn(
      "flex items-center justify-between gap-6 px-4 py-3.5",
      disabled && "pointer-events-none opacity-50",
      className,
    )}
  >
    <div className="min-w-0 flex-1 space-y-0.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="flex shrink-0 items-center">{children}</div>
  </div>
);

export const SettingsToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, checked, onCheckedChange, disabled }) => (
  <SettingsRow label={label} description={description} disabled={disabled}>
    <Switch
      size="sm"
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  </SettingsRow>
);

export const SettingsActionRow: React.FC<{
  label: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}> = ({
  label,
  description,
  actionLabel,
  onAction,
  disabled,
  loading,
  icon,
}) => (
  <SettingsRow label={label} description={description}>
    <Button
      variant="outline"
      size="sm"
      onClick={onAction}
      disabled={disabled || loading}
    >
      {icon}
      {actionLabel}
    </Button>
  </SettingsRow>
);

/* ─── Segmented control ───────────────────────────────────── */

export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div
    className={cn(
      "inline-flex rounded-lg bg-muted p-0.5",
      className,
    )}
    role="group"
  >
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          value === opt.value
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/* ─── Option cards (radio-style) ──────────────────────────── */

export const OptionCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}> = ({ selected, onSelect, icon, title, description, className }) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "relative flex w-full flex-col rounded-xl border p-4 text-left transition-colors",
      selected
        ? "border-foreground/30 bg-accent ring-1 ring-foreground/10"
        : "border-border bg-card hover:bg-accent/50",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      {selected && (
        <CheckIcon className="ml-auto text-base text-foreground" />
      )}
    </div>
    <p className="mt-2 text-sm font-medium text-foreground">{title}</p>
    {description && (
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    )}
  </button>
);

export const OptionCardGrid: React.FC<{
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}> = ({ children, columns = 2, className }) => (
  <div
    className={cn(
      "grid gap-3",
      columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      className,
    )}
  >
    {children}
  </div>
);

/* ─── Theme picker ────────────────────────────────────────── */

export const ThemeSwatch: React.FC<{
  name: string;
  colors: string[];
  selected: boolean;
  onSelect: () => void;
}> = ({ name, colors, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "flex flex-col rounded-xl border p-3 text-left transition-colors",
      selected
        ? "border-foreground/30 bg-accent ring-1 ring-foreground/10"
        : "border-border bg-card hover:bg-accent/50",
    )}
  >
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="truncate text-xs font-medium text-foreground">
        {name}
      </span>
      {selected && <CheckIcon className="shrink-0 text-sm" />}
    </div>
    <div className="flex h-8 overflow-hidden rounded-md">
      {colors.map((color, i) => (
        <div
          key={`${name}-${i}`}
          className="flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  </button>
);

/* ─── Language grid ───────────────────────────────────────── */

export const LanguageOption: React.FC<{
  name: string;
  countryCode: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ name, countryCode, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
      selected
        ? "border-foreground/30 bg-accent ring-1 ring-foreground/10"
        : "border-border bg-card hover:bg-accent/50",
    )}
  >
    <img
      src={`${import.meta.env.VITE_FLAGS_API_URL || "https://flagsapi.com"}/${countryCode}/flat/64.png`}
      alt=""
      className="h-5 w-7 shrink-0 rounded-sm object-cover"
    />
    <span className="truncate text-sm font-medium text-foreground">{name}</span>
    {selected && <CheckIcon className="ml-auto shrink-0 text-sm" />}
  </button>
);

/* ─── Status badge ────────────────────────────────────────── */

export const StatusBadge: React.FC<{
  variant?: "default" | "success" | "warning" | "muted";
  children: React.ReactNode;
  className?: string;
}> = ({ variant = "default", children, className }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
      variant === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      variant === "warning" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      variant === "muted" && "bg-muted text-muted-foreground",
      variant === "default" && "bg-accent text-foreground",
      className,
    )}
  >
    {children}
  </span>
);

/* ─── Accordion card (connections, monitored) ─────────────── */

export const AccordionCard: React.FC<{
  expanded: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ expanded, onToggle, header, children, className }) => (
  <div
    className={cn(
      "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
      className,
    )}
  >
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
    >
      {header}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn(
          "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          expanded && "rotate-90",
        )}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        {children && (
          <div className="space-y-2 border-t border-border p-4">{children}</div>
        )}
      </div>
    </div>
  </div>
);

/* ─── Inline field row (dense settings inside cards) ──────── */

export const InlineFieldRow: React.FC<{
  label: string;
  description?: string;
  badge?: React.ReactNode;
  trailing: React.ReactNode;
  disabled?: boolean;
}> = ({ label, description, badge, trailing, disabled }) => (
  <div
    className={cn(
      "flex items-center justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2.5",
      disabled && "opacity-60",
    )}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {badge}
      </div>
      {description && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    <div className="shrink-0">{trailing}</div>
  </div>
);

export { Separator, Button, Switch, Label };
