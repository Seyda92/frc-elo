"use client";

import { useActionState } from "react";
import { login } from "@/app/login/actions";
import { Field, FormStatus, SubmitButton } from "@/components/form";
import type { ActionResult } from "@/lib/action-result";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    login,
    null,
  );

  return (
    <form action={formAction} className="space-y-4 p-4 sm:p-5">
      <FormStatus state={state} />
      <Field
        label="Benutzername"
        name="username"
        required
        autoComplete="username"
      />
      <Field
        label="Passwort"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />
      <SubmitButton pending={pending} pendingLabel="Meldet an…">
        Anmelden
      </SubmitButton>
    </form>
  );
}
