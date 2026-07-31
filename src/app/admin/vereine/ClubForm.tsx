"use client";

import { useActionState } from "react";
import { createClub } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/action-result";
import { Field, FormStatus, SubmitButton } from "@/components/form";

export function ClubForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createClub,
    null,
  );

  return (
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required placeholder="1. FRC Musterstadt" />
        <Field label="Ort" name="city" placeholder="Musterstadt" />
      </div>
      <SubmitButton pending={pending}>Verein anlegen</SubmitButton>
    </form>
  );
}
