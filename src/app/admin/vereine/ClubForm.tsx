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
    <form action={formAction} className="mt-3 flex flex-col gap-[11px]">
      <FormStatus state={state} />
      <Field label="Name" name="name" required placeholder="1. FRC Musterstadt" />
      <Field label="Ort" name="city" placeholder="Musterstadt" />
      <SubmitButton pending={pending}>Verein anlegen</SubmitButton>
    </form>
  );
}
