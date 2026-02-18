"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function TopNav() {
  const pathname = usePathname();
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
      </nav>
    </header>
  );
}

