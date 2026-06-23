"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { registerMobileVisitorAction } from "../actions/kiosk";

const KATEGORI_KUNJUNGAN = [
  "Laporan Gangguan",
  "Pasang Baru (PSB)",
  "Pindah Alamat",
  "Ubah Paket Layanan",
  "Cabut Layanan",
  "Penagihan",
  "Administrasi (SPJ)",
  "Pemeliharaan Kabel",
  "Kunjungan Dinas",
  "Lainnya"
];

export default function MobileRegistration() {
  const [step, setStep] = useState(1);
  const [pinResult, setPinResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors }, watch } = useForm();

  const onSubmit = async (data: any) => {
    if (!photoBase64) {
      alert("Mohon sertakan Foto Kunjungan/Selfie Anda terlebih dahulu.");
      return;
    }
    setIsSubmitting(true);
    // Kirim data beserta foto ke server
    const result = await registerMobileVisitorAction(data, photoBase64);
    if (result.success && result.pin) {
      setPinResult(result.pin);
      setStep(3); 
    } else {
      alert("Terjadi kesalahan. Silakan coba lagi.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden min-h-[85vh] flex flex-col relative border border-slate-100">
        
        {/* Header Premium Telkom */}
        <div className="bg-gradient-to-br from-red-600 to-red-800 p-8 text-white text-center rounded-b-[2.5rem] shadow-lg z-10 relative">
          <h1 className="text-2xl font-black tracking-wide">Pendaftaran</h1>
          <p className="text-red-100 text-sm mt-2 font-medium">Telkom Witel Sulbagteng</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-8 flex-1 flex flex-col justify-center overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 text-slate-800">1. Data Pribadi</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Nama Lengkap <span className="text-red-500">*</span></label>
                  <input {...register("fullName", { required: true })} className={`w-full p-4 bg-slate-50 rounded-2xl outline-none border transition-all ${errors.fullName ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200'}`} placeholder="Contoh: Budi Santoso" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Instansi / Perusahaan</label>
                  <input {...register("institution", { required: true })} className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all" placeholder="Contoh: Telkom (Opsional)" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Nomor HP / WhatsApp <span className="text-red-500">*</span></label>
                  <input type="tel" inputMode="numeric" {...register("phoneNumber", { required: true })} className={`w-full p-4 bg-slate-50 rounded-2xl outline-none border transition-all ${errors.phoneNumber ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200'}`} placeholder="0812..." />
                </div>
              </div>
              <button onClick={async () => {
                const name = watch("fullName");
                const phone = watch("phoneNumber");
                if (name && phone) setStep(2);
                else alert("Nama dan Nomor HP wajib diisi!");
              }} className="w-full mt-10 bg-red-600 text-white font-bold p-4 rounded-2xl shadow-[0_10px_20px_rgba(220,38,38,0.3)] hover:bg-red-700 active:scale-95 transition-all">Lanjut ➔</button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-8 flex-1 flex flex-col justify-start overflow-y-auto max-h-[75vh]">
              <h2 className="text-xl font-bold mb-6 text-slate-800">2. Detail Kunjungan</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Kategori <span className="text-red-500">*</span></label>
                  <select {...register("category", { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 appearance-none font-medium text-slate-700">
                    {KATEGORI_KUNJUNGAN.map(kat => <option key={kat} value={kat}>{kat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Bertemu Dengan</label>
                  <input {...register("hostName")} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200" placeholder="Nama Pegawai (Opsional)" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Detail Keperluan</label>
                  <textarea {...register("purpose")} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 resize-none h-24" placeholder="Jelaskan secara singkat..." />
                </div>

                {/* Upload Foto Elegan */}
                <div className="mt-4 p-5 bg-red-50 border-2 border-dashed border-red-200 rounded-3xl">
                  <label className="block text-sm font-bold text-red-700 mb-3 text-center">Foto Kunjungan <span className="text-red-500">*</span></label>
                  
                  {photoBase64 ? (
                    <div className="relative">
                      <img src={photoBase64} alt="Foto Kunjungan" className="w-full h-48 object-cover rounded-2xl shadow-md" />
                      <button type="button" onClick={() => setPhotoBase64(null)}  className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white rounded-full px-4 py-2 text-xs font-bold hover:bg-black/80 transition-all">✕ Ganti Foto</button>
                    </div>
                  ) : (
                    <div className="relative overflow-hidden group">
                      <div className="w-full py-6 bg-white rounded-2xl text-red-600 font-bold text-center flex flex-col items-center justify-center gap-2 cursor-pointer border border-red-200 shadow-sm transition-all">
                        <div className="flex gap-2 text-3xl mb-1">📸 <span className="text-gray-200">|</span> 📁</div>
                        <span>Ambil Selfie / Unggah Foto</span>
                      </div>
                      <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) return alert("Ukuran foto maksimal 5MB.");
                            const reader = new FileReader();
                            reader.onloadend = () => setPhotoBase64(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

<div className="flex gap-4 mt-8 pb-8">
  <button onClick={() => setStep(1)} className="w-1/3 bg-slate-100 text-slate-600 font-bold p-4 rounded-2xl active:scale-95 transition-all">Kembali</button>
  
  <button 
    onClick={handleSubmit(onSubmit)} 
    disabled={isSubmitting || !photoBase64} 
    className={`w-2/3 font-bold p-4 rounded-2xl transition-all ${
      !photoBase64 || isSubmitting
        ? "bg-slate-300 text-slate-500 cursor-not-allowed" // Warna abu-abu saat foto belum ada
        : "bg-red-600 text-white active:scale-95 shadow-[0_10px_20px_rgba(220,38,38,0.3)]" // Warna merah menyala saat foto sudah diisi
    }`}
  >
    {isSubmitting ? "Memproses..." : !photoBase64 ? "Foto Wajib Diisi" : "Dapatkan PIN"}
  </button>
</div>
            </motion.div>
          )}

          {step === 3 && pinResult && (
            <motion.div key="step3" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">✓</div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Tiket Dibuat!</h2>
              <p className="text-slate-500 mb-8 font-medium">Tunjukkan atau masukkan PIN ini pada mesin Kiosk di Lobi Telkom.</p>
              
              <div className="bg-slate-50 border-2 border-slate-200 p-8 rounded-[2rem] w-full mb-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">PIN Akses Anda</p>
                <span className="text-6xl font-black tracking-widest text-slate-800 font-mono">{pinResult}</span>
              </div>
              <p className="text-sm text-slate-400">Anda tidak perlu mengisi data lagi. Langsung tekan menu <b>"Punya Janji Temu"</b> di Kiosk.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}