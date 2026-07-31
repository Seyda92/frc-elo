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
    return (
      <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
        Zuerst muss ein Verein angelegt werden.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" name="display_name" required placeholder="Torben Reifen" />
        <SelectField
          label="Verein"
          name="club_id"
          required
          options={clubs.map((club) => ({ value: club.id, label: club.name }))}
        />
        <Field label="Rückennummer" name="jersey_number" type="number" min={0} />
      </div>
      <SubmitButton pending={pending}>Spieler anlegen</SubmitButton>
    </form>
  );
}
