"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { loginAdmin, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAdmin, initialState);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-white shadow-2xl backdrop-blur-2xl">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-red-300">Login Admin</p>
        <h2 className="mt-2 text-2xl font-bold">Masuk ke Dashboard</h2>
        <p className="mt-2 text-sm text-gray-400">Gunakan email dan kata sandi admin yang terdaftar.</p>
      </div>

      <form action={formAction} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-200">Email</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@telkom.co.id"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-red-400"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-200">Kata Sandi</span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-red-400"
            />
          </span>
        </label>

        {state.error && (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-[0_0_24px_rgba(220,38,38,0.35)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Memeriksa..." : "Masuk"}
    </button>
  );
}
