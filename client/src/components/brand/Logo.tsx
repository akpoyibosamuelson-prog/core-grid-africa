import { cn } from "@/lib/utils";

/**
 * CORE GRID AFRICA logo mark.
 * A "grid" of connected nodes — digital infrastructure for growing businesses.
 * Rendered as inline SVG so it scales crisply and needs no asset pipeline.
 */
export function LogoMark({ className, variant = "default" }: { className?: string; variant?: "default" | "light" }) {
  const navy = variant === "light" ? "#FFFFFF" : "#0A1F44";
  const royal = variant === "light" ? "#8FB0FF" : "#1E4FD8";
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} role="img" aria-label="Core Grid Africa">
      <rect x="1" y="1" width="38" height="38" rx="10" fill={navy} />
      {/* grid lines */}
      <g stroke={royal} strokeWidth="1.4" opacity="0.55">
        <line x1="13" y1="8" x2="13" y2="32" />
        <line x1="27" y1="8" x2="27" y2="32" />
        <line x1="8" y1="13" x2="32" y2="13" />
        <line x1="8" y1="27" x2="32" y2="27" />
      </g>
      {/* connected nodes */}
      <g fill="#FFFFFF">
        <circle cx="13" cy="13" r="3.1" />
        <circle cx="27" cy="13" r="3.1" />
        <circle cx="13" cy="27" r="3.1" />
        <circle cx="27" cy="27" r="3.1" />
      </g>
      <circle cx="20" cy="20" r="4.2" fill={royal} />
      <circle cx="20" cy="20" r="1.7" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({
  className,
  variant = "default",
  showTagline = false,
}: {
  className?: string;
  variant?: "default" | "light";
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark variant={variant} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[15px] font-bold tracking-tight",
            variant === "light" ? "text-white" : "text-navy",
          )}
        >
          CORE GRID <span className={variant === "light" ? "text-[#8FB0FF]" : "text-primary"}>AFRICA</span>
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 text-[10px] font-medium uppercase tracking-[0.14em]",
              variant === "light" ? "text-white/60" : "text-muted-foreground",
            )}
          >
            Powering Businesses
          </span>
        )}
      </span>
    </span>
  );
}
