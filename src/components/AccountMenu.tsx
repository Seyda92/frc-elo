"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import type { Role } from "@/lib/session";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Schiri",
  user: "Mitglied",
};

type User = { username: string; role: Role };

/** Konto-Menü: Username/Rolle, Schiri-Bereich (nur admin/owner), Passwort
 *  ändern, Logout. Schließt per Escape (Fokus geht zurück auf den
 *  auslösenden Button) oder per mousedown außerhalb — onBlur würde einen
 *  Klick auf einen Menü-Link verhindern, da Blur vor Click feuert. Pfeil-
 *  tasten navigieren zyklisch zwischen den Menü-Einträgen. */
export function AccountMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<HTMLElement[]>([]);
  itemRefs.current = [];

  function registerItem(el: HTMLElement | null) {
    if (el) itemRefs.current.push(el);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      const items = itemRefs.current;
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    itemRefs.current[0]?.focus();
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isStaff = user.role === "admin" || user.role === "owner";
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Konto"
        className="flex h-[38px] w-[38px] items-center justify-center border border-line bg-rubber font-display text-xs text-foam transition hover:border-amber hover:text-amber"
      >
        {initials}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-line bg-asphalt-raised shadow-lg">
          <p className="px-[14px] pb-1 pt-[10px] text-[10px] uppercase tracking-[0.16em] text-amber">
            {user.username} · {ROLE_LABELS[user.role]}
          </p>
          <div className="flex flex-col">
            {isStaff && (
              <Link
                ref={registerItem}
                href="/admin"
                onClick={() => close(false)}
                className="min-h-11 border-t border-line px-[14px] py-0 text-left text-sm leading-[44px] text-foam transition hover:text-amber"
              >
                Schiri-Bereich
              </Link>
            )}
            <Link
              ref={registerItem}
              href="/passwort-aendern"
              onClick={() => close(false)}
              className="min-h-11 border-t border-line px-[14px] py-0 text-left text-sm leading-[44px] text-foam transition hover:text-amber"
            >
              Passwort ändern
            </Link>
            <form action={logout}>
              <button
                ref={registerItem}
                type="submit"
                className="min-h-11 w-full border-t border-line px-[14px] py-0 text-left text-sm leading-[44px] text-foam-muted transition hover:text-amber"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
