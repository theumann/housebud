import clsx from "clsx";
import React from "react";

// Icons for the app's sections and modules, in two forms:
// - ModuleIcon: a one-color line icon (currentColor) for the nav.
// - ModuleTile: a colored tile in the logo's style, for the landing page and
//   page headers. Roommates, calendar, chores and shopping are the logo's own
//   panels (drawn in its coordinates); the others are drawn to match.

export type ModuleIconName =
  | "household"
  | "roommates"
  | "shortlist"
  | "compatibility"
  | "chat"
  | "chores"
  | "shopping"
  | "expenses"
  | "rules"
  | "calendar";

const LINES: Record<ModuleIconName, React.ReactNode> = {
  household: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5.5 9v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" />
    </>
  ),
  roommates: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c.4-3.6 2.6-5.5 5.5-5.5s5.1 1.9 5.5 5.5" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M16.5 14c2.4 0 3.9 1.6 4.3 4.5" />
    </>
  ),
  shortlist: (
    <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  ),
  compatibility: (
    <>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </>
  ),
  chat: (
    <path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8.5L6 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" />
  ),
  chores: (
    <>
      <rect x="3" y="7" width="8" height="8" rx="2" />
      <path d="M5 11l1.8 1.8L9.5 9.5" />
      <path d="M14 8h7M14 12h7M14 16h4.5" />
    </>
  ),
  shopping: (
    <>
      <path d="M3 4.5h2.2l2.3 9.3a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.4-1l2-5.5H6.6" />
      <circle cx="9.5" cy="19" r="1.3" />
      <circle cx="17" cy="19" r="1.3" />
    </>
  ),
  expenses: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  rules: (
    <>
      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v5h5M8.5 12.5h7M8.5 16.5h4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
};

export function ModuleIcon({
  name,
  className,
}: {
  name: ModuleIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx("size-4 shrink-0", className)}
    >
      {LINES[name]}
    </svg>
  );
}

// Each drawing has its own viewBox; the tile centers it.
const TILES: Record<
  ModuleIconName,
  { bg: string; viewBox: string; drawing: React.ReactNode }
