"use client";

import { useActionState } from "react";
import { createReferee } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";

const ROLE_OPTIONS = [
  { value: "admin", label: "Schiri (admin)" },
  { value: "user", label: "Nutzer" },
];

export function RefereeForm({
  players,
}: {
  players: { id: string; name: string; number: number | null }[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createReferee,
    null,
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-[11px]">
      <FormStatus state={state} />
      <Field
        label="Benutzername"
        name="username"
        required
        placeholder="schiri1"
        autoComplete="off"
        hint="Wird beim ersten Login geändert."
      />
      <SelectField label="Rolle" name="role" required options={ROLE_OPTIONS} />
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
      <SelectField
        label="Zugehöriger Spieler"
        name="player_id"
        options={players.map((p) => ({
          value: p.id,
          label: p.number != null ? `#${p.number} · ${p.name}` : p.name,
        }))}
      />
      <SubmitButton pending={pending}>Zugang erstellen</SubmitButton>
      <p className="text-[11.5px] text-foam-muted">
        Der neue Zugang erscheint sofort in der Liste — mit Hinweis, dass das Passwort noch
        geändert werden muss.
      </p>
    </form>
  );
}
