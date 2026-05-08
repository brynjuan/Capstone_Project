"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Webcam from "react-webcam";
import { Hash, User, Building, Target, CheckCircle, ChevronRight, ChevronLeft, Phone, MapPin, Tag, Contact, QrCode } from "lucide-react";
import { submitVisitorData } from "./actions/kiosk";

// LIBRARY BARU:
import { QRCodeCanvas } from "qrcode.react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { Scanner } from "@yudiel/react-qr-scanner";

const slideVariants: Variants = {
  hidden: { x: 50, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { x: -50, opacity: 0, transition: { duration: 0.4 } }
};

const KATEGORI_KUNJUNGAN = [
  { id: "gangguan", label: "Laporan Gangguan", icon: "⚠️" },
  { id: "psb", label: "Pasang Baru (PSB)", icon: "🏠" },
  { id: "pindah", label: "Pindah Alamat", icon: "🚚" },
  { id: "modify", label: "Upgrade / Downgrade", icon: "📈" },
  { id: "cabut", label: "Cabut Layanan", icon: "❌" },
  { id: "invoice", label: "Penagihan", icon: "💳" },
  { id: "spj", label: "Administrasi (SPJ)", icon: "📝" },
  { id: "kabel", label: "Maintenance Kabel", icon: "🛠️" },
  { id: "lainnya", label: "Lainnya", icon: "✨" },
];

// ================= KOMPONEN JAM INDEPENDEN =================
// Dipisah agar tidak membuat seluruh form re-render setiap detik (mencegah suara terpotong)
const ClockWidget = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString('id-ID', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
  });
  const dateString = time.toLocaleDateString('id-ID', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, y: -50 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex items-center justify-center gap-6 bg-gray-800/80 backdrop-blur-xl px-10 pt-2 pb-4 rounded-b-[2.5rem] border-b border-x border-white/20 shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
      >
        <div className="text-xl font-bold text-white tracking-widest tabular-nums drop-shadow-md">{timeString}</div>
        <div className="flex gap-2 items-center mx-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
          <div className="w-4 h-4 rounded-full bg-[#0a0a0a] border border-white/10 shadow-inner"></div>
        </div>
        <div className="text-sm font-semibold text-gray-300 uppercase tracking-widest drop-shadow-sm">{dateString}</div>
      </motion.div>
    </div>
  );
};

