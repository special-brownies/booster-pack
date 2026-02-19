"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import { useAppController } from "@/lib/hooks/use-app-controller";
import { useAppState } from "@/lib/state/app-state";

export function TopNav() {
  const pathname = usePathname();
  const { state } = useAppState();
  const { resetProgressFlow } = useAppController();
  const [isResetting, setIsResetting] = useState(false);

  const onReset = async () => {
    const confirmed = window.confirm(
      "Reset progress? This will clear binder records and lock sets back to Base Set 2."
    );
    if (!confirmed) return;
    setIsResetting(true);
    try {
      await resetProgressFlow();
    } catch {
      window.alert("Reset failed. Please retry.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="top-nav">
      <div className="top-nav__brand">
        <span className="brand-pill">PTCG</span>
        <h1>Booster Lab</h1>
      </div>
      <nav aria-label="Main navigation" className="top-nav__links">
        <Link className={clsx("nav-link", pathname === "/" && "nav-link--active")} href="/">
          Open Packs
        </Link>
        <Link
          className={clsx("nav-link", pathname?.startsWith("/binder") && "nav-link--active")}
          href="/binder"
        >
          Binder
        </Link>
        <button
          className="nav-link nav-link--danger"
          onClick={onReset}
          disabled={
            isResetting || state.ui.isHydrating || state.ui.isOpeningPack || state.ui.isUpdatingBinder
          }
          type="button"
        >
          {isResetting ? "Resetting..." : "Reset Progress"}
        </button>
      </nav>
    </header>
  );
}
