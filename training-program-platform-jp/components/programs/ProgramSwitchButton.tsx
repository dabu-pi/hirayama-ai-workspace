"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

type Props = {
  href: string;
  currentProgramTitle: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Program switch CTA that shows a confirmation dialog before navigating.
 * Used when the user is enrolled in a different program and tries to start a new one.
 * Switching pauses the current enrollment and creates a new active one.
 */
export function ProgramSwitchButton({ href, currentProgramTitle, className, children }: Props) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    const ok = window.confirm(
      `現在「${currentProgramTitle}」を進行中です。\n` +
      `別のプログラムに切り替えると、現在の進行は一時停止されます。\n\n` +
      `新しいプログラムに切り替えますか？`
    );
    if (!ok) e.preventDefault();
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children ?? "このプログラムへ切り替える"}
    </Link>
  );
}
