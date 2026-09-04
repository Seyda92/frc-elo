"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Field, FormStatus, SubmitButton } from "@/components/form";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    changePassword,
    null,
  );

  return (
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <Field
        label="Aktuelles Passwort"
        name="old_password"
        type="password"
        required
        autoComplete="current-password"
      />
      <Field
        label="Neues Passwort"
        name="new_password"
        type="password"
        required
        autoComplete="new-password"
      />
      <Field
        label="Neues Passwort (Wiederholung)"
        name="new_password_confirm"
        type="password"
        required
        autoComplete="new-password"
      />
      <SubmitButton pending={pending}>Passwort ändern</SubmitButton>
    </form>
  );
}
