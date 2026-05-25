"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Mail, Lock, LogIn, Building } from "lucide-react";
import { loginAdmin, type LoginState } from "@/app/actions/auth";
import { useState } from "react";
import Image from "next/image";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAdmin, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans text-gray-900 selection:bg-red-100 selection:text-red-900 relative overflow-hidden">
      {/* Mesh Background */}
      <div
        className="fixed inset-0 opacity-30"
        style={{
          backgroundColor: '#fff8f7',
          backgroundImage: `
            radial-gradient(at 0% 0%, rgba(225, 38, 28, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 0%, rgba(0, 94, 159, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(225, 38, 28, 0.05) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(0, 94, 159, 0.05) 0px, transparent 50%),
            linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 40px 40px, 40px 40px'
        }}
      />

      {/* Decorative Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-red-500/5 rounded-full blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] bg-blue-500/5 rounded-full blur-[100px] -z-10" />

      {/* Main Container */}
      <main className="w-full max-w-[480px] flex flex-col gap-8 items-center relative z-10">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="">
            <Image src="/logo-telkom2.png" alt="Telkom" width={100} height={100} className="object-contain" />
          </div>
         
        </div>

        {/* Glassmorphism Card */}
        <div className="w-full bg-white/80 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-red-100/30">
          {/* Header */}
          <header className="flex flex-col gap-2 mb-8">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Masuk Admin</span>
            <p className="text-sm text-gray-600">Gunakan email dan kata sandi admin yang terdaftar</p>
          </header>

          {/* Login Form */}
          <form action={formAction} className="flex flex-col gap-6">
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600 px-1 font-medium" htmlFor="email">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@telkom.co.id"
                  className="w-full bg-gray-50/50 border-2 border-gray-200/20 focus:border-red-200 rounded-xl py-4 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600 px-1 font-medium" htmlFor="password">Kata Sandi</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-gray-50/50 border-2 border-gray-200/20 focus:border-red-200 rounded-xl py-4 pl-12 pr-12 text-sm text-gray-900 placeholder:text-gray-400 transition-all outline-none focus:ring-2 focus:ring-red-100"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>


            {/* Error Message */}
            {state.error && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                <p className="text-sm font-semibold text-yellow-800">{state.error}</p>
              </div>
            )}

            {/* Submit Button */}
            <SubmitButton />
          </form>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <a className="hover:text-red-600 transition-colors" href="#">Syarat &amp; Ketentuan</a>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <a className="hover:text-red-600 transition-colors" href="#">Kebijakan Privasi</a>
          </div>
          <p className="text-xs text-gray-300 tracking-widest mt-2">V.2.0.4 • TELKOM INDONESIA</p>
        </footer>
      </main>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-red-600 text-white py-4 px-6 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      <span>{pending ? "Memeriksa..." : "Masuk"}</span>
      <LogIn className="w-4 h-4" />
    </button>
  );
}