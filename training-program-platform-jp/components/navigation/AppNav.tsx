"use client";

import { usePathname } from "next/navigation";

import { BottomTabBar } from "./BottomTabBar";

/** Paths where the bottom tab bar (and its scroll spacer) are hidden. */
const HIDE_PREFIXES = ["/login"];

/**
 * Client wrapper that renders the persistent bottom tab bar plus a scroll
 * spacer so that page content is never obscured by the fixed bar.
 *
 * Import this from the root layout (Server Component) so it only mounts once.
 */
export function AppNav() {
  const pathname = usePathname();
  const show = !HIDE_PREFIXES.some((p) => pathname.startsWith(p));

  if (!show) return null;

  return (
    <>
      {/* scroll buffer — keeps content above the fixed tab bar */}
      <div style={{ height: 64 }} aria-hidden="true" />
      <BottomTabBar />
    </>
  );
}
