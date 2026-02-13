"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type MenuItem = {
  label: string;
  title?: string;
  href?: string;
  onClick?: () => void;
};

type AdminMoreMenuProps = {
  items: MenuItem[];
  pillClass: string;
};

export default function AdminMoreMenu({ items, pillClass }: AdminMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={pillClass}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
      >
        More ▾
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur">
          {items.map((it, idx) => {
            const key = it.href ? `href:${it.href}` : `btn:${it.label}:${idx}`;

            if (it.onClick) {
              return (
                <button
                  key={key}
                  type="button"
                  title={it.title || it.label}
                  onClick={() => {
                    setOpen(false);
                    it.onClick?.();
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {it.label}
                </button>
              );
            }

            return (
              <Link
                key={key}
                href={it.href || "#"}
                title={it.title || it.label}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
