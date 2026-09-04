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
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Benutzername"
          name="username"
          required
          placeholder="schiri1"
          autoComplete="off"
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
      </div>
      <SubmitButton pending={pending}>Schiri anlegen</SubmitButton>
    </form>
  );
}
