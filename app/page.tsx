"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Webcam from "react-webcam";
import { Headset, Hash, Star, User, Building, Target, CheckCircle, ChevronRight, ChevronLeft, ChevronDown, Phone, MapPin, Tag, Contact, QrCode, Volume2, VolumeX } from "lucide-react";
import { submitVisitorData } from "./actions/kiosk";
import Tesseract from 'tesseract.js';
import { performOCR } from "./actions/kiosk";
import { submitVisitorRating } from "./actions/kiosk"; // Import action yang baru dibuat
import { uploadPhotoboothImage } from "./actions/kiosk";
import dynamic from "next/dynamic";
import { useRef } from "react";

const ZegoCall = dynamic(() => import("./components/ZegoCall"), { 
  ssr: false 
});


// LIBRARY
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

// FUNGSI 1: FORMAT NOMOR HP OTOMATIS (0812-3456-7890)
const formatPhone = (val: string) => {
  if (!val) return "";
  const raw = val.replace(/\D/g, ''); 
  const match = raw.match(/^(\d{0,4})(\d{0,4})(\d{0,5})$/);
  if (match) {
    return !match[2] ? match[1] : `${match[1]}-${match[2]}` + (match[3] ? `-${match[3]}` : '');
  }
  return raw;
};

// FUNGSI 2: AUTO TITLE CASE (Huruf Kapital Otomatis di Awal Kata)
const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

// ================= KOMPONEN JAM INDEPENDEN =================
const ClockWidget = () => {
  const [time, setTime] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false); // Penanda apakah komponen sudah terpasang di browser

  useEffect(() => {
    // useEffect HANYA berjalan di browser, tidak di server.
    // Jadi kita tandai bahwa komponen sudah aman untuk dimunculkan.
    setIsMounted(true);
    
    // Update jam setiap 1 detik
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Mencegah error "Hydration Mismatch"
  // Jika belum terpasang di browser, jangan tampilkan apa-apa (null)
  if (!isMounted) {
    return null; 
  }

  // Format jam (24 jam) dan tanggal Indonesia
  const timeString = time.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: false 
  });
  
  const dateString = time.toLocaleDateString('id-ID', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, y: -50 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex items-center justify-center gap-6 bg-gray-800/80 backdrop-blur-xl px-10 pt-2 pb-4 rounded-b-[2.5rem] border-b border-x border-white/20 shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
      >
        <div className="text-xl font-bold text-white tracking-widest tabular-nums drop-shadow-md">
          {timeString}
        </div>
        
        <div className="flex gap-2 items-center mx-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
          <div className="w-4 h-4 rounded-full bg-[#0a0a0a] border border-white/10 shadow-inner"></div>
        </div>
        
        <div className="text-sm font-semibold text-gray-300 uppercase tracking-widest drop-shadow-sm">
          {dateString}
        </div>
      </motion.div>
    </div>
  );
};

export default function KioskPage() {
  const [step, setStep] = useState(0); 
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  //soun inputan
  // 1. Buat referensi ke elemen audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; 
      audioRef.current.play().catch((err) => console.log("Audio terblokir:", err));
    }
  };

  //telponan/vc
  const [showIntercom, setShowIntercom] = useState(false);

  //photobooth
  const [showPhotobooth, setShowPhotobooth] = useState(false);
  const [photoboothResult, setPhotoboothResult] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoboothUrl, setPhotoboothUrl] = useState<string | null>(null);

  //rating
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [currentVisitorId, setCurrentVisitorId] = useState<string>("");

  //ocr punya
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  // pin puunya
  const [showPinInput, setShowPinInput] = useState(false);
  const [vipPin, setVipPin] = useState("");
  
  // Referensi Multimedia
  const webcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement>(null); 
  const voiceRef = useRef<HTMLAudioElement>(null);
  const successVoiceRef = useRef<HTMLAudioElement>(null);
  const scanVoiceRef = useRef<HTMLAudioElement>(null);
  
  // State Interaksi & Keyboard
  const keyboardRef = useRef<any>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<string>("fullName"); 
  const [keyboardLayoutName, setKeyboardLayoutName] = useState("default"); // State Layout (Abjad/Numpad)
  const [isMuted, setIsMuted] = useState(false); // State Mode Hening
  const [ripples, setRipples] = useState<{ id: number, x: number, y: number }[]>([]); // State Efek Riak Air

  // State Form
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAgreed, setIsAgreed] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);

  // State Timeout Warning
  const [countdown, setCountdown] = useState(10);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, trigger, setValue, getValues, watch } = useForm(); 

  // --- EFEK AUTOPLAY MUSIC ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3; 
      audioRef.current.play().catch(() => {});
    }
  }, []);

  // --- EFEK SINKRONISASI MUTE ---
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
    if (voiceRef.current) voiceRef.current.muted = isMuted;
    if (successVoiceRef.current) successVoiceRef.current.muted = isMuted;
    if (scanVoiceRef.current) scanVoiceRef.current.muted = isMuted;
  }, [isMuted]);

  // --- LOGIKA SAPAAN DINAMIS ---
  const currentHour = new Date().getHours();
  let greeting = "Selamat Malam";
  if (currentHour >= 5 && currentHour < 11) greeting = "Selamat Pagi";
  else if (currentHour >= 11 && currentHour < 15) greeting = "Selamat Siang";
  else if (currentHour >= 15 && currentHour < 18) greeting = "Selamat Sore";

  //photobooth punya
