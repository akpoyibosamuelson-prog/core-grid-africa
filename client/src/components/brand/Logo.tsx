import { cn } from "@/lib/utils";

/**
 * CORE GRID AFRICA logo mark.
 *
 * The mark is the client's supplied emblem (Africa + bar chart + growth arrow),
 * served from /logo-mark.png. The source artwork is a JPEG on a solid white
 * background, so it is presented inside a white rounded tile rather than being
 * knocked out: the emblem's own dark ring would otherwise disappear against the
 * navy header. The tile keeps it crisp and legible on BOTH the dark navy and
 * the light grey surfaces, and `object-contain` + inner padding means it is
 * never stretched or cropped at small sizes.
 */
export function LogoMark({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "light";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm",
        variant === "light" ? "ring-1 ring-white/25" : "ring-1 ring-black/5",
        className,
      )}
    >
      <img
        src="/logo-mark.png"
        alt="Core Grid Africa"
        width={512}
        height={512}
        decoding="async"
        className="h-full w-full object-contain p-[7%]"
      />
    </span>
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
