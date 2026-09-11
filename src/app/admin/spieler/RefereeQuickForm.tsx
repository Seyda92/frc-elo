"use client";

import { useActionState, useState } from "react";
import { createRefereeFromPlayer } from "@/app/admin/actions";
import { Field, FormStatus, SubmitButton } from "@/components/form";
import type { ActionResult } from "@/lib/action-result";

/** Kurzweg von der Spielerliste aus: "Zu Schiri machen" klappt ein Mini-
 *  Formular auf statt zum Schiri-Bereich zu verlinken — Owner muss nur
 *  Benutzername + Passwort eingeben, player_id steht schon fest. */
export function RefereeQuickForm({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createRefereeFromPlayer,
    null,
  );

  if (state?.ok) {
    // Erfolgsmeldung bleibt stehen, statt das Formular wieder einzuklappen —
    // die Zeile verschwindet ohnehin gleich (revalidatePath aendert
    // linkedPlayerIds), aber bis dahin soll die Bestaetigung sichtbar sein.
    return (
      <p className="max-w-xs border border-amber bg-amber/10 px-3 py-2 text-xs text-foam">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] uppercase tracking-[0.1em] text-foam-muted transition hover:text-amber"
      >
        Zu Schiri machen
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-2 border border-amber bg-asphalt/60 p-3 sm:w-auto sm:min-w-[20rem]"
    >
      <input type="hidden" name="player_id" value={playerId} />
      <p className="text-xs uppercase tracking-[0.14em] text-amber">
        Schiri-Konto für {playerName}
      </p>
      <FormStatus state={state} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          label="Benutzername"
          name="username"
          required
          placeholder="schiri1"
          autoComplete="off"
        />
        <Field
          label="Passwort"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
        <Field
          label="Passwort (Wiederholung)"
          name="password_confirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton pending={pending}>Anlegen</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-10 border border-line px-3 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
