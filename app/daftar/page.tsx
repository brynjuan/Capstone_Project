// app/daftar/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { registerMobileVisitorAction } from "../actions/kiosk";

export default function MobileRegistration() {
  const [step, setStep] = useState(1);
  const [pinResult, setPinResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const result = await registerMobileVisitorAction(data);
    if (result.success && result.pin) {
      setPinResult(result.pin);
      setStep(3); // Langsung ke layar PIN
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden min-h-[90vh] flex flex-col relative">
        {/* Header Mobile */}
        <div className="bg-red-600 p-6 text-white text-center rounded-b-[2rem] shadow-md z-10 relative">
          <h1 className="text-2xl font-bold">Prapendaftaran Tamu</h1>
          <p className="text-red-100 text-sm mt-1">Telkom Witel Sulbagteng</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-6 flex-1 flex flex-col justify-center">
              <h2 className="text-xl font-bold mb-4">Informasi Pribadi</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 mb-1">Nama Lengkap</label>
                  <input {...register("fullName", { required: true })} className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 mb-1">Instansi / Perusahaan</label>
                  <input {...register("institution")} className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500" placeholder="Telkom" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 mb-1">Nomor HP</label>
                  <input type="tel" inputMode="numeric" {...register("phoneNumber")} className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500" placeholder="0812..." />
                </div>
              </div>
              <button onClick={() => setStep(2)} className="w-full mt-8 bg-red-600 text-white font-bold p-4 rounded-2xl active:scale-95 transition-transform">Lanjut</button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-6 flex-1 flex flex-col justify-center">
              <h2 className="text-xl font-bold mb-4">Tujuan Kunjungan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 mb-1">Kategori</label>
                  <select {...register("category")} className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500">
                    <option value="Kunjungan Dinas">Kunjungan Dinas</option>
                    <option value="Laporan Gangguan">Laporan Gangguan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 mb-1">Bertemu Dengan</label>
                  <input {...register("hostName")} className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500" placeholder="Nama Pegawai" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 mb-1">Keperluan</label>
                  <textarea {...register("purpose")} className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 resize-none h-24" placeholder="Detail keperluan..." />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setStep(1)} className="w-1/3 bg-slate-200 text-slate-600 font-bold p-4 rounded-2xl active:scale-95 transition-transform">Kembali</button>
                <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="w-2/3 bg-red-600 text-white font-bold p-4 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-red-500/30">
                  {isSubmitting ? "Memproses..." : "Dapatkan PIN"}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && pinResult && (
            <motion.div key="step3" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-6 flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl mb-6">✓</div>
              <h2 className="text-2xl font-bold mb-2">Pendaftaran Berhasil!</h2>
              <p className="text-slate-500 mb-8">Tunjukkan atau masukkan PIN ini pada mesin Kiosk di Lobi Telkom.</p>
              
              <div className="bg-slate-100 border-2 border-slate-200 p-6 rounded-3xl w-full mb-8">
                <span className="text-5xl font-black tracking-widest text-slate-800 font-mono">{pinResult}</span>
              </div>

              <p className="text-sm text-slate-400">Anda tidak perlu mengisi data lagi di mesin Kiosk. Langsung tekan menu VIP.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}