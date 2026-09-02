"use client";

import { useActionState } from "react";
import { setRefereeActive, setRefereeRole } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { AppUser } from "@/db/queries";

const ROLE_LABELS: Record<string, string> = {
  owner: "Hauptverantwortlicher",
  admin: "Schiri",
  user: "Nutzer",
};

export function RefereeList({ users, ownUserId }: { users: AppUser[]; ownUserId: number }) {
  return (
    <ul className="divide-y divide-line">
      {users.map((user) => (
        <RefereeRow key={user.userId} user={user} isSelf={user.userId === ownUserId} />
      ))}
    </ul>
  );
}

function RefereeRow({ user, isSelf }: { user: AppUser; isSelf: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <div>
        <p className="font-display text-lg text-foam">
          {user.username}
          {isSelf && <span className="ml-2 text-xs text-foam-muted">(du)</span>}
        </p>
        <p className="text-xs uppercase tracking-[0.14em] text-foam-muted">
          {ROLE_LABELS[user.role] ?? user.role}
          {!user.isActive && <span className="ml-2 text-clay">· deaktiviert</span>}
        </p>
      </div>

      {user.role !== "owner" && !isSelf && (
        <div className="flex flex-wrap items-center gap-2">
          <RoleToggleForm user={user} />
          <ActiveToggleForm user={user} />
        </div>
      )}
    </li>
  );
}

function RoleToggleForm({ user }: { user: AppUser }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setRefereeRole,
    null,
  );
  const nextRole = user.role === "admin" ? "user" : "admin";

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={user.userId} />
      <input type="hidden" name="role" value={nextRole} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 border border-line px-3 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber disabled:opacity-50"
      >
        {user.role === "admin" ? "Zu Nutzer machen" : "Zu Schiri machen"}
      </button>
      {state && !state.ok && <span className="text-xs text-clay">{state.error}</span>}
    </form>
  );
}

function ActiveToggleForm({ user }: { user: AppUser }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setRefereeActive,
    null,
  );
  const nextActive = user.isActive ? "0" : "1";

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={user.userId} />
      <input type="hidden" name="is_active" value={nextActive} />
      <button
        type="submit"
        disabled={pending}
        className={`min-h-10 border px-3 text-xs uppercase tracking-[0.14em] transition disabled:opacity-50 ${
          user.isActive
            ? "border-line text-foam-muted hover:border-clay hover:text-clay"
            : "border-line text-foam-muted hover:border-moss hover:text-moss"
        }`}
      >
        {user.isActive ? "Deaktivieren" : "Aktivieren"}
      </button>
      {state && !state.ok && <span className="text-xs text-clay">{state.error}</span>}
    </form>
  );
}
