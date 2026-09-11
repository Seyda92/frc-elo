"use client";

import { useActionState } from "react";
import { setPlayerActive, updatePlayer } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { PlayerEditDetail } from "@/db/queries";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";

export function EditPlayerForm({
  player,
  clubs,
}: {
  player: PlayerEditDetail;
  clubs: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updatePlayer,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-[11px]">
        <FormStatus state={state} />
        <input type="hidden" name="player_id" value={player.playerId} />
        <Field label="Name" name="display_name" required defaultValue={player.displayName} />
        <Field label="Alias" name="alias" defaultValue={player.alias ?? ""} />
        <SelectField
          label="Verein"
          name="club_id"
          required
          defaultValue={player.clubId != null ? String(player.clubId) : ""}
          options={clubs.map((club) => ({ value: club.id, label: club.name }))}
        />
        <Field
          label="Rückennummer"
          name="jersey_number"
          type="number"
          min={0}
          defaultValue={player.jerseyNumber != null ? String(player.jerseyNumber) : ""}
        />
        <SubmitButton pending={pending}>Änderungen speichern</SubmitButton>
        <p className="text-[11.5px] text-foam-muted">
          ELO wird nicht manuell editiert — sie ergibt sich aus den Spielen.
        </p>
      </form>

      <div className="border-t border-line pt-4">
        <ActiveToggleForm player={player} />
      </div>
    </div>
  );
}

function ActiveToggleForm({ player }: { player: PlayerEditDetail }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setPlayerActive,
    null,
  );
  const nextActive = player.isActive ? "0" : "1";

  return (
    <form action={formAction} className="flex flex-col gap-[6px]">
      <input type="hidden" name="player_id" value={player.playerId} />
      <input type="hidden" name="is_active" value={nextActive} />
      <span className="block text-[9.5px] uppercase tracking-[0.12em] text-foam-muted">
        Status
      </span>
      <span className="flex gap-[6px]">
        <span
          className={`flex min-h-[42px] flex-1 items-center justify-center text-[11px] uppercase tracking-[0.1em] ${
            player.isActive ? "bg-amber text-asphalt" : "border border-line text-foam-muted"
          }`}
        >
          Aktiv
        </span>
        <button
          type="submit"
          disabled={pending}
          className={`min-h-[42px] flex-1 text-[11px] uppercase tracking-[0.1em] transition disabled:opacity-50 ${
            !player.isActive
              ? "bg-amber text-asphalt"
              : "border border-line text-foam-muted hover:border-clay hover:text-clay"
          }`}
        >
          Inaktiv
        </button>
      </span>
      <p className="text-[11px] text-foam-muted">
        Inaktive Spieler bleiben in der Historie, verschwinden aber aus dem Pool.
      </p>
      {state && !state.ok && <span className="text-xs text-clay">{state.error}</span>}
    </form>
  );
}
