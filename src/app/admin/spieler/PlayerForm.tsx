"use client";

import { useActionState } from "react";
import { createPlayer } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";

export function PlayerForm({ clubs }: { clubs: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createPlayer,
    null,
  );

  if (clubs.length === 0) {
    return <p className="mt-3 text-sm text-foam-muted">Zuerst muss ein Verein angelegt werden.</p>;
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-[11px]">
      <FormStatus state={state} />
      <Field
        label="Name"
        name="display_name"
        required
        placeholder="Torben Reifen"
      />
      <SelectField
        label="Verein"
        name="club_id"
        required
        options={clubs.map((club) => ({ value: club.id, label: club.name }))}
      />
      <Field
        label="Rückennummer"
        name="jersey_number"
        type="number"
        min={0}
        hint="Frei lassen, wenn noch kein Trikot vergeben ist."
      />
      <SubmitButton pending={pending}>Spieler anlegen</SubmitButton>
    </form>
  );
}
