"use client";

import { useActionState } from "react";
import { updateClub } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import type { ClubEditDetail } from "@/db/queries";
import { Field, FormStatus, SubmitButton } from "@/components/form";

export function EditClubForm({ club }: { club: ClubEditDetail }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateClub,
    null,
  );

  return (
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <input type="hidden" name="club_id" value={club.clubId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required defaultValue={club.name} />
        <Field label="Ort" name="city" defaultValue={club.city ?? ""} />
      </div>
      <SubmitButton pending={pending}>Speichern</SubmitButton>
    </form>
  );
}