export default function KioskPage() {
  const [step, setStep] = useState(0); 
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Referensi Multimedia Terlengkap
  const webcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement>(null); 
  const voiceRef = useRef<HTMLAudioElement>(null);
  const successVoiceRef = useRef<HTMLAudioElement>(null);
  const scanVoiceRef = useRef<HTMLAudioElement>(null);
  
  // State Keyboard
  const keyboardRef = useRef<any>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<string>("fullName"); 

  // State Form
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAgreed, setIsAgreed] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);

  // Form Hooks
  const { register, handleSubmit, formState: { errors }, reset, trigger, setValue, getValues, watch } = useForm(); 

  // --- EFEK AUTOPLAY MUSIC ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3; 
      audioRef.current.play().catch((error) => {
        console.warn("Autoplay diblokir browser, menunggu interaksi pengguna.", error);
      });
    }
  }, []);

  // --- EFEK IDLE RESET (Kembali ke awal jika ditinggal) ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (step > 0 && step < 6) {
      timeoutId = setTimeout(() => {
        setStep(0);
        reset();
        setKeyboardOpen(false);
        setIsScanning(false);
      }, 120000); 
    }
    return () => clearTimeout(timeoutId);
  }, [step, reset]);

  // --- FUNGSI KAMERA & FORM ---
  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setPhotoBase64(imageSrc);
    }
  }, [webcamRef]);

  const handleNext = async () => {
    const isValid = await trigger(["fullName", "phoneNumber", "institution"]);
    if (isValid) {
      capturePhoto(); 
      setStep(2);
      setKeyboardOpen(false);
    }
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setKeyboardOpen(false);
    const result = await submitVisitorData(data, photoBase64);
    
    if (result.success) {
      setStep(3);
      
      // Mainkan suara sukses (Silakan duduk di sofa)
      if (audioRef.current) audioRef.current.volume = 0.1;
      if (successVoiceRef.current) {
        successVoiceRef.current.currentTime = 0; // Reset ke awal
        successVoiceRef.current.volume = 1.0;
        successVoiceRef.current.play().catch(e => console.log(e));
      }

      setTimeout(() => {
        setStep(0);
        reset();
        setPhotoBase64(null);
        setIsSubmitting(false);
        setIsAgreed(false);
        setSelectedCategory("");
      }, 10000); 
    } else {
      setIsSubmitting(false);
      alert("Terjadi kesalahan jaringan, mohon coba lagi.");
    }
  };

  // --- FUNGSI START & MULTIMEDIA ---
  const handleStartKiosk = () => {
    setStep(1); 
    if (audioRef.current) {
      audioRef.current.volume = 0.1; 
      audioRef.current.play().catch(e => console.log(e));
    }
    if (voiceRef.current) {
      voiceRef.current.currentTime = 0; // Pastikan suara sapaan utuh
      voiceRef.current.volume = 1.0; 
      voiceRef.current.play().catch(e => console.log(e));
    }
  };

  // --- FUNGSI SCANNER QR ---
  const handleScan = (detected: any) => {
    if (detected && detected.length > 0) {
      try {
        const qrText = detected[0].rawValue;
        const data = JSON.parse(qrText);

        if (data.nama) {
          setValue("institution", data.inst || "", { shouldValidate: true });
          setValue("fullName", data.nama || "", { shouldValidate: true });
          setValue("phoneNumber", data.hp || "", { shouldValidate: true });
          setValue("internetNumber", data.inet || "");

          setIsScanning(false);
          setStep(1);

          if (audioRef.current) audioRef.current.volume = 0.1;
          if (voiceRef.current) {
            voiceRef.current.currentTime = 0; // Reset sapaan selamat datang
            voiceRef.current.volume = 1.0;
            voiceRef.current.play().catch(e => console.log(e));
          }
        }
      } catch (error) {
        console.error("Bukan QR Code Kiosk Telkom yang valid");
      }
    }
  };

  // --- FUNGSI KEYBOARD ---
  const onKeyboardChange = (input: string) => {
    setValue(activeInput, input, { shouldValidate: true });
  };
  const onKeyboardKeyPress = (button: string) => {
    if (button === "{enter}") setKeyboardOpen(false); 
  };

  // ================= RENDER UI =================
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center font-sans select-none">
      
      {/* 1. BACKGROUND VIDEO & AUDIO */}
      <video autoPlay loop muted playsInline src="/video-telkom.mp4" className="absolute inset-0 w-full h-full object-cover z-0" />
      <audio ref={audioRef} src="/bg-music.mp3" loop />
      <audio ref={voiceRef} src="/welcome-voice.mp3" />
      <audio ref={successVoiceRef} src="/success-voice.mp3" />
      <audio ref={scanVoiceRef} src="/scan-instruction.mp3" />

      {/* 1.6. WIDGET JAM & TANGGAL (Gaya iPhone Notch) */}
      <ClockWidget />

      {/* 2. OVERLAY GELAP DINAMIS */}
      <AnimatePresence>
        {step > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />
        )}
      </AnimatePresence>

      {/* 3. KAMERA TERSEMBUNYI (Mati saat scan QR aktif) */}
      {!isScanning && (
        <div className="absolute top-0 left-0 opacity-0 pointer-events-none z-0">
          <Webcam 
            audio={false} 
            ref={webcamRef} 
            screenshotFormat="image/jpeg" 
            videoConstraints={{ facingMode: "user" }} 
          />
        </div>
      )}

      {/* 4. AREA KONTEN UTAMA */}
      <AnimatePresence mode="wait">
        
        {/* ================= LAYAR 0: IDLE ================= */}
        {step === 0 && (
          <motion.div 
            key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-end pb-24 z-20"
          >
            {/* Tombol Utama */}
            <motion.div 
              animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
              className="px-10 py-5 bg-red-600/90 backdrop-blur-md border border-red-400/50 text-white rounded-full text-2xl font-bold shadow-[0_0_40px_rgba(220,38,38,0.6)] flex items-center gap-3 cursor-pointer"
              onClick={handleStartKiosk} 
            >
              Sentuh Layar Untuk Memulai <ChevronRight className="w-8 h-8" />
            </motion.div>

            {/* Tombol Scan QR */}
            <motion.button
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              onClick={(e) => { 
                e.stopPropagation(); 
                setIsScanning(true);
                // Mainkan suara instruksi scan utuh
                if (scanVoiceRef.current) {
                  scanVoiceRef.current.currentTime = 0;
                  scanVoiceRef.current.volume = 1.0;
                  scanVoiceRef.current.play().catch(e => console.log(e));
                }
              }}
              className="mt-6 px-6 py-3 bg-black/40 backdrop-blur-md border border-white/20 text-white rounded-full text-lg font-semibold flex items-center gap-3 hover:bg-black/60 transition-all cursor-pointer"
            >
              <QrCode className="w-6 h-6 text-red-400" /> Punya QR Code? Scan di Sini
            </motion.button>
          </motion.div>
        )}

        {/* ================= OVERLAY SCANNER QR ================= */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80"
            >
              <div className="bg-white/10 p-8 rounded-[40px] border border-white/20 shadow-2xl flex flex-col items-center w-[400px]">
                <h2 className="text-2xl font-bold text-white mb-2">Scan QR Code</h2>
                <p className="text-gray-400 text-center mb-8">Arahkan QR Code kunjungan Anda ke kamera Kiosk</p>

                <div className="w-full aspect-square rounded-3xl overflow-hidden border-4 border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.3)] relative">
                  <Scanner 
                    onScan={(result) => handleScan(result)} 
                    components={{ finder: false }}
                  />
                  <motion.div 
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(220,38,38,1)] z-10"
                  />
                </div>

                <button
                  onClick={() => setIsScanning(false)}
                  className="mt-8 px-10 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full border border-white/20 transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= LAYAR 1: DATA PELANGGAN ================= */}
        {step === 1 && (
          <motion.div 
            key="step1" variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-5xl bg-white/10 backdrop-blur-2xl border border-white/20 p-12 rounded-[40px] shadow-2xl z-20"
          >
            <div className="mb-8 border-b-2 border-red-500/50 w-64 pb-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">Identitas Tamu</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-x-10 gap-y-8">
              <div className="space-y-6">
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Building className="w-6 h-6 text-red-400" /> Nama Customer / Instansi <span className="text-red-500">*</span>
                  </label>
                  <input 
                    {...register("institution", { required: true })}
                    onFocus={() => { setActiveInput("institution"); setKeyboardOpen(true); }}
                    value={watch("institution") || ""}
                    className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none transition-all text-white placeholder-gray-500 ${errors.institution ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`}
                    placeholder="Contoh: Telkom" autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <User className="w-6 h-6 text-red-400" /> Nama PIC (Pengunjung) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4 mb-4">
                    <label className="flex-1 cursor-pointer">
                      <input type="radio" {...register("salutation")} value="Bapak" className="peer sr-only" defaultChecked />
                      <div className="flex items-center justify-center gap-3 text-xl p-5 bg-black/40 border border-white/20 rounded-xl text-white peer-checked:bg-red-600 peer-checked:border-red-400 transition-all">Bapak</div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input type="radio" {...register("salutation")} value="Ibu" className="peer sr-only" />
                      <div className="flex items-center justify-center gap-3 text-xl p-5 bg-black/40 border border-white/20 rounded-xl text-white peer-checked:bg-red-600 peer-checked:border-red-400 transition-all">Ibu</div>
                    </label>
                  </div>
                  <input 
                    {...register("fullName", { required: true })}
                    onFocus={() => { setActiveInput("fullName"); setKeyboardOpen(true); }}
                    value={watch("fullName") || ""}
                    className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none transition-all text-white placeholder-gray-500 ${errors.fullName ? 'border-red-500' : 'border-white/20 focus:border-red-500'}`}
                    placeholder="Contoh: Nita" autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                      <Phone className="w-6 h-6 text-red-400" /> No. HP PIC <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="tel" {...register("phoneNumber", { required: true })}
                      onFocus={() => { setActiveInput("phoneNumber"); setKeyboardOpen(true); }}
                      value={watch("phoneNumber") || ""}
                      className={`w-full text-2xl p-5 bg-black/30 border rounded-xl outline-none text-white placeholder-gray-500 ${errors.phoneNumber ? 'border-red-500' : 'border-white/20 focus:border-red-500'}`}
                      placeholder="0822..." autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                      <Hash className="w-6 h-6 text-red-400" /> No. Internet
                    </label>
                    <input 
                      type="text" {...register("internetNumber")}
                      onFocus={() => { setActiveInput("internetNumber"); setKeyboardOpen(true); }}
                      value={watch("internetNumber") || ""}
                      className="w-full text-2xl p-5 bg-black/30 border border-white/20 rounded-xl outline-none text-white placeholder-gray-500 focus:border-red-500"
                      placeholder="Contoh: 1412..." autoComplete="off"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <MapPin className="w-6 h-6 text-red-400" /> Alamat Customer
                  </label>
                  <textarea 
                    {...register("address")}
                    onFocus={() => { setActiveInput("address"); setKeyboardOpen(true); }}
                    value={watch("address") || ""}
                    className="w-full text-xl p-5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl outline-none transition-all text-white placeholder-gray-500 focus:border-red-500 min-h-[160px] resize-none"
                    placeholder="Jl. Cik Ditiro" autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="mt-12 flex justify-between">
              <button onClick={() => { setStep(0); setKeyboardOpen(false); }} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white transition-all">Batal</button>
              <button onClick={handleNext} className="px-12 py-5 bg-red-600 text-white text-xl font-bold rounded-xl shadow-xl flex items-center gap-3 hover:bg-red-500 active:scale-95 transition-all">
                Lanjut <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ================= LAYAR 2: DETAIL KUNJUNGAN ================= */}
        {step === 2 && (
          <motion.div 
            key="step2" variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-6xl bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[40px] shadow-2xl z-20"
          >
            <div className="mb-6 border-b-2 border-red-500/50 w-72 pb-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">Tujuan Kunjungan</h2>
            </div>

            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-7 space-y-4">
                <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-1">
                  <Tag className="w-6 h-6 text-red-400" /> Pilih Kategori Kunjungan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {KATEGORI_KUNJUNGAN.map((kat) => (
                    <motion.div
                      key={kat.id} whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedCategory(kat.label);
                        setValue("category", kat.label, { shouldValidate: true });
                        setKeyboardOpen(false);
                      }}
                      className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 backdrop-blur-md h-28 ${
                        selectedCategory === kat.label ? "bg-red-600/80 border-red-400 shadow-[0_0_25px_rgba(220,38,38,0.5)] scale-105" : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-3xl">{kat.icon}</span>
                      <span className={`text-xs font-bold leading-tight ${selectedCategory === kat.label ? "text-white" : "text-gray-300"}`}>{kat.label}</span>
                    </motion.div>
                  ))}
                </div>
                {errors.category && <p className="text-red-500 text-sm italic animate-pulse">Mohon pilih salah satu kategori!</p>}
                <input type="hidden" {...register("category", { required: true })} />
              </div>

              <div className="col-span-5 space-y-6">
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Contact className="w-6 h-6 text-red-400" /> Petugas yang Dituju
                  </label>
                  <input 
                    {...register("hostName")}
                    onFocus={() => { setActiveInput("hostName"); setKeyboardOpen(true); }}
                    value={watch("hostName") || ""}
                    className="w-full text-xl p-5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl outline-none text-white placeholder-gray-500 focus:border-red-500 transition-all"
                    placeholder="Default: Nita Wulandari" autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Target className="w-6 h-6 text-red-400" /> Maksud dan Tujuan
                  </label>
                  <textarea 
                    {...register("purpose")}
                    onFocus={() => { setActiveInput("purpose"); setKeyboardOpen(true); }}
                    value={watch("purpose") || ""}
                    className="w-full text-lg p-5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl outline-none text-white placeholder-gray-500 min-h-[160px] resize-none focus:border-red-500 transition-all"
                    placeholder='Contoh: "Kenapa terjadi gangguan"'
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-black/20 rounded-2xl border border-white/5">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-1">
                  <input 
                    type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)}
                    className="peer h-7 w-7 appearance-none rounded-lg border-2 border-white/20 bg-black/40 checked:bg-red-600 checked:border-red-400 transition-all cursor-pointer"
                  />
                  <CheckCircle className="absolute w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                </div>
                <p className="text-gray-300 text-lg leading-snug select-none group-hover:text-white transition-colors">
                  Saya setuju bahwa data yang saya berikan digunakan untuk kepentingan keamanan dan administrasi kunjungan di <span className="text-red-400 font-bold">Telkom Witel Sulbagteng</span>.
                </p>
              </label>
            </div>

            <div className="mt-10 flex justify-between items-center">
              <button onClick={() => { setStep(1); setKeyboardOpen(false); }} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white transition-all flex items-center gap-2">
                <ChevronLeft className="w-6 h-6" /> Kembali
              </button>
              <button 
                onClick={() => { setKeyboardOpen(false); handleSubmit(onSubmit)(); }} 
                disabled={isSubmitting || !isAgreed}
                className={`px-14 py-5 text-white text-xl font-bold rounded-2xl backdrop-blur-md border border-white/20 shadow-xl active:scale-95 transition-all flex items-center gap-3 ${(isSubmitting || !isAgreed) ? 'bg-gray-600/50 grayscale cursor-not-allowed opacity-50' : 'bg-red-600/90 hover:bg-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)]'}`}
              >
                {isSubmitting ? 'Menyimpan...' : 'Selesai & Kirim'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ================= LAYAR 3: SUCCESS & QR CODE ================= */}
        {step === 3 && (
          <motion.div 
            key="step3" variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            className="flex w-full max-w-5xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl z-20 overflow-hidden"
          >
            <div className="flex-1 p-16 flex flex-col items-center justify-center text-center border-r border-white/10">
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="bg-green-500/20 rounded-full p-4 mb-8 border border-green-400/30"
              >
                <CheckCircle className="w-32 h-32 text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
              </motion.div>
              <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-md">Pendaftaran Berhasil!</h2>
              <p className="text-2xl text-gray-300 leading-relaxed drop-shadow-sm">
                Mohon tunggu sebentar, petugas kami akan segera menemui Anda.
              </p>
            </div>

            <div className="w-[400px] bg-black/40 p-12 flex flex-col items-center justify-center text-center">
              <QrCode className="w-12 h-12 text-red-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Sering Berkunjung?</h3>
              <p className="text-sm text-gray-400 mb-8">Scan & simpan QR Code ini untuk pendaftaran instan di kunjungan berikutnya.</p>
              
              <div className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <QRCodeCanvas 
                  value={JSON.stringify({
                    inst: getValues("institution"),
                    nama: getValues("fullName"),
                    hp: getValues("phoneNumber"),
                    inet: getValues("internetNumber")
                  })} 
                  size={180} level="H"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= 5. VIRTUAL KEYBOARD UI ================= */}
      <AnimatePresence>
        {keyboardOpen && step > 0 && step < 3 && (
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 w-full max-w-5xl z-50 p-4 
                bg-gray-700/40 backdrop-blur-xl 
                border-t border-x border-white/30 
                rounded-t-3xl 
                shadow-[0_-10px_30px_rgba(0,0,0,0.4)] 
                text-white"
          >
            <div className="flex justify-between items-center mb-3 px-4">
              <span className="text-white/60 font-semibold text-sm uppercase tracking-widest">Keyboard Layar Sentuh</span>
              <button onClick={() => setKeyboardOpen(false)} className="text-red-400 font-bold px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-sm">Tutup</button>
            </div>
            
            <div className="keyboard-dark-theme rounded-xl overflow-hidden border border-white/10 text-black">
              <Keyboard
                keyboardRef={r => (keyboardRef.current = r)}
                layoutName="default"
                onChange={onKeyboardChange}
                onKeyPress={onKeyboardKeyPress}
                inputName={activeInput}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}