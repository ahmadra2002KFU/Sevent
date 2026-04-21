import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "wordmark" | "mark";
  tone?: "color" | "white";
  className?: string;
  "aria-label"?: string;
};

/**
 * Sevent logo. Inline SVG so it renders without a network request and can be
 * recolored via currentColor where needed. The SVG font stack references Inter
 * Black Italic; if the senior provides path-traced glyphs, replace the <text>
 * nodes without changing props or viewBox.
 *
 * `direction="ltr"` is pinned on the root + text nodes so the Latin glyph
 * layout does not mirror when the enclosing HTML is `dir="rtl"` (Arabic).
 * Without it, SVG `text-anchor` and `x` resolve against the inherited RTL
 * direction and the wordmark renders backwards/clipped.
 */
export function Logo({
  variant = "wordmark",
  tone = "color",
  className,
  "aria-label": ariaLabel = "Sevent",
}: LogoProps) {
  if (variant === "mark") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 210 160"
        role="img"
        aria-label={ariaLabel}
        direction="ltr"
        className={cn("shrink-0", className)}
      >
        <path
          d="M26 8 L204 8 L180 150 L2 150 Z"
          fill={tone === "white" ? "#ffffff" : "#1e7bd8"}
        />
        <text
          x="103"
          y="122"
          fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="140"
          textAnchor="middle"
          direction="ltr"
          fill={tone === "white" ? "#1e7bd8" : "#ffffff"}
          letterSpacing="-4"
        >
          S
        </text>
      </svg>
    );
  }

  const cobalt = "#1e7bd8";
  const navy = "#0f2e5c";
  const white = "#ffffff";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 760 180"
      role="img"
      aria-label={ariaLabel}
      direction="ltr"
      className={cn("shrink-0", className)}
    >
      <path
        d="M24 8 L204 8 L180 148 L0 148 Z"
        fill={tone === "white" ? white : cobalt}
      />
      <text
        x="102"
        y="120"
        fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="140"
        textAnchor="middle"
        direction="ltr"
        fill={tone === "white" ? cobalt : white}
        letterSpacing="-4"
      >
        S
      </text>
      <text
        x="218"
        y="120"
        fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="140"
        textAnchor="start"
        direction="ltr"
        fill={tone === "white" ? white : navy}
        letterSpacing="-2"
      >
        EVENT
      </text>
      <rect
        x="18"
        y="158"
        width="724"
        height="10"
        fill={tone === "white" ? white : cobalt}
      />
    </svg>
  );
}