> = {
  household: {
    bg: "#D7EFE7",
    viewBox: "0 0 100 92",
    drawing: (
      <>
        <rect x="20" y="38" width="60" height="50" rx="8" fill="#36977B" />
        <rect x="42" y="58" width="16" height="30" rx="4" fill="#D7EFE7" />
        <path
          d="M8 46 L50 12 L92 46"
          fill="none"
          stroke="#27866E"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  roommates: {
    bg: "#FFF0C9",
    viewBox: "404 378 145 106",
    drawing: (
      <>
        <circle cx="447" cy="407" r="23" fill="#F9B233" />
        <path d="M410 478 Q412 437 447 437 Q482 437 484 478 Z" fill="#F9B233" />
        <circle cx="510" cy="414" r="21" fill="#58A991" />
        <path d="M477 478 Q480 444 510 444 Q540 444 543 478 Z" fill="#58A991" />
      </>
    ),
  },
  calendar: {
    bg: "#D9EDF7",
    viewBox: "640 367 130 114",
    drawing: (
      <>
        <rect x="646" y="390" width="118" height="85" rx="12" fill="#4D9BC7" />
        <path d="M646 412 H764" stroke="#D9EDF7" strokeWidth="9" />
        <path
          d="M671 379 V402 M739 379 V402"
          stroke="#4D9BC7"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <g fill="#A5D4E8">
          <rect x="663" y="425" width="18" height="15" rx="4" />
          <rect x="696" y="425" width="18" height="15" rx="4" />
          <rect x="729" y="425" width="18" height="15" rx="4" />
          <rect x="663" y="449" width="18" height="15" rx="4" />
          <rect x="696" y="449" width="18" height="15" rx="4" />
          <rect x="729" y="449" width="18" height="15" rx="4" fill="#2C83B3" />
        </g>
      </>
    ),
  },
  chores: {
    bg: "#DDEEDB",
    viewBox: "403 540 149 74",
    drawing: (
      <g strokeLinecap="round" strokeLinejoin="round">
        <rect x="409" y="550" width="52" height="52" rx="12" fill="#36977B" />
        <path
          d="M422 576 L434 588 L450 565"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="8"
        />
        <path
          d="M477 560 H541 M477 584 H541 M477 608 H528"
          stroke="#36977B"
          strokeWidth="10"
        />
      </g>
    ),
  },
  shopping: {
    bg: "#FFE0D4",
    viewBox: "615 541 189 120",
    drawing: (
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M626 552 H650 L668 615 Q671 624 682 624 H761 Q771 624 775 614 L793 571 H659"
          fill="#F06455"
          stroke="#F06455"
          strokeWidth="10"
        />
        <circle cx="682" cy="644" r="11" fill="#F06455" />
        <circle cx="760" cy="644" r="11" fill="#F06455" />
      </g>
    ),
  },
  chat: {
    bg: "#FBE3EF",
    viewBox: "0 0 100 86",
    drawing: (
      <>
        <path
          d="M20 6h60a14 14 0 0 1 14 14v32a14 14 0 0 1-14 14H44l-18 14v-14h-6A14 14 0 0 1 6 52V20A14 14 0 0 1 20 6z"
          fill="#D35C94"
        />
        <g fill="#FBE3EF">
          <circle cx="32" cy="36" r="6" />
          <circle cx="50" cy="36" r="6" />
          <circle cx="68" cy="36" r="6" />
        </g>
      </>
    ),
  },
  expenses: {
    bg: "#ECE6FA",
    viewBox: "0 0 100 72",
    drawing: (
      <>
        <rect x="4" y="8" width="92" height="56" rx="12" fill="#8A6FD1" />
        <circle cx="50" cy="36" r="13" fill="#ECE6FA" />
        <circle cx="20" cy="36" r="5" fill="#C9BBF0" />
        <circle cx="80" cy="36" r="5" fill="#C9BBF0" />
      </>
    ),
  },
  rules: {
    bg: "#E3E9F0",
    viewBox: "-6 0 92 100",
    drawing: (
      <>
        <path
          d="M14 4h36l22 22v58a12 12 0 0 1-12 12H14A12 12 0 0 1 2 84V16A12 12 0 0 1 14 4z"
          fill="#5B7590"
        />
        <path d="M50 4v14a8 8 0 0 0 8 8h14z" fill="#A9BCCF" />
        <path
          d="M16 46h40M16 62h40M16 78h24"
          stroke="#E3E9F0"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </>
    ),
  },
  shortlist: {
    bg: "#FFF0C9",
    viewBox: "0 0 100 100",
    drawing: (
      <path
        d="M50 10l12 24.4 27 3.9-19.5 19 4.6 26.8L50 71.4 25.9 84.1l4.6-26.8L11 38.3l27-3.9z"
        fill="#F9B233"
        stroke="#F9B233"
        strokeWidth="8"
        strokeLinejoin="round"
      />
    ),
  },
  compatibility: {
    bg: "#D9EDF7",
    viewBox: "0 0 120 80",
    drawing: (
      <>
        <circle cx="44" cy="40" r="32" fill="#A5D4E8" />
        <circle cx="76" cy="40" r="32" fill="#4D9BC7" fillOpacity="0.85" />
      </>
    ),
  },
};

export function ModuleTile({
  name,
  className,
}: {
  name: ModuleIconName;
  className?: string;
}) {
  const { bg, viewBox, drawing } = TILES[name];
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      data-testid={`module-tile-${name}`}
      className={clsx("size-10 shrink-0", className)}
    >
      <rect width="100" height="100" rx="24" fill={bg} />
      <svg x="17" y="17" width="66" height="66" viewBox={viewBox}>
        {drawing}
      </svg>
    </svg>
  );
}
