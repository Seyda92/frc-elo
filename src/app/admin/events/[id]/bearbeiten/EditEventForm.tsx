"use client";

import { useActionState } from "react";
import { updateEvent } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { EventEditDetail } from "@/db/queries";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";

export function EditEventForm({
  event,
  clubs,
}: {
  event: EventEditDetail;
  clubs: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateEvent,
    null,
  );

  return (
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <input type="hidden" name="event_id" value={event.eventId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required defaultValue={event.name} />
        <SelectField
          label="Verein"
          name="club_id"
          required
          defaultValue={event.clubId != null ? String(event.clubId) : ""}
          options={clubs.map((club) => ({ value: club.id, label: club.name }))}
        />
        <Field label="Beginn" name="starts_on" type="date" defaultValue={event.startsOn ?? ""} />
        <Field label="Ende" name="ends_on" type="date" defaultValue={event.endsOn ?? ""} />
        <Field
          label="Ort"
          name="location"
          placeholder="optional, Standard: Vereinsort"
          defaultValue={event.location ?? ""}
        />
      </div>
      <SubmitButton pending={pending}>Speichern</SubmitButton>
    </form>
  );
}
