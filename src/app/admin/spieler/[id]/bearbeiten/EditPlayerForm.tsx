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
    <div className="space-y-6 p-4 sm:p-5">
      <form action={formAction} className="space-y-4">
        <FormStatus state={state} />
        <input type="hidden" name="player_id" value={player.playerId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            name="display_name"
            required
            defaultValue={player.displayName}
          />
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
        </div>
        <SubmitButton pending={pending}>Speichern</SubmitButton>
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
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="player_id" value={player.playerId} />
      <input type="hidden" name="is_active" value={nextActive} />
      <button
        type="submit"
        disabled={pending}
        className={`min-h-10 border px-3 text-xs uppercase tracking-[0.14em] transition disabled:opacity-50 ${
          player.isActive
            ? "border-line text-foam-muted hover:border-clay hover:text-clay"
            : "border-line text-foam-muted hover:border-moss hover:text-moss"
        }`}
      >
        {player.isActive ? "Deaktivieren" : "Aktivieren"}
      </button>
      <span className="text-xs uppercase tracking-[0.14em] text-foam-muted">
        Status: {player.isActive ? "aktiv" : "deaktiviert"}
      </span>
      {state && !state.ok && <span className="text-xs text-clay">{state.error}</span>}
    </form>
  );
}
