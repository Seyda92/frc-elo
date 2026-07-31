"use client";

import { useActionState } from "react";
import { createEvent, type ActionResult } from "@/app/admin/actions";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";

export function EventForm({ clubs }: { clubs: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createEvent,
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required placeholder="Sommer-Open Air" />
        <SelectField
          label="Verein"
          name="club_id"
          required
          options={clubs.map((club) => ({ value: club.id, label: club.name }))}
        />
        <Field label="Beginn" name="starts_on" type="date" />
        <Field label="Ende" name="ends_on" type="date" />
      </div>
      <SubmitButton pending={pending}>Event anlegen</SubmitButton>
    </form>
  );
}
