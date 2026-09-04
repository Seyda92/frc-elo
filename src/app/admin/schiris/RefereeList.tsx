"use client";

import { useActionState } from "react";
import {
  resetRefereePassword,
  setRefereeActive,
  setRefereePlayer,
  setRefereeRole,
} from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { AppUser } from "@/db/queries";

const ROLE_LABELS: Record<string, string> = {
  owner: "Hauptverantwortlicher",
  admin: "Schiri",
  user: "Nutzer",
};

type PlayerOption = { id: string; name: string; number: number | null };

export function RefereeList({
  users,
  ownUserId,
  players,
}: {
  users: AppUser[];
  ownUserId: number;
  players: PlayerOption[];
}) {
  return (
    <ul className="divide-y divide-line">
      {users.map((user) => (
        <RefereeRow
          key={user.userId}
          user={user}
          isSelf={user.userId === ownUserId}
          players={players}
        />
      ))}
    </ul>
  );
}

function RefereeRow({
  user,
  isSelf,
  players,
}: {
  user: AppUser;
  isSelf: boolean;
  players: PlayerOption[];
}) {
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
          {user.playerName && <span className="ml-2 text-amber">· {user.playerName}</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user.role !== "owner" && !isSelf && (
          <>
            <RoleToggleForm user={user} />
            <ActiveToggleForm user={user} />
          </>
        )}
        <PlayerLinkForm user={user} players={players} />
        <PasswordResetForm user={user} />
      </div>
    </li>
  );
}

function PlayerLinkForm({ user, players }: { user: AppUser; players: PlayerOption[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setRefereePlayer,
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={user.userId} />
      <select
        name="player_id"
        defaultValue={user.playerId != null ? String(user.playerId) : ""}
        className="min-h-10 border border-line bg-asphalt/60 px-2 text-xs text-foam outline-none transition focus:border-amber"
      >
        <option value="">– kein Spieler –</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.number != null ? `#${p.number} · ` : ""}
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 border border-line px-3 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber disabled:opacity-50"
      >
        Verknüpfen
      </button>
      {state && !state.ok && <span className="text-xs text-clay">{state.error}</span>}
    </form>
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

/** Notfall-Passwort-Reset: erzeugt ein neues Passwort und zeigt es einmalig
 *  im Klartext an (state.message der Server Action) — der Owner muss es
 *  ablesen/weitergeben können, eine schmale Statuszeile reicht dafür nicht,
 *  deshalb eine eigene, größere Anzeige statt FormStatus. */
function PasswordResetForm({ user }: { user: AppUser }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    resetRefereePassword,
    null,
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="user_id" value={user.userId} />
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 border border-line px-3 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber disabled:opacity-50"
        >
          {pending ? "Setzt zurück…" : "Passwort zurücksetzen"}
        </button>
      </form>
      {state && !state.ok && <span className="text-xs text-clay">{state.error}</span>}
      {state && state.ok && (
        <p className="max-w-xs border border-amber bg-amber/10 px-3 py-2 text-xs text-foam">
          {state.message}
          <br />
          <span className="text-foam-muted">
            Jetzt notieren — wird nirgends erneut angezeigt.
          </span>
        </p>
      )}
    </div>
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