const handleCapturePhotobooth = () => {
    if (!webcamRef.current) return;
    
    const webcamImageSrc = webcamRef.current.getScreenshot();
    if (!webcamImageSrc) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const webcamImg = new Image();
    const frameImg = new Image();

    webcamImg.onload = () => {
      canvas.width = webcamImg.width;
      canvas.height = webcamImg.height;
      ctx?.drawImage(webcamImg, 0, 0, canvas.width, canvas.height);

      // Ubah fungsi onload frame menjadi async agar bisa memanggil backend
      frameImg.onload = async () => {
        ctx?.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
        const finalImage = canvas.toDataURL("image/jpeg", 0.9);
        
        // 1. Tampilkan hasilnya langsung ke layar (Instant Feedback)
        setPhotoboothResult(finalImage); 
        
        // 2. Mulai proses upload di latar belakang
        setIsUploadingPhoto(true);
        try {
          const response = await uploadPhotoboothImage(finalImage);
          if (response.success && response.url) {
            // 3. Simpan URL publik dari Cloudflare R2
            setPhotoboothUrl(response.url);
          } else {
            alert("Gagal mengunggah foto ke server.");
          }
        } catch (error) {
          console.error("Upload error:", error);
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      
      frameImg.src = "/frame-telkom.png"; 
    };
    webcamImg.src = webcamImageSrc;
  };

  // pin punya
  const checkVipPin = () => {
  // PIN Contoh untuk demo
  if (vipPin === "202611") { 
    // Jika PIN benar, otomatis isi data dummy VIP
    setValue('fullName', 'Tamu VIP Telkom');
    setValue('institution', 'PT Telkom Indonesia (Persero) Tbk');
    setValue('phoneNumber', '0811-0000-1234');
    setStep(1); // Langsung lompat ke konfirmasi data
    setShowPinInput(false);
    alert("Selamat datang, Tamu VIP! Data Anda telah dimuat.");
  } else {
    alert("PIN Salah atau Tidak Terdaftar.");
    setVipPin("");
  }
};

  //ocr puny
const handleScanKTP = async () => {
  if (!webcamRef.current) return;
  
  setIsOcrLoading(true);
  const imageSrc = webcamRef.current.getScreenshot();
  
  if (imageSrc) {
    try {
      const result = await performOCR(imageSrc);
      
if (result.success && result.text) {
  const text = result.text;
  console.log("Raw OCR:", text);

  const lines = text.split('\n')
                    .map((l: string) => l.trim().toUpperCase())
                    .filter((l: string) => l.length > 0);

  let extractedName = "";
  let extractedAddress = "";

  // ================= JANGKAR NIK (Trik Paling Ampuh) =================
  // Cari baris yang mengandung 16 digit angka (contoh: 7204073007060001)
  const nikIdx = lines.findIndex((l: string) => /\d{16}/.test(l));
  
  if (nikIdx !== -1 && lines[nikIdx + 1]) {
    // Ambil baris tepat di bawah NIK sebagai NAMA
    extractedName = lines[nikIdx + 1].replace(/[:;|]/g, "").trim();
    console.log("Dapat Nama dari bawah NIK:", extractedName);
  } else {
    // Fallback jika NIK juga hancur (cari kata NAMA walau ejaannya salah)
    const nameIdx = lines.findIndex((l: string) => l.includes("NAMA") || l.includes("N A M A"));
    if (nameIdx !== -1 && lines[nameIdx + 1]) {
      extractedName = lines[nameIdx + 1].replace(/[:;|]/g, "").trim();
    }
  }

  // ================= EKSTRAKSI ALAMAT =================
  // Alamat biasanya lebih mudah ditebak karena ada RT/RW atau Kel/Desa
  const addrIdx = lines.findIndex((l: string) => l.includes("ALAMAT") || l.includes("RT") || l.includes("RW"));
  if (addrIdx !== -1) {
    extractedAddress = lines[addrIdx].replace(/A L A M A T|ALAMAT|[:;|]/g, "").trim();
    if (!extractedAddress && lines[addrIdx + 1]) {
      extractedAddress = lines[addrIdx + 1].replace(/[:;|]/g, "").trim();
    }
  }

  // ================= MASUKKAN KE FORM =================
  if (extractedName) {
    setValue("fullName", extractedName, { shouldValidate: true, shouldDirty: true });
  }
  
  if (extractedAddress) {
    setValue("address", extractedAddress, { shouldValidate: true, shouldDirty: true });
  }

  if (extractedName || extractedAddress) {
     alert("Data KTP berhasil diekstrak sebagian!");
  } else {
     alert("KTP terlalu buram/gelap. Silakan dekatkan ke kamera atau ketik manual.");
  }




      } else {
        alert("Gagal membaca teks. Pastikan KTP terlihat jelas.");
      }
    } catch (error) {
      console.error("Gagal OCR:", error);
      alert("Terjadi gangguan koneksi ke Google Vision.");
    } finally {
      setIsOcrLoading(false);
    }
  }
};

  // --- EFEK RIPPLE (RIAK AIR) GLOBAL ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const newRipple = { id: Date.now(), x: e.clientX, y: e.clientY };
    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);
  };

  // --- SMART TIMEOUT WARNING ---
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setShowTimeoutWarning(false);
    setCountdown(10);

    if (step > 0 && step < 4) {
      idleTimerRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
        countdownTimerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
              setStep(0);
              reset();
              setKeyboardOpen(false);
              setIsScanning(false);
              setShowTimeoutWarning(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, 10000); // Muncul warning setelah 110 detik didiamkan
    }
  }, [step, reset]);

  useEffect(() => {
    startIdleTimer();
    const handleActivity = () => {
      if (!showTimeoutWarning && step > 0 && step < 3) startIdleTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [startIdleTimer, showTimeoutWarning, step]);

  // --- FUNGSI KAMERA & FORM ---
  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setPhotoBase64(imageSrc);
    }
  }, [webcamRef]);

  const handleNext = async () => {
    // Validasi No. Internet wajib disertakan
    const isValid = await trigger(["fullName", "phoneNumber", "institution", "internetNumber"]);
    if (isValid) {
      capturePhoto(); 
      setStep(2);
      setKeyboardOpen(false);
    }
  };

