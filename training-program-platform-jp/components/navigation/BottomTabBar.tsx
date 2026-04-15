"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./BottomTabBar.module.css";

type Tab = {
  href: string;
  label: string;
  matchPrefixes: string[];
  icon: React.ReactNode;
};

function IconPrograms({ active }: { active: boolean }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <rect
        x="12"
        y="2"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <rect
        x="2"
        y="12"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <rect
        x="12"
        y="12"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
    </svg>
  );
}

function IconTrain({ active }: { active: boolean }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      {/* barbell */}
      <line
        x1="4"
        y1="11"
        x2="18"
        y2="11"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
      <rect
        x="1.5"
        y="8.5"
        width="3"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <rect
        x="17.5"
        y="8.5"
        width="3"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <rect
        x="4"
        y="9"
        width="2.5"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <rect
        x="15.5"
        y="9"
        width="2.5"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
    </svg>
  );
}

function IconHistory({ active }: { active: boolean }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="8.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <polyline
        points="11,6.5 11,11 14.5,13.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS: Tab[] = [
  {
    href: "/programs",
    label: "Programs",
    matchPrefixes: ["/programs"],
    icon: null // filled below
  },
  {
    href: "/train",
    label: "Train",
    matchPrefixes: ["/train"],
    icon: null
  },
  {
    href: "/session-history",
    label: "History",
    matchPrefixes: ["/session-history", "/workout-summary"],
    icon: null
  }
];

/** Paths where the tab bar should be hidden entirely. */
const HIDE_PREFIXES = ["/login"];

export function BottomTabBar() {
  const pathname = usePathname();

  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav className={styles.tabBar} aria-label="Main navigation">
      {TABS.map(({ href, label, matchPrefixes }) => {
        const active = matchPrefixes.some((p) => pathname.startsWith(p));
        const cls = `${styles.tab}${active ? ` ${styles.tabActive}` : ""}`;

        const iconProps = { active };
        const icon =
          label === "Programs" ? (
            <IconPrograms {...iconProps} />
          ) : label === "Train" ? (
            <IconTrain {...iconProps} />
          ) : (
            <IconHistory {...iconProps} />
          );

        return (
          <Link key={href} href={href} className={cls} aria-current={active ? "page" : undefined}>
            {icon}
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
