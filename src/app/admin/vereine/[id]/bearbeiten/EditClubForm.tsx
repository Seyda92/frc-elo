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
    <form action={formAction} className="flex flex-col gap-[11px]">
      <FormStatus state={state} />
      <input type="hidden" name="club_id" value={club.clubId} />
      <Field label="Name" name="name" required defaultValue={club.name} />
      <Field label="Ort" name="city" defaultValue={club.city ?? ""} />
      <SubmitButton pending={pending}>Speichern</SubmitButton>
    </form>
  );
}
