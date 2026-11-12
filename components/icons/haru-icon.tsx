import type { SVGProps } from "react"

// The 16px and 24px artwork is copied from the delivered haru-icons-v1 SVGs.
// Keep this subset limited to the twenty-five icons used by P001–P029.
const iconArtwork = {
  brand: {
    compact: (
      <>
        <path d="M2 6.5Q5 5 8 6.5Q11 5 14 6.5V14Q11 12.5 8 14Q5 12.5 2 14Z" />
        <path d="M8 6.5V14M5.75 3.5a2.25 2.25 0 0 1 4.5 0" />
      </>
    ),
    regular: (
      <>
        <path d="M3 9Q7.5 6.5 12 9Q16.5 6.5 21 9V21Q16.5 18.5 12 21Q7.5 18.5 3 21Z" />
        <path d="M12 9V21M8.5 5a3.5 3.5 0 0 1 7 0" />
      </>
    ),
  },
  loading: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="M20.1 8.1A9 9 0 1 1 15.9 3.9" />
      </g>
    ),
    regular: <path d="M20.1 8.1A9 9 0 1 1 15.9 3.9" />,
  },
  "cloud-unsaved": {
    compact: (
      <>
        <path d="M5.25 12.75H4a2.75 2.75 0 0 1-.1-5.5 4.25 4.25 0 0 1 8.2 0 2.75 2.75 0 0 1-.1 5.5h-1.25" />
        <path d="M8 8.25v2" />
        <circle cx="8" cy="12.75" r=".65" fill="currentColor" stroke="none" />
      </>
    ),
    regular: (
      <>
        <path d="M8 19H6a4 4 0 0 1-.4-7.98 6.5 6.5 0 0 1 12.8 0A4 4 0 0 1 18 19h-2" />
        <path d="M12 12v3" />
        <circle cx="12" cy="19" r=".75" fill="currentColor" stroke="none" />
      </>
    ),
  },
  "cloud-saved": {
    compact: (
      <>
        <path d="M4.5 12.75H4a2.75 2.75 0 0 1-.1-5.5 4.25 4.25 0 0 1 8.2 0 2.75 2.75 0 0 1-.1 5.5h-.5" />
        <path d="m5.75 10.5 1.5 1.5L10.5 8.75" />
      </>
    ),
    regular: (
      <>
        <path d="M6.5 19H6a4 4 0 0 1-.4-7.98 6.5 6.5 0 0 1 12.8 0A4 4 0 0 1 18 19h-.5" />
        <path d="m8 16 2.5 2.5L16 13" />
      </>
    ),
  },
  cloud: {
    compact: (
      <path d="M4 12.75a2.75 2.75 0 0 1-.1-5.5 4.25 4.25 0 0 1 8.2 0 2.75 2.75 0 0 1-.1 5.5Z" />
    ),
    regular: (
      <path d="M6 19a4 4 0 0 1-.4-7.98 6.5 6.5 0 0 1 12.8 0A4 4 0 0 1 18 19Z" />
    ),
  },
  settings: {
    compact: (
      <>
        <path d="M2 3.5h1.5m3 0H14M2 8h7.5m3 0H14M2 12.5h1.5m3 0H14" />
        <circle cx="5" cy="3.5" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="12.5" r="1.5" />
      </>
    ),
    regular: (
      <>
        <path d="M3 5h3m4 0h11M3 12h11m4 0h3M3 19h3m4 0h11" />
        <circle cx="8" cy="5" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="8" cy="19" r="2" />
      </>
    ),
  },
  calendar: {
    compact: (
      <>
        <rect x="2" y="3.5" width="12" height="10.5" rx="2" />
        <path d="M5.25 2v3m5.5-3v3M2 7h12M5.5 10.5h5" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18M8 14h8m-8 3h8" />
      </>
    ),
  },
  info: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <circle cx="12" cy="7.5" r=".75" fill="currentColor" stroke="none" />
      </g>
    ),
    regular: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <circle cx="12" cy="7.5" r=".75" fill="currentColor" stroke="none" />
      </>
    ),
  },
  "book-open": {
    compact: (
      <>
        <path d="M2 4Q5 2.5 8 4Q11 2.5 14 4V13.5Q11 12 8 13.5Q5 12 2 13.5Z" />
        <path d="M8 4v9.5" />
      </>
    ),
    regular: (
      <>
        <path d="M3 6Q7.5 3.5 12 6Q16.5 3.5 21 6V20Q16.5 17.5 12 20Q7.5 17.5 3 20Z" />
        <path d="M12 6v14" />
      </>
    ),
  },
  notebook: {
    compact: (
      <>
        <rect x="2.5" y="2" width="11" height="12" rx="2" />
        <path d="M5.5 2v12M9.5 2v5l1.5-1 1.5 1V2" />
      </>
    ),
    regular: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 3v18M14 3v7l2-1.5 2 1.5V3" />
      </>
    ),
  },
  repeat: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="M4 7.5A9 9 0 1 1 3 13" />
        <path d="m4 3-1 5.5 5.5-1" />
      </g>
    ),
    regular: (
      <>
        <path d="M4 7.5A9 9 0 1 1 3 13" />
        <path d="m4 3-1 5.5 5.5-1" />
      </>
    ),
  },
  "calendar-check": {
    compact: (
      <>
        <rect x="2" y="3.5" width="12" height="10.5" rx="2" />
        <path d="M5.25 2v3m5.5-3v3M2 7h12m-8.5 3 1.75 1.75L10.75 9" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18m-13 5 3 3 5-5" />
      </>
    ),
  },
  "arrow-right": {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="M3 12h18m-7-7 7 7-7 7" />
      </g>
    ),
    regular: <path d="M3 12h18m-7-7 7 7-7 7" />,
  },
  plus: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="M12 4v16M4 12h16" />
      </g>
    ),
    regular: <path d="M12 4v16M4 12h16" />,
  },
  "record-file": {
    compact: (
      <>
        <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6Z" />
        <path d="M9 1.5V5a1 1 0 0 0 1 1h3.5M5 7.5h6M5 10h6M5 12.5h4" />
      </>
    ),
    regular: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4M8 11h8M8 15h8M8 19h6" />
      </>
    ),
  },
  sparkle: {
    compact: (
      <path d="M8 1.5Q7 7 1.5 8Q7 9 8 14.5Q9 9 14.5 8Q9 7 8 1.5Z" />
    ),
    regular: (
      <path d="M12 3Q10.5 10.5 3 12Q10.5 13.5 12 21Q13.5 13.5 21 12Q13.5 10.5 12 3Z" />
    ),
  },
  check: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="m4 12 5 5L20 6" />
      </g>
    ),
    regular: <path d="m4 12 5 5L20 6" />,
  },
  unassessed: {
    compact: (
      <path d="M8 2A6 6 0 0 1 11 2.804M13.196 5A6 6 0 0 1 14 8M13.196 11A6 6 0 0 1 11 13.196M8 14A6 6 0 0 1 5 13.196M2.804 11A6 6 0 0 1 2 8M2.804 5A6 6 0 0 1 5 2.804" />
    ),
    regular: (
      <path d="M12 3A9 9 0 0 1 15.444 3.685M18.364 5.636A9 9 0 0 1 20.315 8.556M21 12A9 9 0 0 1 20.315 15.444M18.364 18.364A9 9 0 0 1 15.444 20.315M12 21A9 9 0 0 1 8.556 20.315M5.636 18.364A9 9 0 0 1 3.685 15.444M3 12A9 9 0 0 1 3.685 8.556M5.636 5.636A9 9 0 0 1 8.556 3.685" />
    ),
  },
  "alert-circle": {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </g>
    ),
    regular: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  "memory-warmup": {
    compact: (
      <path d="M5.5 12c0-1.5-2-2.2-2-4.5a4.5 4.5 0 0 1 9 0c0 2.3-2 3-2 4.5ZM6 14.5h4" />
    ),
    regular: (
      <path d="M8.5 18c0-2.2-2.5-3.3-2.5-6a6 6 0 0 1 12 0c0 2.7-2.5 3.8-2.5 6M8.5 18h7M9 21h6M12 2v1m-8.5 2.5 1 1m16-1-1 1" />
    ),
  },
  "recall-card": {
    compact: (
      <path d="M7 6H3.5A1.5 1.5 0 0 0 2 7.5v5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V10M14 7.5A4.5 4.5 0 0 0 9.5 3h-1m1.5-1.5L8.5 3 10 4.5" />
    ),
    regular: (
      <path d="M11 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M21 10a6 6 0 0 0-6-6h-1m2-2-2 2 2 2" />
    ),
  },
  "sentence-write": {
    compact: (
      <path d="M2 4h7M2 7.5h4M7 14l.8-2.8 4.9-4.9a1.4 1.4 0 0 1 2 2l-4.9 4.9L7 14Zm4.5-6.5 2 2" />
    ),
    regular: (
      <path d="M3 6h9M3 11h6m1 10 1-4 8-8a2.12 2.12 0 0 1 3 3l-8 8-4 1Zm7-10 3 3m-9 3 3 3" />
    ),
  },
  eye: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="M2 12c2.6-4.4 5.9-6.5 10-6.5s7.4 2.1 10 6.5c-2.6 4.4-5.9 6.5-10 6.5S4.6 16.4 2 12Z" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </g>
    ),
    regular: (
      <>
        <path d="M2 12c2.6-4.4 5.9-6.5 10-6.5s7.4 2.1 10 6.5c-2.6 4.4-5.9 6.5-10 6.5S4.6 16.4 2 12Z" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </>
    ),
  },
  pencil: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="m4 16-1 5 5-1L21 7a2.12 2.12 0 0 0-3-3L4 16Zm11.5-9.5 3 3M4 16l4 4" />
      </g>
    ),
    regular: (
      <path d="m4 16-1 5 5-1L21 7a2.12 2.12 0 0 0-3-3L4 16Zm11.5-9.5 3 3M4 16l4 4" />
    ),
  },
  "spoken-check": {
    compact: (
      <path d="M11 7.5c0-2.5-2.1-4-4.5-4S2 5.2 2 7.5c0 1.2.4 2.1 1.1 2.9L2 14l3.5-1.9c.3.1.7.1 1 .1 2.5 0 4.5-1.8 4.5-4.7ZM13.1 4.5l1.4-.75M13.5 7.5h1m-1.4 3 1.4.75" />
    ),
    regular: (
      <path d="M17 11.5C17 7.8 13.9 5 10 5S3 7.8 3 11.5c0 1.7.6 3.1 1.7 4.3L3 21l5-3c.7.1 1.3.2 2 .2 3.9 0 7-2.8 7-6.7ZM19 6l2-1M20 11h2m-3 5 2 1" />
    ),
  },
}