const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setKeyboardOpen(false);
    
    // Asumsi photoBase64 sudah ada di state (sesuai kode Anda)
    const result = await submitVisitorData(data, photoBase64);
    
    if (result.success) {
      // ========================================================
      // 1. TANGKAP ID UNTUK FITUR RATING
      if (result.visitorId) {
        setCurrentVisitorId(result.visitorId);
      }
      // ========================================================

      // 2. AUDIO & VOICE OVER (Logika Anda yang sangat keren!)
      if (audioRef.current) audioRef.current.volume = 0.1;
      if (successVoiceRef.current && !isMuted) {
        successVoiceRef.current.currentTime = 0;
        successVoiceRef.current.volume = 1.0;
        successVoiceRef.current.play().catch(() => {});
      }

      // 3. PINDAH KE LAYAR SUKSES
      setStep(3);
      setIsSubmitting(false);
      
      // CATATAN PENTING: setTimeout 10 detik DIHAPUS DARI SINI!
      // Karena kita ingin tamu menekan tombol "Selesai & Beri Rating" 
      // untuk pindah ke Step 4 dengan tenang.

    } else {
      setIsSubmitting(false);
      alert("Terjadi kesalahan jaringan, mohon coba lagi.");
    }
  };

  // --- FUNGSI START KIOSK ---
  const handleStartKiosk = () => {
    setStep(1); 
    if (audioRef.current) audioRef.current.volume = 0.1;
    if (voiceRef.current && !isMuted) {
      voiceRef.current.currentTime = 0;
      voiceRef.current.volume = 1.0; 
      voiceRef.current.play().catch(() => {});
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
          setValue("internetNumber", data.inet || "", { shouldValidate: true });
          setIsScanning(false);
          setStep(1);
          if (voiceRef.current && !isMuted) {
            voiceRef.current.currentTime = 0;
            voiceRef.current.play();
          }
        }
      } catch (error) { console.error("Invalid QR"); }
    }
  };

  // ================= SIHIR NUMPAD & AUTO-SCROLL =================

  // 1. Logika Layout Cerdas (Smart Numpad & Auto-Capitalize)
  const onKeyboardChange = (input: string) => {
    if (activeInput === "phoneNumber") {
      const formatted = formatPhone(input);
      setValue(activeInput, formatted, { shouldValidate: true });
      if (keyboardRef.current) keyboardRef.current.setInput(formatted);
    } 
    else if (["institution", "fullName", "hostName"].includes(activeInput)) {
      const titleCased = toTitleCase(input);
      setValue(activeInput, titleCased, { shouldValidate: true });
      if (keyboardRef.current) keyboardRef.current.setInput(titleCased);
    } 
    else {
      setValue(activeInput, input, { shouldValidate: true });
    }
  };

  const onKeyboardKeyPress = (button: string) => {
    if (button === "{shift}" || button === "{lock}") {
      setKeyboardLayoutName(keyboardLayoutName === "default" ? "shift" : "default");
    }
    if (button === "{enter}") setKeyboardOpen(false); 
  };

  // Susunan Tombol Numpad Kustom & QWERTY
  const customKeyboardLayouts = {
    default: [
      "1 2 3 4 5 6 7 8 9 0 - {bksp}",
      "q w e r t y u i o p",
      "a s d f g h j k l",
      "{shift} z x c v b n m , .",
      "{space} {enter}"
    ],
    shift: [
      "! @ # $ % ^ & * ( ) _ {bksp}",
      "Q W E R T Y U I O P",
      "A S D F G H J K L",
      "{shift} Z X C V B N M < >",
      "{space} {enter}"
    ],
    numeric: [ // Tampilan Numpad Angka Besar
      "1 2 3",
      "4 5 6",
      "7 8 9",
      "- 0 {bksp}",
      "{enter}"
    ]
  };

  const isNumericInput = activeInput === "phoneNumber" || activeInput === "internetNumber";
  const currentLayoutName = isNumericInput ? "numeric" : keyboardLayoutName;

  // 2. Logika Auto-Scroll Naik (Anti-Tertutup Keyboard)
  let shiftY = 0;
  if (keyboardOpen) {
    if (activeInput === "address") shiftY = -180; // Meluncur naik saat alamat diklik
    if (activeInput === "internetNumber" || activeInput === "phoneNumber") shiftY = -120;
    if (activeInput === "purpose") shiftY = -150; // Meluncur naik saat keluhan diklik
    if (activeInput === "fullName") shiftY = -180; // Meluncur naik sedikit saat isi nama
  }

  return (
    // Pembungkus utama mendengarkan event onPointerDown untuk Efek Ripple
    <div 
      onPointerDown={handlePointerDown} 
      className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center font-sans select-none"
    >
      {/* ANIMASI EFEK RIPPLE (RIAK AIR GLOBAL) */}
      <AnimatePresence>
        {ripples.map(r => (
          <motion.div
            key={r.id}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute w-24 h-24 bg-white/40 rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2"
            style={{ left: r.x, top: r.y }}
          />
        ))}
      </AnimatePresence>

      {/* MULTIMEDIA ASSETS */}
      <video autoPlay loop muted playsInline src="/video-telkom.mp4" className="absolute inset-0 w-full h-full object-cover z-0" />
      <audio ref={audioRef} src="/bg-music.mp3" loop />
      <audio ref={voiceRef} src="/welcome-voice.mp3" />
      <audio ref={successVoiceRef} src="/success-voice.mp3" />
      <audio ref={scanVoiceRef} src="/scan-instruction.mp3" />

      {/* CLOCK WIDGET */}
      <ClockWidget />

      {/* TOMBOL MUTE / QUIET MODE */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
        className="absolute top-6 right-6 z-[100] p-4 bg-black/40 backdrop-blur-md border border-white/20 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:bg-white/10 transition-all cursor-pointer"
        title="Matikan/Nyalakan Suara"
      >
        {isMuted ? <VolumeX className="w-8 h-8 text-red-400" /> : <Volume2 className="w-8 h-8 text-green-400" />}
      </button>

      {/* MODAL PERINGATAN TIMEOUT */}
      <AnimatePresence>
        {showTimeoutWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-white/10 p-10 rounded-[40px] border border-white/20 text-center shadow-2xl w-[500px]">
              <h2 className="text-3xl font-bold text-white mb-4">Masih di sana?</h2>
              <p className="text-xl text-gray-300 mb-8">Sesi Anda akan direset dalam <span className="text-red-400 font-bold text-3xl">{countdown}</span> detik.</p>
              <button onClick={startIdleTimer} className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full text-xl font-bold transition-all shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-95">Ya, Saya Masih Mengisi</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAYS GELAP DINAMIS */}
      <AnimatePresence>
        {step > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />}
      </AnimatePresence>

      {/* KAMERA TERSEMBUNYI */}
{/* Matikan kamera jika sedang scanning ATAU jika Intercom sedang menyala */}
      {!isScanning && !showIntercom && (
        <div className="absolute top-0 left-0 opacity-0 pointer-events-none z-0">
          <Webcam 
            audio={false} 
            ref={webcamRef} 
            screenshotFormat="image/jpeg" 
            videoConstraints={{ facingMode: "user" }} 
          />
        </div>
      )}

{/* MAIN CONTENT UI */}
      
      {/* ================= OVERLAY SCANNER QR (DIPISAH DARI mode="wait") ================= */}
      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="bg-white/10 p-8 rounded-[40px] border border-white/20 shadow-2xl flex flex-col items-center w-[400px]">
              <h2 className="text-2xl font-bold text-white mb-2">Scan QR Code</h2>
              <p className="text-gray-400 text-center mb-8">Arahkan QR Code ke kamera Kiosk</p>
              <div className="w-full aspect-square rounded-3xl overflow-hidden border-4 border-red-500/50 relative">
                <Scanner onScan={handleScan} components={{ finder: false }} />
                <motion.div animate={{ top: ["0%", "100%", "0%"] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className="absolute left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(220,38,38,1)] z-10" />
              </div>
              <button onClick={() => setIsScanning(false)} className="mt-8 px-10 py-3 bg-white/10 text-white font-semibold rounded-full border border-white/20">Batal</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* ================= LAYAR 0: IDLE ================= */}
        {step === 0 && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-end pb-24 z-20">
            <motion.div animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="px-10 py-5 bg-red-600/90 backdrop-blur-md border border-red-400/50 text-white rounded-full text-2xl font-bold shadow-[0_0_40px_rgba(220,38,38,0.6)] flex items-center gap-3 cursor-pointer" onClick={handleStartKiosk}>
              Sentuh Layar Untuk Memulai <ChevronRight className="w-8 h-8" />
            </motion.div>
            <div className="flex gap-4 mt-6">
  {/* Tombol VIP */}
  <motion.button 
    onClick={() => setShowPinInput(true)}
    className="px-6 py-3 bg-amber-500/20 backdrop-blur-md border border-amber-500/50 text-amber-400 rounded-full text-lg font-semibold flex items-center gap-3"
  >
    <Star className="w-6 h-6" /> Jalur VIP (PIN)
  </motion.button>

  {/* Tombol Scan KTP (Tersedia di Layar Pengisian Data/Layar 1) */}
</div>

{/* MODAL INPUT PIN VIP */}
<AnimatePresence>
  {showPinInput && (
    <motion.div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md">
       <div className="bg-white/10 p-10 rounded-[40px] border border-white/20 text-center w-[400px]">
          <h2 className="text-2xl font-bold text-white mb-6">Masukkan PIN VIP</h2>
          <input 
            type="password" 
            value={vipPin}
            onChange={(e) => setVipPin(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-white text-3xl text-center mb-6"
            placeholder="******"
          />
          <div className="flex gap-4">
            <button onClick={() => setShowPinInput(false)} className="flex-1 py-3 bg-white/10 text-white rounded-full">Batal</button>
            <button onClick={checkVipPin} className="flex-1 py-3 bg-amber-500 text-black font-bold rounded-full">Masuk</button>
          </div>
       </div>
    </motion.div>
  )}
</AnimatePresence>
            <motion.button onClick={(e) => { e.stopPropagation(); setIsScanning(true); if (scanVoiceRef.current && !isMuted) scanVoiceRef.current.play(); }} className="mt-6 px-6 py-3 bg-black/40 backdrop-blur-md border border-white/20 text-white rounded-full text-lg font-semibold flex items-center gap-3 hover:bg-black/60 transition-all cursor-pointer">
              <QrCode className="w-6 h-6 text-red-400" /> Punya QR Code? Scan di Sini
            </motion.button>
          </motion.div>
        )}

        {/* ================= LAYAR 1: DATA PELANGGAN ================= */}
        {/* ================= LAYAR 1: DATA PELANGGAN ================= */}
{step === 1 && (
          <motion.div key="step1" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-5xl z-20">
            {/* INI KUNCI AUTO-SCROLL: Wrapper ini yang akan bergeser y: shiftY */}
            <motion.div animate={{ y: shiftY }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-white/10 backdrop-blur-2xl border border-white/20 p-12 rounded-[40px] shadow-2xl">
              
              {/* ================= AREA HEADER & TOMBOL SCAN KTP ================= */}
              <div className="mb-8 pb-4 border-b-2 border-red-500/50 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">{greeting}, silakan isi data Anda</h2>
                </div>
                
                {/* TOMBOL AI OCR KTP */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleScanKTP}
                  disabled={isOcrLoading}
                  className={`px-6 py-3 rounded-xl flex items-center gap-3 font-bold transition-all border ${
                    isOcrLoading 
                      ? "bg-gray-600/50 text-gray-300 border-gray-400/30 cursor-not-allowed"
                      : "bg-blue-600/80 hover:bg-blue-500 text-white border-blue-400/50 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                  }`}
                >
                  {isOcrLoading ? (
                    <div className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/><path d="M7 12h10"/></svg>
                  )}
                  {isOcrLoading ? "Membaca KTP..." : "Scan KTP Otomatis"}
                </motion.button>
              </div>
              {/* ================================================================= */}

              
              <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                <div className="space-y-8">
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Building className="w-6 h-6 text-red-400" /> Nama Instansi <span className="text-red-500">*</span></label>
                    <motion.div animate={errors.institution ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}}>
                      <input {...register("institution", { required: true })} onFocus={() => { setActiveInput("institution"); setKeyboardOpen(true); }} value={watch("institution") || ""} className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none text-white transition-all ${errors.institution ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`} placeholder="Contoh: Telkom" autoComplete="off" />
                    </motion.div>
                  </div>
                  
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><User className="w-6 h-6 text-red-400" /> Nama Pengunjung <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                      <div className="relative w-40">
                        <select {...register("salutation")} className="w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl outline-none text-white appearance-none cursor-pointer focus:border-red-500 transition-all">
                          <option value="Bapak" className="bg-gray-800">Bapak</option>
                          <option value="Ibu" className="bg-gray-800">Ibu</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 pointer-events-none" />
                      </div>
                      
                      <motion.div animate={errors.fullName ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}} className="flex-1">
                        <input {...register("fullName", { required: true })} onFocus={() => { setActiveInput("fullName"); setKeyboardOpen(true); }} value={watch("fullName") || ""} className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none text-white ${errors.fullName ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`} placeholder="Contoh: Nita" autoComplete="off" />
                      </motion.div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Phone className="w-6 h-6 text-red-400" /> No. HP PIC <span className="text-red-500">*</span></label>
                      <motion.div animate={errors.phoneNumber ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}}>
                        <input type="tel" {...register("phoneNumber", { required: true })} onFocus={() => { setActiveInput("phoneNumber"); setKeyboardOpen(true); }} onChange={(e) => { const formatted = formatPhone(e.target.value); setValue("phoneNumber", formatted, { shouldValidate: true }); if (keyboardRef.current && activeInput === "phoneNumber") keyboardRef.current.setInput(formatted); }} value={watch("phoneNumber") || ""} className={`w-full text-2xl p-5 bg-black/30 border rounded-xl outline-none text-white ${errors.phoneNumber ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`} placeholder="0812..." autoComplete="off" />
                      </motion.div>
                    </div>
                    <div>
                      <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Hash className="w-6 h-6 text-red-400" /> No. Internet <span className="text-red-500">*</span></label>
                      <motion.div animate={errors.internetNumber ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}}>
                        <input type="text" {...register("internetNumber", { required: true })} onFocus={() => { setActiveInput("internetNumber"); setKeyboardOpen(true); }} value={watch("internetNumber") || ""} className={`w-full text-2xl p-5 bg-black/30 border border-white/20 rounded-xl outline-none text-white ${errors.internetNumber ? 'border-red-500 bg-red-500/10' : 'focus:border-red-500'}`} placeholder="Contoh: 1412..." autoComplete="off" />
                      </motion.div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><MapPin className="w-6 h-6 text-red-400" /> Alamat Customer</label>
                    <input type="text" {...register("address")} onFocus={() => { setActiveInput("address"); setKeyboardOpen(true); }} value={watch("address") || ""} className="w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl outline-none text-white focus:border-red-500 transition-all" placeholder="Jl. Cik Ditiro" autoComplete="off" />
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-between">
                <button onClick={() => setStep(0)} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white transition-all">Batal</button>
                <button onClick={handleNext} className="px-12 py-5 bg-red-600 text-white text-xl font-bold rounded-xl flex items-center gap-3 hover:bg-red-500 transition-all">Lanjut <ChevronRight className="w-6 h-6" /></button>
              </div>

            </motion.div>
          </motion.div>
        )}

        {/* ================= LAYAR 2: DETAIL KUNJUNGAN ================= */}
        {step === 2 && (
          <motion.div key="step2" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-6xl z-20">
            {/* Auto Scroll Wrapper Layar 2 */}
            <motion.div animate={{ y: shiftY }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[40px] shadow-2xl">
              
              <div className="mb-6 border-b-2 border-red-500/50 w-72 pb-2"><h2 className="text-3xl font-bold text-white tracking-tight">Tujuan Kunjungan</h2></div>
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-7 space-y-4">
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-1"><Tag className="w-6 h-6 text-red-400" /> Kategori <span className="text-red-500">*</span></label>
                  <motion.div animate={errors.category ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}} className="grid grid-cols-3 gap-3">
                    {KATEGORI_KUNJUNGAN.map((kat) => (
                      <motion.div key={kat.id} whileTap={{ scale: 0.95 }} onClick={() => { setSelectedCategory(kat.label); setValue("category", kat.label, { shouldValidate: true }); setKeyboardOpen(false); }} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 h-28 ${selectedCategory === kat.label ? "bg-red-600/80 border-red-400 shadow-[0_0_25px_rgba(220,38,38,0.5)]" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                        <span className="text-3xl">{kat.icon}</span><span className={`text-xs font-bold leading-tight ${selectedCategory === kat.label ? "text-white" : "text-gray-300"}`}>{kat.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                  <input type="hidden" {...register("category", { required: true })} />
                </div>
                <div className="col-span-5 space-y-6">
                  <div><label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Contact className="w-6 h-6 text-red-400" /> Petugas Dituju</label><input {...register("hostName")} onFocus={() => { setActiveInput("hostName"); setKeyboardOpen(true); }} value={watch("hostName") || ""} className="w-full text-xl p-5 bg-black/30 border border-white/10 rounded-2xl outline-none text-white focus:border-red-500" placeholder="Nita Wulandari" autoComplete="off" /></div>
                  <div><label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Target className="w-6 h-6 text-red-400" /> Maksud Tujuan</label><textarea {...register("purpose")} onFocus={() => { setActiveInput("purpose"); setKeyboardOpen(true); }} value={watch("purpose") || ""} className="w-full text-lg p-5 bg-black/30 border border-white/10 rounded-2xl outline-none text-white min-h-[160px] resize-none focus:border-red-500" placeholder="Kenapa terjadi gangguan..." /></div>
                </div>
              </div>
              <div className="mt-8 p-4 bg-black/20 rounded-2xl border border-white/5">
                <label className="flex items-start gap-4 cursor-pointer group">
                  <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="h-7 w-7 rounded-lg border-2 border-white/20 bg-black/40 accent-red-600 cursor-pointer" />
                  <p className="text-gray-300 text-lg leading-snug">Saya setuju data saya digunakan untuk administrasi di <span className="text-red-400 font-bold">Telkom Witel Sulbagteng</span>.</p>
                </label>
              </div>
              <div className="mt-10 flex justify-between items-center">
                <button onClick={() => setStep(1)} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white flex items-center gap-2"><ChevronLeft className="w-6 h-6" /> Kembali</button>
                <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || !isAgreed} className={`px-14 py-5 text-white text-xl font-bold rounded-2xl backdrop-blur-md border border-white/20 shadow-xl transition-all ${(isSubmitting || !isAgreed) ? 'bg-gray-600/50 opacity-50 grayscale' : 'bg-red-600/90 hover:bg-red-500'}`}>{isSubmitting ? 'Menyimpan...' : 'Selesai & Kirim'}</button>
              </div>

            </motion.div>
          </motion.div>
        )}

{/* ================= LAYAR 3: SUCCESS & QR CODE ================= */}
        {step === 3 && (
          <motion.div key="step3" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col w-full max-w-5xl z-20">
            <div className="flex w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl overflow-hidden">
              <div className="flex-1 p-16 flex flex-col items-center justify-center text-center border-r border-white/10">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="bg-green-500/20 rounded-full p-4 mb-8">
                  <CheckCircle className="w-32 h-32 text-green-400" />
                </motion.div>
                <h2 className="text-5xl font-bold text-white mb-4">Pendaftaran Berhasil!</h2>
                <p className="text-2xl text-gray-300">Mohon tunggu sebentar, petugas kami akan menemui Anda.</p>
                
                {/* ================= AREA TOMBOL AKSI ================= */}
                <div className="mt-12 flex flex-row gap-6 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowPhotobooth(true)}
                    className="px-8 py-5 bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-3"
                  >
                    <span className="text-2xl">📸</span> Buka Photobooth
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStep(4)}
                    className="px-8 py-5 bg-green-600 text-white text-xl font-bold rounded-2xl shadow-lg shadow-green-900/20 hover:bg-green-500 transition-all"
                  >
                    Selesai & Beri Rating
                  </motion.button>
                </div>
                {/* ==================================================== */}

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
                    size={180} 
                    level="H" 
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= STEP 4: RATING KEPUASAN (CSAT) ================= */}
{step === 4 && (
  <motion.div key="step4" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-5xl z-20">
    <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-12 rounded-[40px] shadow-2xl flex flex-col items-center justify-center min-h-[500px]">
      
      {!ratingSubmitted ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center w-full">
          <h2 className="text-4xl font-bold text-white mb-4">Langkah Terakhir</h2>
          <h3 className="text-xl text-gray-300 mb-12">
            Bagaimana pengalaman Anda menggunakan layanan Kiosk ini?
          </h3>
          
          <div className="flex justify-center gap-8">
            {[
              { score: 1, emoji: "😡", label: "Buruk" },
              { score: 2, emoji: "🙁", label: "Kurang" },
              { score: 3, emoji: "😐", label: "Cukup" },
              { score: 4, emoji: "🙂", label: "Baik" },
              { score: 5, emoji: "😍", label: "Sangat Baik" }
            ].map((item) => (
              <motion.button
                key={item.score}
                whileHover={{ scale: 1.2, y: -10 }}
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  setRatingSubmitted(true);
                  // UNCOMMENT NANTI SAAT ID SUDAH SIAP:
                  await submitVisitorRating(currentVisitorId, item.score);

                  // Opsional: Otomatis kembali ke layar awal (Step 0) setelah 3 detik
setTimeout(() => {
  setStep(0);
  setRatingSubmitted(false);
  setCurrentVisitorId(""); 
  reset(); // dari react-hook-form
  // + Tambahkan reset state bawaan Anda yang tertinggal:
  setPhotoBase64(null);
  setIsAgreed(false);
  setSelectedCategory("");
}, 3000);
                }}
                className="flex flex-col items-center gap-4 group"
              >
                <span className="text-7xl filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300">
                  {item.emoji}
                </span>
                <span className="text-lg font-medium text-gray-400 group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </motion.button>
            ))}
          </div>

          <div className="mt-16">
<button onClick={() => {
  setStep(0);
  setRatingSubmitted(false);
  setCurrentVisitorId("");
  reset();
  setPhotoBase64(null);
  setIsAgreed(false);
  setSelectedCategory("");
}} className="text-gray-400 hover:text-white transition-colors">
  Lewati (Tutup)
</button>
          </div>
        </motion.div>

      ) : (

        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-6 text-center">
          <div className="inline-flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center text-5xl mb-4">
              🎉
            </div>
            <h2 className="text-3xl font-bold text-white">Terima Kasih!</h2>
            <p className="text-xl text-gray-300">Penilaian Anda sangat berarti bagi pengembangan Telkom.</p>
            <p className="text-sm text-gray-500 mt-4">Kiosk akan kembali ke layar awal dalam beberapa detik...</p>
          </div>
        </motion.div>

      )}

    </div>
  </motion.div>
)}

{/* ================= MODAL PHOTOBOOTH ================= */}
<AnimatePresence>
  {showPhotobooth && (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-10"
    >
      <div className="bg-white/10 p-8 rounded-[40px] border border-white/20 shadow-2xl flex gap-10 max-w-6xl w-full">
        
        {/* KIRI: Area Kamera / Hasil */}
        <div className="flex-1 relative overflow-hidden rounded-3xl bg-black border-4 border-red-500/50">
          {!photoboothResult ? (
            <>
              {/* Webcam Live */}
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover scale-x-[-1]" />
              {/* Preview Bingkai transparan di atas kamera live */}
              <img src="/frame-telkom.png" alt="frame" className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10" />
            </>
          ) : (
             <img src={photoboothResult} alt="Hasil Photobooth" className="w-full h-full object-cover" />
          )}
        </div>

        {/* KANAN: Kontrol & QR Code */}
        <div className="w-[350px] flex flex-col justify-center text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Telkom Photobooth</h2>
          <p className="text-gray-400 mb-8">Buat kenang-kenangan kunjungan Anda hari ini!</p>

{!photoboothResult ? (
            <div className="flex flex-col gap-4">
               <button onClick={handleCapturePhotobooth} className="py-6 bg-red-600 text-white font-bold text-2xl rounded-2xl shadow-lg shadow-red-900/30 hover:bg-red-500 transition-all">📸 Jepret Foto!</button>
               <button onClick={() => setShowPhotobooth(false)} className="py-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all">Batal / Tutup</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              
              {/* AREA QR CODE / LOADING */}
              <div className="p-4 bg-white rounded-2xl shadow-lg w-[232px] h-[232px] flex items-center justify-center">
                {isUploadingPhoto ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full"></div>
                    <span className="text-gray-500 font-semibold text-sm animate-pulse">Menyiapkan QR Code...</span>
                  </div>
                ) : photoboothUrl ? (
                  <QRCodeCanvas value={photoboothUrl} size={200} level="H" />
                ) : (
                  <span className="text-red-500 text-sm font-bold">Gagal memuat QR</span>
                )}
              </div>

              {/* INSTRUKSI */}
              <div className="text-center">
                {isUploadingPhoto ? (
                  <p className="text-sm text-yellow-400 font-semibold">Sedang mengunggah ke server Telkom...</p>
                ) : photoboothUrl ? (
                  <p className="text-sm text-green-400 font-bold">Scan QR di atas untuk menyimpan foto ke HP Anda!</p>
                ) : (
                  <p className="text-sm text-red-400">Terjadi kesalahan jaringan.</p>
                )}
              </div>
              
              {/* TOMBOL KONTROL */}
              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => {
                    setPhotoboothResult(null);
                    setPhotoboothUrl(null); // Reset URL saat foto ulang
                  }} 
                  disabled={isUploadingPhoto}
                  className={`flex-1 py-3 text-white font-semibold rounded-xl transition-all ${isUploadingPhoto ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  Ulangi
                </button>
                <button 
                  onClick={() => {
                    setShowPhotobooth(false);
                    setPhotoboothResult(null);
                    setPhotoboothUrl(null);
                  }} 
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-500 transition-all"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  )}
</AnimatePresence>

{/* ================= TOMBOL BANTUAN DARURAT (MUNCUL JIKA STEP 0 ATAU 1) ================= */}
      {step < 2 && !showIntercom && (
        <motion.button
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setShowIntercom(true)}
          className="fixed bottom-10 right-10 z-50 bg-red-600 p-6 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center justify-center group"
        >
          <Headset className="w-10 h-10 text-white animate-pulse group-hover:animate-none" />
        </motion.button>
      )}

{/* ================= MODAL VIDEO CALL ZEGO ================= */}
          <AnimatePresence>
            {showIntercom && (
              <motion.div
                initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                className="fixed inset-0 z-[300] flex items-center justify-center p-10 
                bg-gray-700/40 backdrop-blur-md 
                border border-white/20 
                rounded-xl 
                shadow-[0_0_30px_rgba(0,0,0,0.4)]"
              >
                {/* --- KONTAINER GLASSMORPH TERBARU --- */}
<div className="w-[95vw] max-w-7xl h-[85vh] flex flex-col p-8 rounded-[40px] border border-white/10 bg-gray-800/15 backdrop-blur-[30px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
                  
                  {/* Header (Teks & Tombol) */}
                  <div className="flex justify-between items-center mb-6 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                      <h2 className="text-3xl font-bold text-white tracking-tight">Layanan Bantuan Langsung</h2>
                    </div>
                    <button onClick={() => setShowIntercom(false)} 
                            className="px-6 py-3 bg-gray-600/50 hover:bg-gray-500/50 text-white rounded-xl font-semibold transition-all">
                      Tutup Panggilan
                    </button>
                  </div>

                  {/* AREA VIDEO ZEGO DI-RENDER DI SINI */}
                  <div className="flex-1 w-full relative">
                    <div className="absolute inset-0 bg-black/40 border border-white/5 rounded-[32px] overflow-hidden">
                      <ZegoCall roomID="ruang-bantuan-telkom" onClose={() => setShowIntercom(false)} />
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

      {/* ================= 5. GLASSMORPH VIRTUAL KEYBOARD ================= */}
      <AnimatePresence>
        {keyboardOpen && step > 0 && step < 3 && (
        <motion.div 
            initial={{ y: 80, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 80, opacity: 0 }} 
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }} 
            className={`absolute bottom-0 z-50 p-6 bg-white/5 backdrop-blur-3xl border-t border-x border-white/20 rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transition-all ${isNumericInput ? 'w-full max-w-md' : 'w-full max-w-6xl'}`}
          >
            <div className="flex justify-between items-center mb-4 px-6">
              <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div><span className="text-white/60 font-semibold text-sm uppercase tracking-widest">{isNumericInput ? "Keyboard Angka" : "Keyboard Layar Sentuh"}</span></div>
              <button onClick={() => setKeyboardOpen(false)} className="text-white font-bold px-6 py-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-all shadow-lg text-sm border border-red-400/50">TUTUP</button>
            </div>
            
            <div className={`glass-keyboard-container rounded-3xl overflow-hidden p-2 ${isNumericInput ? 'numpad-style' : ''}`}>
              <Keyboard 
                keyboardRef={r => (keyboardRef.current = r)} 
                layoutName={currentLayoutName} 
                layout={customKeyboardLayouts}
                display={{
                  "{bksp}": "⌫ Hapus",
                  "{enter}": "Selesai ↵",
                  "{shift}": "⇧ Caps",
                  "{space}": "Spasi"
                }}
                onChange={onKeyboardChange} 
                onKeyPress={onKeyboardKeyPress} 
                inputName={activeInput} 
                theme="hg-theme-default hg-layout-default custom-glass-theme" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Style untuk Keyboard Tembus Pandang & Numpad Raksasa */}
      <style jsx global>{`
        .custom-glass-theme { background: transparent !important; font-family: inherit; }
        .hg-button { background: rgba(255, 255, 255, 0.1) !important; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1) !important; color: white !important; border-radius: 12px !important; box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important; height: 60px !important; font-size: 1.2rem !important; font-weight: 600 !important; transition: all 0.2s ease !important; }
        .hg-button:active { background: rgba(255, 255, 255, 0.3) !important; transform: scale(0.95); }
        .hg-button.hg-functionBtn { background: rgba(239, 68, 68, 0.2) !important; color: #f87171 !important; }
        
        /* CSS Khusus Numpad Angka Cerdas */
        .numpad-style .hg-button {
          height: 80px !important;
          font-size: 2rem !important;
          font-weight: bold !important;
        }
        .numpad-style .hg-button-bksp, .numpad-style .hg-button-enter {
          font-size: 1.2rem !important;
          background: rgba(239, 68, 68, 0.3) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
}