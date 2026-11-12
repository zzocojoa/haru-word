import type { SVGProps } from "react"

// The 16px and 24px artwork is copied from the delivered haru-icons-v1 SVGs.
// Keep both optical sizes aligned with the approved P001–P105 placement package.
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
  "checkbox-checked": {
    compact: (
      <>
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
        <path d="m4.5 8 2.5 2.5 4.5-5" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="m7.5 12 3 3 6-6" />
      </>
    ),
  },
  "image-card": {
    compact: (
      <>
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <circle cx="11.2" cy="6" r=".9" fill="currentColor" stroke="none" />
        <path d="m2 10.5 3.5-3.5L9 10.5l2-2 3 3" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
        <circle cx="16.5" cy="8.5" r="1.5" />
        <path d="m3 16 5-5 5.5 5.5 3-3 4.5 4.5" />
      </>
    ),
  },
  "card-flip": {
    compact: (
      <>
        <rect x="6" y="3" width="4" height="10" rx="1.2" />
        <path d="M1.5 10V8c0-1.8.9-3 2.7-3.5m-1.4-1.5 1.4 1.5-1.7 1.3M14.5 6v2c0 1.8-.9 3-2.7 3.5m1.4 1.5-1.4-1.5 1.7-1.3" />
      </>
    ),
    regular: (
      <>
        <rect x="8" y="4" width="8" height="16" rx="2" />
        <path d="M2 15v-2c0-2.4 1.4-4.2 3.5-5m-2-3 2 3-3 1.5M22 9v2c0 2.4-1.4 4.2-3.5 5m2 3-2-3 3-1.5" />
      </>
    ),
  },
  "arrow-left": {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="M20 12H4m6-6-6 6 6 6" />
      </g>
    ),
    regular: (
      <path d="M20 12H4m6-6-6 6 6 6" />
    ),
  },
  "card-grid": {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="4" width="7" height="6" rx="1.5" />
        <rect x="3" y="14" width="7" height="6" rx="1.5" />
        <rect x="14" y="14" width="7" height="6" rx="1.5" />
      </g>
    ),
    regular: (
      <>
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="4" width="7" height="6" rx="1.5" />
        <rect x="3" y="14" width="7" height="6" rx="1.5" />
        <rect x="14" y="14" width="7" height="6" rx="1.5" />
      </>
    ),
  },
  x: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <path d="m6 6 12 12M18 6 6 18" />
      </g>
    ),
    regular: (
      <path d="m6 6 12 12M18 6 6 18" />
    ),
  },
  search: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </g>
    ),
    regular: (
      <>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </>
    ),
  },
  "notebook-plus": {
    compact: (
      <>
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M5 2v12M7.5 8h4M9.5 6v4" />
      </>
    ),
    regular: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 3v18M11 12h6M14 9v6" />
      </>
    ),
  },
  "chevron-left": {
    compact: (
      <path d="m10 3-5 5 5 5" />
    ),
    regular: (
      <path d="m15 5-7 7 7 7" />
    ),
  },
  "chevron-right": {
    compact: (
      <path d="m6 3 5 5-5 5" />
    ),
    regular: (
      <path d="m9 5 7 7-7 7" />
    ),
  },
  "help-circle": {
    compact: (
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="M6.4 5.6a1.6 1.6 0 0 1 3.2 0c0 1.2-1.6 1.5-1.6 2.8" />
        <circle cx="8" cy="11" r=".75" fill="currentColor" stroke="none" />
      </>
    ),
    regular: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4" />
        <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  "search-empty": {
    compact: (
      <>
        <circle cx="7" cy="7" r="5" />
        <path d="m10.75 10.75 3.25 3.25M5.5 5.5l3 3M8.5 5.5l-3 3" />
      </>
    ),
    regular: (
      <>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5M8.25 8.25l4.5 4.5M12.75 8.25l-4.5 4.5" />
      </>
    ),
  },
  list: {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
        <path d="M8 6h13M8 12h13M8 18h13" />
      </g>
    ),
    regular: (
      <>
        <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
        <path d="M8 6h13M8 12h13M8 18h13" />
      </>
    ),
  },
  "check-circle": {
    compact: (
      <g transform="scale(0.6666666667)" strokeWidth="2.25">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5.5-5.5" />
      </g>
    ),
    regular: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5.5-5.5" />
      </>
    ),
  },
  "ai-feedback": {
    compact: (
      <>
        <path d="M14.5 7.5A6.5 6 0 0 1 8 13.5a7 7 0 0 1-2.5-.5l-4 1.5 1.1-3.7a5.5 5.5 0 0 1-1.1-3.3 6.5 6 0 0 1 13 0Z" />
        <path d="m8 4.5 1 2L11 7.5l-2 1-1 2-1-2-2-1 2-1Z" />
      </>
    ),
    regular: (
      <>
        <path d="M21 11a9 8 0 0 1-9 8 10 10 0 0 1-3.7-.7L3 21l1.5-5A7.4 7.4 0 0 1 3 11a9 8 0 0 1 18 0Z" />
        <path d="m12 6 1.6 3.4L17 11l-3.4 1.6L12 16l-1.6-3.4L7 11l3.4-1.6Z" />
      </>
    ),
  },
  "calendar-repeat": {
    compact: (
      <>
        <rect x="1.75" y="3" width="12.5" height="11.25" rx="1.25" />
        <path d="M5 1.75v2.5M11 1.75v2.5M5.5 8.5h3a2 2 0 0 1 0 4h-1M6.75 7.25 5.5 8.5l1.25 1.25" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2.5V7M17 2.5V7M3 9h18M8.5 13.5h4a2.25 2.25 0 0 1 0 4.5H11M10.5 11.5l-2 2 2 2" />
      </>
    ),
  },
  "calendar-pencil": {
    compact: (
      <>
        <rect x="1.75" y="3" width="12.5" height="11.25" rx="1.25" />
        <path d="M5 1.75v2.5M11 1.75v2.5M5.5 12.5l.5-2.4 4-4a1.1 1.1 0 0 1 1.6 1.6l-4 4-2.1.8Z" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2.5V7M17 2.5V7M3 9h18m-12 9.5.6-2.8 4-4a1.6 1.6 0 0 1 2.3 2.3l-4 4-2.9.5Zm3.4-5.6 2.3 2.3" />
      </>
    ),
  },
  "record-empty": {
    compact: (
      <>
        <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6Z" />
        <path d="M9 1.5V5a1 1 0 0 0 1 1h3.5M6 10h4" />
      </>
    ),
    regular: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4M9 14h6" />
      </>
    ),
  },
  "more-horizontal": {
    compact: (
      <g fill="currentColor" stroke="none">
        <circle cx="3" cy="8" r="1.25" />
        <circle cx="8" cy="8" r="1.25" />
        <circle cx="13" cy="8" r="1.25" />
      </g>
    ),
    regular: (
      <g fill="currentColor" stroke="none">
        <circle cx="5" cy="12" r="1.75" />
        <circle cx="12" cy="12" r="1.75" />
        <circle cx="19" cy="12" r="1.75" />
      </g>
    ),
  },
  download: {
    compact: (
      <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 10.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
    ),
    regular: (
      <path d="M12 3v12M7 10l5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    ),
  },
  "backup-archive": {
    compact: (
      <>
        <path d="M4 9V3a1.5 1.5 0 0 1 1.5-1.5H9L12 4.5V9M9 1.5v3h3" />
        <path d="M2.5 9h11a1 1 0 0 1 1 1v3A1.5 1.5 0 0 1 13 14.5H3A1.5 1.5 0 0 1 1.5 13v-3a1 1 0 0 1 1-1ZM1.5 11.5h13" />
      </>
    ),
    regular: (
      <>
        <path d="M6 14V4a2 2 0 0 1 2-2h6l4 4v8M14 2v4h4" />
        <path d="M4 14h16a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a1 1 0 0 1 1-1ZM3 17h18" />
      </>
    ),
  },
  "restore-file": {
    compact: (
      <>
        <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6Z" />
        <path d="M9 1.5V5a1 1 0 0 0 1 1h3.5M5.5 7.5V10H8" />
        <path d="M5.5 10A2.5 2.5 0 1 1 6.5 12" />
      </>
    ),
    regular: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4M8 11.5V15h3.5" />
        <path d="M8 15a4 4 0 1 1 1.6 3.2" />
      </>
    ),
  },
  "tutor-export": {
    compact: (
      <path d="M11.5 5.5v-1L8.5 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h6A1.5 1.5 0 0 0 11.5 13v-1M8.5 1.5v3h3M8 9h6.5M12 6.5 14.5 9 12 11.5" />
    ),
    regular: (
      <path d="M18 8V6l-4-4H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2M14 2v4h4M12 13h10M18 9l4 4-4 4" />
    ),
  },
  volume: {
    compact: (
      <path d="M7 2.5 3.5 5.5H1.5v5h2L7 13.5ZM10 5a4.25 4.25 0 0 1 0 6M12 2.5a7.75 7.75 0 0 1 0 11" />
    ),
    regular: (
      <path d="M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16" />
    ),
  },
  "external-link": {
    compact: (
      <path d="M6.5 2.5H3A1.5 1.5 0 0 0 1.5 4v9A1.5 1.5 0 0 0 3 14.5h9a1.5 1.5 0 0 0 1.5-1.5V9.5M9.5 1.5h5v5M14.5 1.5 7 9" />
    ),
    regular: (
      <path d="M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5M14 3h7v7M21 3 10 14" />
    ),
  },
  play: {
    compact: (
      <path d="M4.75 2.25a.75.75 0 0 0-1.13.65v10.2a.75.75 0 0 0 1.13.65l8.5-5.1a.75.75 0 0 0 0-1.3Z" />
    ),
    regular: (
      <path d="M7 3.5a1 1 0 0 0-1.5.87v15.26A1 1 0 0 0 7 20.5l13-7.63a1 1 0 0 0 0-1.74Z" />
    ),
  },
  pause: {
    compact: (
      <path d="M5 2.5v11M11 2.5v11" />
    ),
    regular: (
      <path d="M8 4v16M16 4v16" />
    ),
  },
  "learning-level": {
    compact: (
      <>
        <rect x="1.5" y="10" width="3" height="4.5" rx=".75" />
        <rect x="6.5" y="6.5" width="3" height="8" rx=".75" />
        <rect x="11.5" y="1.5" width="3" height="13" rx=".75" />
      </>
    ),
    regular: (
      <>
        <rect x="3" y="14" width="4" height="7" rx="1.25" />
        <rect x="10" y="9" width="4" height="12" rx="1.25" />
        <rect x="17" y="3" width="4" height="18" rx="1.25" />
      </>
    ),
  },
  target: {
    compact: (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <circle cx="8" cy="8" r="3" />
        <circle cx="8" cy="8" r=".8" fill="currentColor" stroke="none" />
      </>
    ),
    regular: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      </>
    ),
  },
  "ai-model": {
    compact: (
      <>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1.75" />
        <rect x="6.5" y="6.5" width="3" height="3" rx=".5" />
        <path d="M6 1.5v2M10 1.5v2M6 12.5v2M10 12.5v2M1.5 6h2M1.5 10h2M12.5 6h2M12.5 10h2" />
      </>
    ),
    regular: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
      </>
    ),
  },
  trash: {
    compact: (
      <path d="M2 4.5h12M6 4.5v-2h4v2M3.5 4.5 4.25 13a1.5 1.5 0 0 0 1.5 1.5h4.5a1.5 1.5 0 0 0 1.5-1.5l.75-8.5M6.5 7.5v4M9.5 7.5v4" />
    ),
    regular: (
      <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14M10 10v8M14 10v8" />
    ),
  },
  "log-out": {
    compact: (
      <path d="M6.5 1.5H3A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h3.5M6 8h8.5M11.5 5l3 3-3 3" />
    ),
    regular: (
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M9 12h13M18 8l4 4-4 4" />
    ),
  },
  "draft-check": {
    compact: (
      <>
        <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l2 2h5A1.5 1.5 0 0 1 14.5 6v7A1.5 1.5 0 0 1 13 14.5H3A1.5 1.5 0 0 1 1.5 13Z" />
        <path d="m5 9.5 2 2 3.5-4" />
      </>
    ),
    regular: (
      <>
        <path d="M3 6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="m8 14 3 3 5-6" />
      </>
    ),
  },
  undo: {
    compact: (
      <path d="M5 2 1.5 5.5 5 9M1.5 5.5H9a5.5 5.5 0 0 1 5.5 5.5v3" />
    ),
    regular: (
      <path d="M8 3 3 8l5 5M3 8h10a8 8 0 0 1 8 8v4" />
    ),
  },
  "source-document": {
    compact: (
      <>
        <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6Z" />
        <path d="M9 1.5V6h4.5" />
        <path d="M5 9h6M5 12h6" />
      </>
    ),
    regular: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M8 13h8M8 17h8" />
      </>
    ),
  },
  dictionary: {
    compact: (
      <>
        <rect x="2.5" y="1.5" width="10" height="13" rx="1.5" />
        <path d="M5 1.5v13M12.5 4h2v2.5h-2M12.5 9h2v2.5h-2" />
      </>
    ),
    regular: (
      <>
        <rect x="4" y="3" width="14" height="18" rx="2" />
        <path d="M7 3v18M18 6h3v4h-3M18 14h3v4h-3" />
      </>
    ),
  },
  "pronunciation-document": {
    compact: (
      <>
        <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
        <path d="M5 7h1.25L8.5 5.5v5L6.25 9H5Z" />
        <path d="M10.75 6.25a3 3 0 0 1 0 3.5" />
      </>
    ),
    regular: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M7 13h3l3-2v8l-3-2H7Z" />
        <path d="M16 12a5 5 0 0 1 0 6" />
      </>
    ),
  },
  copyright: {
    compact: (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M10 5.5a3.2 3.2 0 1 0 0 5" />
      </>
    ),
    regular: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8.5a4.5 4.5 0 1 0 0 7" />
      </>
    ),
  },
  "chevron-down": {
    compact: (
      <path d="m3 6 5 5 5-5" />
    ),
    regular: (
      <path d="m5 9 7 7 7-7" />
    ),
  },
  "checkbox-empty": {
    compact: (
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
    ),
    regular: (
      <rect x="3" y="3" width="18" height="18" rx="3" />
    ),
  },
  "brand-app": {
    compact: (
      <>
        <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
        <path d="M4 8.5Q6 7.5 8 8.5Q10 7.5 12 8.5v4Q10 11.5 8 12.5Q6 11.5 4 12.5Z" />
        <path d="M8 8.5v4M6 6a2 2 0 0 1 4 0" />
      </>
    ),
    regular: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <path d="M6 11Q9 10 12 11Q15 10 18 11v7.5Q15 17.5 12 18.5Q9 17.5 6 18.5Z" />
        <path d="M12 11v7.5M9.5 7.5a2.5 2.5 0 0 1 5 0" />
      </>
    ),
  },
  "chevron-up": {
    compact: (
      <path d="m3 10 5-5 5 5" />
    ),
    regular: (
      <path d="m5 15 7-7 7 7" />
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
  style,
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
      style={{ flexShrink: 0, ...style }}
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}
      {iconArtwork[name][compact ? "compact" : "regular"]}
    </svg>
  )
}
