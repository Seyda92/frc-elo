"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";

export function EventForm({ clubs }: { clubs: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createEvent,
    null,
  );

  if (clubs.length === 0) {
    return <p className="mt-3 text-sm text-foam-muted">Zuerst muss ein Verein angelegt werden.</p>;
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-[11px]">
      <FormStatus state={state} />
      <Field label="Name" name="name" required placeholder="Sommer-Open Air" />
      <SelectField
        label="Verein"
        name="club_id"
        required
        options={clubs.map((club) => ({ value: club.id, label: club.name }))}
      />
      <Field label="Beginn" name="starts_on" type="date" />
      <Field label="Ende" name="ends_on" type="date" />
      <Field label="Ort" name="location" placeholder="optional, Standard: Vereinsort" />
      <SubmitButton pending={pending}>Event anlegen</SubmitButton>
      <p className="text-[11.5px] text-foam-muted">Spiele lassen sich direkt danach anlegen.</p>
    </form>
  );
}
