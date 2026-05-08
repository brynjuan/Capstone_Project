"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Webcam from "react-webcam";
import { Hash, User, Building, Target, CheckCircle, ChevronRight, ChevronLeft, Phone, MapPin, Tag, Contact } from "lucide-react";
import { submitVisitorData } from "./actions/kiosk";
import { QRCodeCanvas } from "qrcode.react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";


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

export default function KioskPage() {
  const [step, setStep] = useState(0); 
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement>(null); // Referensi audio

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<string>("fullName"); // Melacak input mana yang aktif
  const voiceRef = useRef<HTMLAudioElement>(null);
  const keyboardRef = useRef<any>(null);

const [selectedCategory, setSelectedCategory] = useState<string>("");
const [currentTime, setCurrentTime] = useState(new Date());
const [isAgreed, setIsAgreed] = useState(false); // State untuk checkbox privasi

const { register, handleSubmit, formState: { errors }, reset, trigger, setValue } = useForm(); // Pastikan ada setValue
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);
  return () => clearInterval(timer);
}, []);
const timeString = currentTime.toLocaleTimeString('id-ID', { 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit', 
  hour12: false 
});

const dateString = currentTime.toLocaleDateString('id-ID', { 
  weekday: 'long', 
  day: 'numeric', 
  month: 'long', 
  year: 'numeric' 
});

useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3; // Atur volume 30% agar tidak berisik
      
      // Paksa browser mencoba memutar audio
      audioRef.current.play().catch((error) => {
        console.warn("Browser memblokir autoplay, membutuhkan trik Kiosk Mode.", error);
      });
    }
  }, []);
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (step > 0 && step < 3) {
      timeoutId = setTimeout(() => {
        setStep(0);
        reset();
      }, 120000); // Waktu idle ditambah jadi 2 menit karena form lebih panjang
    }
    return () => clearTimeout(timeoutId);
  }, [step, reset]);

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setPhotoBase64(imageSrc);
    }
  }, [webcamRef]);

  const handleNext = async () => {
    // Validasi field yang wajib di Langkah 1
    const isValid = await trigger(["fullName", "phoneNumber", "institution"]);
    if (isValid) {
      capturePhoto(); 
      setStep(2);
    }
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const result = await submitVisitorData(data, photoBase64);
    
    if (result.success) {
      setStep(3);
      setTimeout(() => {
        setStep(0);
        reset();
        setPhotoBase64(null);
        setIsSubmitting(false);
      }, 4000);
    } else {
      setIsSubmitting(false);
      alert("Terjadi kesalahan jaringan, mohon coba lagi.");
    }
  };

  // 1. Fungsi untuk memulai Kiosk & Audio
  const handleStartKiosk = () => {
    setStep(1); // Pindah ke form Layar 1
    
    // Mainkan musik latar dengan volume 10% agar tidak menutupi suara mbak-mbaknya
    if (audioRef.current) {
      audioRef.current.volume = 0.1; 
      audioRef.current.play().catch(e => console.log("Browser menahan musik latar", e));
    }

    // Mainkan Voice Over sapaan dengan volume 100%
    if (voiceRef.current) {
      voiceRef.current.volume = 1.0;
      voiceRef.current.play().catch(e => console.log("Browser menahan voice over", e));
    }
  };

  // 2. Fungsi saat tombol Virtual Keyboard ditekan (mengetik huruf)
  const onKeyboardChange = (input: string) => {
    // setValue akan memasukkan huruf yang diketik keyboard ke dalam react-hook-form
    setValue(activeInput, input, { shouldValidate: true });
  };

  // 3. Fungsi saat tombol khusus di Virtual Keyboard ditekan (seperti Enter)
  const onKeyboardKeyPress = (button: string) => {
    if (button === "{enter}") {
      setKeyboardOpen(false); // Tutup keyboard jika tombol Enter ditekan
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center font-sans select-none">
      
      {/* 1. BACKGROUND VIDEO FULL */}
      <video
        autoPlay
        loop
        muted
        playsInline
        src="/video-telkom.mp4" 
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      {/* 1.5. AUDIO PLAYER (Looping) */}
      <audio ref={audioRef} src="/bg-music.mp3" loop />

{/* 1.6. WIDGET JAM & TANGGAL (Gaya iPhone Notch / Dynamic Island) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
<motion.div 
  initial={{ opacity: 0, y: -50 }} 
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  className="flex items-center justify-center gap-6 
             bg-gray-800/60 backdrop-blur-xl 
             px-10 pt-2 pb-4 
             rounded-b-[2.5rem] 
             border-b border-x border-white/20 
             shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
>
          {/* Jam */}
          <div className="text-xl font-bold text-white tracking-widest tabular-nums drop-shadow-md">
            {timeString}
          </div>
          
          {/* Indikator "Kamera/Sensor" ala iPhone (Estetika) */}
          <div className="flex gap-2 items-center mx-2">
            {/* Titik hijau berkedip seperti indikator iOS */}
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            {/* Lensa kamera palsu */}
            <div className="w-4 h-4 rounded-full bg-[#0a0a0a] border border-white/10 shadow-inner"></div>
          </div>
          
          {/* Tanggal */}
          <div className="text-sm font-semibold text-gray-300 uppercase tracking-widest drop-shadow-sm">
            {dateString}
          </div>
        </motion.div>
      </div>

      {/* 2. OVERLAY GELAP DINAMIS */}
      <AnimatePresence>
        {step > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-black/60 z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* 3. KAMERA TERSEMBUNYI */}
      <div className="absolute top-0 left-0 opacity-0 pointer-events-none z-0">
        <Webcam 
          audio={false} 
          ref={webcamRef} 
          screenshotFormat="image/jpeg" 
          videoConstraints={{ facingMode: "user" }} 
        />
      </div>

 {/* 4. AREA KONTEN UI */}
      <AnimatePresence mode="wait">
        
{/* ================= LAYAR 0: IDLE ================= */}
        {step === 0 && (
          <motion.div 
            key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-end pb-24 cursor-pointer z-20"
            onClick={handleStartKiosk} // <--- INI YANG DIUBAH
          >
            <motion.div 
              animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
              className="px-10 py-5 bg-red-600/90 backdrop-blur-md border border-red-400/50 text-white rounded-full text-2xl font-bold shadow-[0_0_40px_rgba(220,38,38,0.6)] flex items-center gap-3"
            >
              Sentuh Layar Untuk Memulai <ChevronRight className="w-8 h-8" />
            </motion.div>
          </motion.div>
        )}

{/* ================= LAYAR 1: DATA PELANGGAN (DIPERBARUI) ================= */}
        {step === 1 && (
          <motion.div 
            key="step1" variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-5xl bg-white/10 backdrop-blur-2xl border border-white/20 p-12 rounded-[40px] shadow-2xl z-20"
          >
            <div className="mb-8 border-b-2 border-red-500/50 w-64 pb-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">Identitas Tamu</h2>
            </div>
            
            {/* Menggunakan Grid agar tertata rapi dan tidak saling tabrak */}
            <div className="grid grid-cols-2 gap-x-10 gap-y-8">
              
              {/* Kolom 1 */}
              <div className="space-y-6">
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Building className="w-6 h-6 text-red-400" /> Nama Customer / Instansi <span className="text-red-500">*</span>
                  </label>
                  <input 
                    {...register("institution", { required: true })}
                    className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none transition-all text-white placeholder-gray-500 ${errors.institution ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`}
                    placeholder="Contoh: Telkom"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <User className="w-6 h-6 text-red-400" /> Nama PIC (Pengunjung) <span className="text-red-500">*</span>
                  </label>
                  
                  {/* Desain "Keren" untuk Pilihan Bapak/Ibu menggunakan Radio Group yang ditata */}
                  <div className="flex gap-4 mb-4">
                    <label className="flex-1 cursor-pointer">
                      <input type="radio" {...register("salutation")} value="Bapak" className="peer sr-only" defaultChecked />
                      <div className="flex items-center justify-center gap-3 text-xl p-5 bg-black/40 border border-white/20 rounded-xl text-white peer-checked:bg-red-600 peer-checked:border-red-400 transition-all hover:bg-white/10">
                        <User className="w-6 h-6" /> Bapak
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input type="radio" {...register("salutation")} value="Ibu" className="peer sr-only" />
                      <div className="flex items-center justify-center gap-3 text-xl p-5 bg-black/40 border border-white/20 rounded-xl text-white peer-checked:bg-red-600 peer-checked:border-red-400 transition-all hover:bg-white/10">
                        <User className="w-6 h-6" /> Ibu
                      </div>
                    </label>
                  </div>

                  <input 
                    {...register("fullName", { required: true })}
                    className={`flex-1 text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none transition-all text-white placeholder-gray-500 ${errors.fullName ? 'border-red-500' : 'border-white/20 focus:border-red-500'}`}
                    placeholder="Contoh: Nita"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Kolom 2 */}
              <div className="space-y-6">
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Phone className="w-6 h-6 text-red-400" /> No. HP PIC <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="tel"
                    {...register("phoneNumber", { required: true })}
                    className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none transition-all text-white placeholder-gray-500 ${errors.phoneNumber ? 'border-red-500' : 'border-white/20 focus:border-red-500'}`}
                    placeholder="Contoh: 0822..."
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <MapPin className="w-6 h-6 text-red-400" /> Alamat Customer
                  </label>
                  {/* Menggunakan textarea agar menampung alamat panjang dengan rapi */}
                  <textarea 
                    {...register("address")}
                    className="w-full text-xl p-5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl outline-none transition-all text-white placeholder-gray-500 focus:border-red-500 min-h-[160px] resize-none"
                    placeholder="Jl. Cik Ditiro"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {/* Tombol Navigasi */}
            <div className="mt-12 flex justify-between">
              <button onClick={() => setStep(0)} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white transition-all">Batal</button>
              <button onClick={handleNext} className="px-12 py-5 bg-red-600 text-white text-xl font-bold rounded-xl shadow-xl flex items-center gap-3 hover:bg-red-500 active:scale-95 transition-all">
                Lanjut <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        )}
{/* ================= LAYAR 2: DETAIL KUNJUNGAN (GRID CARD VERSION) ================= */}
        {step === 2 && (
          <motion.div 
            key="step2" variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-6xl bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[40px] shadow-2xl z-20"
          >
            <div className="mb-6 border-b-2 border-red-500/50 w-72 pb-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">Tujuan Kunjungan</h2>
            </div>

            <div className="grid grid-cols-12 gap-8">
              {/* KOLOM KIRI: GRID CATEGORY (7 Kolom) */}
              <div className="col-span-7 space-y-4">
                <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-1">
                  <Tag className="w-6 h-6 text-red-400" /> Pilih Kategori Kunjungan <span className="text-red-500">*</span>
                </label>
                
                <div className="grid grid-cols-3 gap-3">
                  {KATEGORI_KUNJUNGAN.map((kat) => (
                    <motion.div
                      key={kat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedCategory(kat.label);
                        setValue("category", kat.label); // Set nilai ke form
                      }}
                      className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 backdrop-blur-md h-28 ${
                        selectedCategory === kat.label 
                        ? "bg-red-600/80 border-red-400 shadow-[0_0_25px_rgba(220,38,38,0.5)] scale-105" 
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-3xl">{kat.icon}</span>
                      <span className={`text-xs font-bold leading-tight ${selectedCategory === kat.label ? "text-white" : "text-gray-300"}`}>
                        {kat.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {errors.category && <p className="text-red-500 text-sm italic animate-pulse">Mohon pilih salah satu kategori!</p>}
                
                {/* Hidden Input untuk validasi */}
                <input type="hidden" {...register("category", { required: true })} />
              </div>

              {/* KOLOM KANAN: INPUT TEKS (5 Kolom) */}
              <div className="col-span-5 space-y-6">
                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Contact className="w-6 h-6 text-red-400" /> Petugas yang Dituju
                  </label>
                  <input 
                    {...register("hostName")}
                    className="w-full text-xl p-5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl outline-none text-white placeholder-gray-500 focus:border-red-500 transition-all"
                    placeholder="Default: Nita Wulandari"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3">
                    <Target className="w-6 h-6 text-red-400" /> Maksud dan Tujuan
                  </label>
                  <textarea 
                    {...register("purpose")}
                    className="w-full text-lg p-5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl outline-none text-white placeholder-gray-500 min-h-[160px] resize-none focus:border-red-500 transition-all"
                    placeholder='Contoh: "Kenapa terjadi gangguan"'
                  />
                </div>
              </div>
            </div>


            {/* CHECKBOX KEBIJAKAN PRIVASI */}
<div className="mt-8 p-4 bg-black/20 rounded-2xl border border-white/5">
  <label className="flex items-start gap-4 cursor-pointer group">
    <div className="relative flex items-center justify-center mt-1">
      <input 
        type="checkbox" 
        checked={isAgreed}
        onChange={(e) => setIsAgreed(e.target.checked)}
        className="peer h-7 w-7 appearance-none rounded-lg border-2 border-white/20 bg-black/40 checked:bg-red-600 checked:border-red-400 transition-all cursor-pointer"
      />
      <CheckCircle className="absolute w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
    </div>
    <p className="text-gray-300 text-lg leading-snug select-none group-hover:text-white transition-colors">
      Saya setuju bahwa data yang saya berikan digunakan untuk kepentingan keamanan dan administrasi kunjungan di <span className="text-red-400 font-bold">Telkom Witel Sulbagteng</span>.
    </p>
  </label>
</div>

{/* UPDATE TOMBOL SELESAI */}
<div className="mt-10 flex justify-between items-center">
  <button onClick={() => setStep(1)} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white transition-all flex items-center gap-2">
    <ChevronLeft className="w-6 h-6" /> Kembali
  </button>
  
  <button 
    onClick={handleSubmit(onSubmit)} 
    disabled={isSubmitting || !isAgreed} // <--- Tombol mati jika belum centang
    className={`px-14 py-5 text-white text-xl font-bold rounded-2xl backdrop-blur-md border border-white/20 shadow-xl active:scale-95 transition-all flex items-center gap-3 ${
      (isSubmitting || !isAgreed) ? 'bg-gray-600/50 grayscale cursor-not-allowed opacity-50' : 'bg-red-600/90 hover:bg-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)]'
    }`}
  >
    {isSubmitting ? 'Menyimpan...' : 'Selesai & Kirim'}
  </button>
</div>
          </motion.div>
        )}

        {/* ================= LAYAR 3: SUCCESS STATE ================= */}
        {step === 3 && (
          <motion.div 
            key="step3" variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col items-center w-full max-w-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-16 rounded-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] z-20 text-center"
          >
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="bg-green-500/20 rounded-full p-4 mb-10 border border-green-400/30"
            >
              <CheckCircle className="w-40 h-40 text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
            </motion.div>
            <h2 className="text-5xl font-bold text-white mb-6 drop-shadow-md">Pendaftaran Berhasil!</h2>
            <p className="text-3xl text-gray-300 leading-relaxed drop-shadow-sm">
              Terima kasih telah mengisi data.<br/>Silakan tunggu petugas kami menemui Anda.
            </p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}