export type HaruIconName = keyof typeof iconArtwork

export type HaruIconOpticalSize = "auto" | "compact" | "regular"

export interface HaruIconProps
  extends Omit<
    SVGProps<SVGSVGElement>,
    "name" | "children" | "dangerouslySetInnerHTML"
  > {
  name: HaruIconName
  /** Display size in pixels; also selects the artwork when opticalSize is auto. */
  size?: number
  /** Auto uses the 16px artwork at sizes up to 16px, and the 24px artwork above. */
  opticalSize?: HaruIconOpticalSize
  /** Supplies an accessible name and the SVG's native tooltip. */
  title?: string
}

export function HaruIcon({
  name,
  size = 24,
  opticalSize = "auto",
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-hidden": ariaHidden,
  role,
  ...svgProps
}: HaruIconProps) {
  const compact =
    opticalSize === "compact" || (opticalSize === "auto" && size <= 16)
  const hasAccessibleName = Boolean(title || ariaLabel || ariaLabelledBy)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={compact ? "0 0 16 16" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={compact ? 1.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={role ?? (hasAccessibleName ? "img" : undefined)}
      aria-hidden={ariaHidden ?? !hasAccessibleName}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : title)}
      aria-labelledby={ariaLabelledBy}
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}
      {iconArtwork[name][compact ? "compact" : "regular"]}
    </svg>
  )
}
