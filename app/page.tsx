"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Webcam from "react-webcam";
import { Headset,Search, Hash, Star, User, Building, Target, CheckCircle, ChevronRight, ChevronLeft, ChevronDown, Phone, MapPin, Tag, Contact, QrCode, Volume2, VolumeX, XCircle, AlertTriangle, Smartphone, X,} from "lucide-react";
import { getVisitorByPinAction, submitVisitorData, performOCR, submitVisitorRating, uploadPhotoboothImage } from "./actions/kiosk";
import dynamic from "next/dynamic";
import { QRCodeCanvas } from "qrcode.react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { Scanner } from "@yudiel/react-qr-scanner";
import { confirmMobileArrivalAction } from "./actions/kiosk";
import NextImage from "next/image"; // Menggunakan alias 'NextImage'

const ZegoCall = dynamic(() => import("./components/ZegoCall"), { 
  ssr: false 
});

const slideVariants: Variants = {
  hidden: { x: 50, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { x: -50, opacity: 0, transition: { duration: 0.4 } }
};

const KATEGORI_KUNJUNGAN = [
  { id: "gangguan", label: "Lapor Gangguan", icon: "⚠️" },
  { id: "psb", label: "Permintaan Pasang Baru (PSB)", icon: "🏠" },
  { id: "pindah", label: "Permintaan Pindah Alamat", icon: "🚚" },
  { id: "modify", label: "Permintaan Modify (Upgrade & Downgrade)", icon: "📈" },
  { id: "cabut", label: "Permintaan Cabut (DO)", icon: "❌" },
  { id: "invoice", label: "Invoicing", icon: "💳" },
  { id: "spj", label: "TTD SPJ", icon: "📝" },
  { id: "kabel", label: "Benah Tiang / Kabel", icon: "🛠️" }
];

type KioskFormValues = {
  salutation: string;
  fullName: string;
  phoneNumber: string;
  institution: string;
  internetNumber: string;
  address: string;
  category: string;
  hostName: string;
  purpose: string;
};

type TouchKeyboardRef = {
  setInput: (input: string) => void;
};

const formatPhone = (val: string) => {
  if (!val) return "";
  const raw = val.replace(/\D/g, ''); 
  const match = raw.match(/^(\d{0,4})(\d{0,4})(\d{0,5})$/);
  if (match) {
    return !match[2] ? match[1] : `${match[1]}-${match[2]}` + (match[3] ? `-${match[3]}` : '');
  }
  return raw;
};

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
};

const ClockWidget = () => {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const initialTimer = setTimeout(() => setTime(new Date()), 0);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);

  if (!time) return null; 

  const timeString = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateString = time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex items-center justify-center gap-6 bg-gray-800/80 backdrop-blur-xl px-10 pt-2 pb-4 rounded-b-[2.5rem] border-b border-x border-white/20 shadow-[0_15px_30px_rgba(0,0,0,0.4)]">
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

  // --- MULAI KODE BARU ---
  const [kioskStatus, setKioskStatus] = useState<{ isBusy: boolean; message: string } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { getKioskStatusAction } = await import("./actions/kiosk");
        const status = await getKioskStatusAction();
        if (status) {
          setKioskStatus(status);
        }
      } catch (error) {
        console.error("Gagal mengambil status Kiosk:", error);
      }
    };

    fetchStatus(); 
    const intervalId = setInterval(fetchStatus, 3000); 
    
    return () => clearInterval(intervalId);
  }, []);
  // --- AKHIR KODE BARU ---

  const openFinpayPopup = () => {
    // Mengatur ukuran popup
    const width = 600;
    const height = 700;
    
    // Menghitung posisi agar popup berada di tengah layar
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);
    
    // Membuka popup
    window.open(
      "https://live.finpay.id/widgetpg/001001/indibiz",
      "FinpayWindow",
      `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,status=no`
    );
  };

  const [showIntercom, setShowIntercom] = useState(false);
  const [showPhotobooth, setShowPhotobooth] = useState(false);
  const [photoboothResult, setPhotoboothResult] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoboothUrl, setPhotoboothUrl] = useState<string | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [currentVisitorId, setCurrentVisitorId] = useState<string>("");
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [vipPin, setVipPin] = useState("");
  const [previewCameraKey, setPreviewCameraKey] = useState(0);
  const [photoboothCameraKey, setPhotoboothCameraKey] = useState(0);
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [showFinpayModal, setShowFinpayModal] = useState(false);
  
  const previewWebcamRef = useRef<Webcam>(null);
  const photoboothWebcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement>(null); 
  const voiceRef = useRef<HTMLAudioElement>(null);
  const successVoiceRef = useRef<HTMLAudioElement>(null);
  const scanVoiceRef = useRef<HTMLAudioElement>(null);
  
  // ================= SISTEM AUDIO EFEK (BARU) =================
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);

// FUNGSI PLAYBEEP SUPER CEPAT (TANPA LATENSI)
  const playBeep = () => {
    if (isMuted) return; // Jangan putar jika Kiosk sedang mode hening
    
    // Kita buat objek memori baru setiap kali ditekan agar bisa bertumpuk instan!
    const beep = new Audio("/sounds/beep.mp3");
    beep.volume = 0.3; // Volume kita buat 50% agar tidak memekakkan telinga jika diketik cepat
    beep.play().catch((err) => console.log("Audio terblokir:", err));
  };
  const playErrorSound = () => {
   if (isMuted) return; // Jangan putar jika Kiosk sedang mode hening
    
    // Kita buat objek memori baru setiap kali ditekan agar bisa bertumpuk instan!
    const beep = new Audio("/sounds/error.mp3");
    beep.volume = 1; // Volume kita buat 50% agar tidak memekakkan telinga jika diketik cepat
    beep.play().catch((err) => console.log("Audio terblokir:", err));
  };
  const playSuccessSound = () => {
    if (isMuted) return; // Jangan putar jika Kiosk sedang mode hening
    
    // Kita buat objek memori baru setiap kali ditekan agar bisa bertumpuk instan!
    const beep = new Audio("/sounds/succes.mp3");
    beep.volume = 1; // Volume kita buat 50% agar tidak memekakkan telinga jika diketik cepat
    beep.play().catch((err) => console.log("Audio terblokir:", err));
  };

  // ================= SISTEM ALERT PINTAR =================
  const [alertData, setAlertData] = useState<{ show: boolean, type: "success" | "error" | "warning", title: string, message: string }>({ show: false, type: "success", title: "", message: "" });
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isWarningRef = useRef(false);

  const customAlert = (type: "success" | "error" | "warning", title: string, message: string) => {
    // TRIGGER SUARA OTOMATIS BERDASARKAN TIPE ALERT
    if (type === "error" || type === "warning") playErrorSound();
    if (type === "success") playSuccessSound();

    setAlertData({ show: true, type, title, message });
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => { setAlertData(prev => ({ ...prev, show: false })); }, 4500);
  };
  // =======================================================

  const keyboardRef = useRef<TouchKeyboardRef | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<keyof KioskFormValues | "vipPin">("fullName"); 
  const [keyboardLayoutName, setKeyboardLayoutName] = useState("default"); 
  const [isMuted, setIsMuted] = useState(false); 
  const [ripples, setRipples] = useState<{ id: number, x: number, y: number }[]>([]); 

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAgreed, setIsAgreed] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);
  const [isCsBusy, setIsCsBusy] = useState<boolean>(false);
  const [busyMessage, setBusyMessage] = useState<string>("");

const checkKioskLock = async () => {
    // 👇 UBAH IMPORT DARI "./actions/admin" MENJADI "./actions/kiosk"
    const { getKioskStatusAction } = await import("./actions/kiosk");
    const status = await getKioskStatusAction();
    
    // Gunakan status?.isBusy (tambahkan tanda tanya agar lebih aman)
    if (status?.isBusy) {
      setBusyMessage(status.message);
      setIsCsBusy(true);
      // Mainkan suara error agar Kiosk memberi sinyal penolakan
      if (errorAudioRef.current && !isMuted) {
        errorAudioRef.current.currentTime = 0;
        errorAudioRef.current.play().catch(() => {});
      }
      return true; // Terkunci
    }
    return false; // Aman
  };

  const [countdown, setCountdown] = useState(10);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, trigger, setValue, getValues, watch } = useForm<KioskFormValues>(); 

  useEffect(() => {
    if (audioRef.current) { audioRef.current.volume = 0.3; audioRef.current.play().catch(() => {}); }
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
    if (voiceRef.current) voiceRef.current.muted = isMuted;
    if (successVoiceRef.current) successVoiceRef.current.muted = isMuted;
    if (scanVoiceRef.current) scanVoiceRef.current.muted = isMuted;
    if (beepAudioRef.current) beepAudioRef.current.muted = isMuted; 
    if (errorAudioRef.current) errorAudioRef.current.muted = isMuted; // Sync Mute
    if (successAudioRef.current) successAudioRef.current.muted = isMuted; // Sync Mute
  }, [isMuted]);

  const retryPreviewCamera = () => {
    setPreviewCameraKey((value) => value + 1);
  };

  const retryPhotoboothCamera = () => {
    setPhotoboothCameraKey((value) => value + 1);
  };

  useEffect(() => {
    if (step > 0) {
      retryPreviewCamera();
    }
  }, [step]);

  useEffect(() => {
    if (showPhotobooth) {
      retryPhotoboothCamera();
    }
  }, [showPhotobooth]);

  const currentHour = new Date().getHours();
  let greeting = "Selamat Malam";
  if (currentHour >= 5 && currentHour < 11) greeting = "Selamat Pagi";
  else if (currentHour >= 11 && currentHour < 15) greeting = "Selamat Siang";
  else if (currentHour >= 15 && currentHour < 18) greeting = "Selamat Sore";

  const handleCapturePhotobooth = () => {
    if (!photoboothWebcamRef.current) return;
    const webcamImageSrc = photoboothWebcamRef.current.getScreenshot();
    if (!webcamImageSrc) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const webcamImg = new Image();
    const frameImg = new Image();

    webcamImg.onload = () => {
      canvas.width = webcamImg.width;
      canvas.height = webcamImg.height;
      ctx?.drawImage(webcamImg, 0, 0, canvas.width, canvas.height);

      frameImg.onload = async () => {
        ctx?.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
        const finalImage = canvas.toDataURL("image/jpeg", 0.9);
        
        setPhotoboothResult(finalImage); 
        setIsUploadingPhoto(true);
        try {
          const response = await uploadPhotoboothImage(finalImage);
          if (response.success && response.url) {
            setPhotoboothUrl(response.url);
            playSuccessSound(); // Bunyi berhasil saat QR muncul
          } else {
            customAlert("error", "Gagal Mengunggah", "Tidak dapat menyimpan foto ke server Telkom.");
          }
        } catch {
          customAlert("error", "Gagal Mengunggah", "Terjadi kesalahan koneksi saat mengunggah foto.");
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      frameImg.src = "/frame-telkom.png"; 
    };
    webcamImg.src = webcamImageSrc;
  };

const checkVipPin = async () => {
    if (!vipPin) return;

    try {
      // Kiosk HANYA mengirimkan PIN. Sangat ringan dan instan!
      const result = await confirmMobileArrivalAction(vipPin);

      if (result.success && result.data) {
        setValue("fullName", result.data.fullName);
        setValue("institution", result.data.institution || "Umum");
        setValue("phoneNumber", result.data.phoneNumber || "");
        
        setCurrentVisitorId(result.data.id); 
        setQueueNumber(result.queueNumber); 

        setStep(3); 
        
        setShowPinInput(false);
        setKeyboardOpen(false);
        setVipPin("");
        if (keyboardRef.current) keyboardRef.current.setInput("");
        
        if (successVoiceRef.current && !isMuted) {
          successVoiceRef.current.currentTime = 0;
          successVoiceRef.current.play().catch(() => {});
        }
        customAlert("success", "Prapendaftaran Terkonfirmasi", `Selamat datang, ${result.data.fullName}! Antrean Anda mulai berjalan.`);

      } else {
        customAlert("error", "Akses Ditolak", result.message || "PIN tidak valid.");
        setVipPin("");
        if (keyboardRef.current) keyboardRef.current.setInput("");
      }
    } catch (error) {
      customAlert("error", "Koneksi Terputus", "Gagal menghubungi server database.");
      setVipPin("");
    } 
  };

  const handleScanKTP = async () => {
    if (!previewWebcamRef.current) return;
    setIsOcrLoading(true);
    const imageSrc = previewWebcamRef.current.getScreenshot();
    
    if (imageSrc) {
      try {
        const result = await performOCR(imageSrc);
        if (result.success && result.text) {
          const text = result.text;
          const lines = text.split('\n').map((l: string) => l.trim().toUpperCase()).filter((l: string) => l.length > 0);
          let extractedName = ""; let extractedAddress = "";

          const nikIdx = lines.findIndex((l: string) => /\d{16}/.test(l));
          if (nikIdx !== -1 && lines[nikIdx + 1]) extractedName = lines[nikIdx + 1].replace(/[:;|]/g, "").trim();
          else {
            const nameIdx = lines.findIndex((l: string) => l.includes("NAMA") || l.includes("N A M A"));
            if (nameIdx !== -1 && lines[nameIdx + 1]) extractedName = lines[nameIdx + 1].replace(/[:;|]/g, "").trim();
          }

          const addrIdx = lines.findIndex((l: string) => l.includes("ALAMAT") || l.includes("RT") || l.includes("RW"));
          if (addrIdx !== -1) {
            extractedAddress = lines[addrIdx].replace(/A L A M A T|ALAMAT|[:;|]/g, "").trim();
            if (!extractedAddress && lines[addrIdx + 1]) extractedAddress = lines[addrIdx + 1].replace(/[:;|]/g, "").trim();
          }

          if (extractedName) setValue("fullName", extractedName, { shouldValidate: true, shouldDirty: true });
          if (extractedAddress) setValue("address", extractedAddress, { shouldValidate: true, shouldDirty: true });
          
          if (extractedName || extractedAddress) customAlert("success", "KTP Terdeteksi", "Sebagian data berhasil diekstrak. Silakan lengkapi sisanya.");
          else customAlert("error", "KTP Kurang Jelas", "KTP terlalu gelap atau buram. Silakan dekatkan ke kamera atau ketik manual.");
        } else {
          customAlert("error", "Gagal Membaca KTP", "Sistem tidak dapat membaca teks. Pastikan KTP tidak memantulkan cahaya.");
        }
      } catch {
        customAlert("error", "Gangguan Jaringan", "Gagal terhubung ke AI. Periksa koneksi internet.");
      } finally {
        setIsOcrLoading(false);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const newRipple = { id: Date.now(), x: e.clientX, y: e.clientY };
    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 600);
  };

const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    setShowTimeoutWarning(false);
    isWarningRef.current = false; // Update detektif
    setCountdown(10);

    // Ingat: Ubah angka 2000 di bawah ini menjadi 60000 saat Production nanti!
    if (step > 0 && step < 4) {
      idleTimerRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
        isWarningRef.current = true; // Tandai bahwa layar warning sedang menyala

        countdownTimerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
              setStep(0); 
              reset(); 
              setKeyboardOpen(false); 
              setIsScanning(false); 
              setShowTimeoutWarning(false);
              isWarningRef.current = false;
              setVipPin("");
              setQueueNumber(null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, 60000); // <-- SETTINGAN WAKTU TUNGGU TAHAP 1 (2 DETIK)
    }
  }, [step, reset]);

  // KUNCI HALAMAN KIOSK: Jika belum login, lempar ke halaman login
  useEffect(() => {
    const verifyKioskAccess = async () => {
      try {
        const { checkKioskAuthAction } = await import("./actions/kiosk");
        const session = await checkKioskAuthAction();
        // Jika tidak ada sesi atau role-nya bukan KIOSK, usir ke halaman login!
        if (!session) {
          window.location.href = "/admin/login";
        }
      } catch (error) {
        console.error("Gagal verifikasi Kiosk");
      }
    };
    verifyKioskAccess();
  }, []);

useEffect(() => {
    startIdleTimer();
    
    const handleActivity = () => {
      // Baca status dari Ref bayangan, bukan dari state yang memicu re-render
      if (!isWarningRef.current && step > 0 && step < 3) {
        startIdleTimer();
      }
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
  }, [startIdleTimer, step]);

const capturePhoto = useCallback(() => {
    if (previewWebcamRef.current) {
      const imageSrc = previewWebcamRef.current.getScreenshot();
      
      // Pastikan hasil jepretan benar-benar ada isinya (bukan sekadar "data:,")
      if (imageSrc && imageSrc.length > 100) {
        setPhotoBase64(imageSrc);
      } else {
        setPhotoBase64(null);
        console.log("Kamera gagal mengambil frame yang valid.");
      }
    }
  }, [previewWebcamRef]);

  // LOGIKA ALERT KETIKA FORM KOSONG
  const handleNext = async () => {
    const isValid = await trigger(["fullName", "phoneNumber", "institution", "internetNumber"]);
    if (isValid) {
      capturePhoto(); setStep(2); setKeyboardOpen(false);
    } else {
      customAlert("error", "Data Belum Lengkap", "Silakan lengkapi semua kolom yang memiliki tanda merah (*).");
    }
  };

const onSubmit = async (data: KioskFormValues) => {
    setIsSubmitting(true); setKeyboardOpen(false);
    
    // 1. TAMBAHKAN PROPERTI "pin" KE DALAM OBJEK DATA
    const finalData = {
      ...data,
      pin: vipPin || null 
    };

    // 2. KIRIM FINAL DATA (BUKAN DATA BAWAAN FORM)
    const result = await submitVisitorData(finalData, photoBase64);
    
    if (result.success) {
      if (result.visitorId) setCurrentVisitorId(result.visitorId);
      if (result.queueNumber) setQueueNumber(result.queueNumber);
      if (audioRef.current) audioRef.current.volume = 0.1;
      if (successVoiceRef.current && !isMuted) {
        successVoiceRef.current.currentTime = 0;
        successVoiceRef.current.volume = 1.0;
        successVoiceRef.current.play().catch(() => {});
      }
      playSuccessSound(); // Bunyi ting success
      setStep(3); setIsSubmitting(false);
    } else {
      setIsSubmitting(false); 
      customAlert("error", "Koneksi Terputus", "Terjadi kesalahan saat menyimpan data. Mohon coba lagi.");
    }
  };

  // Alert & Error jika tombol selesai ditekan tapi Kategori belum dipilih
  const onErrorSubmit = () => {
    customAlert("error", "Tujuan Belum Jelas", "Mohon pilih kategori kunjungan Anda terlebih dahulu.");
  };

const handleStartKiosk = async () => {
    const locked = await checkKioskLock();
    if (locked) return; // Hentikan fungsi jika terkunci!

    setStep(1); 
    if (audioRef.current) audioRef.current.volume = 0.1;
    if (voiceRef.current && !isMuted) {
      voiceRef.current.currentTime = 0;
      voiceRef.current.volume = 1.0; 
      voiceRef.current.play().catch(() => {});
    }
  };

  const handleScan = (detected: Array<{ rawValue: string }>) => {
    if (detected && detected.length > 0) {
      try {
        const qrText = detected[0].rawValue;
        const data = JSON.parse(qrText);
        if (data.nama) {
          setValue("institution", data.inst || "", { shouldValidate: true });
          setValue("fullName", data.nama || "", { shouldValidate: true });
          setValue("phoneNumber", data.hp || "", { shouldValidate: true });
          setValue("internetNumber", data.inet || "", { shouldValidate: true });
          setValue("address", data.alamat || "", { shouldValidate: true });
          setIsScanning(false); setStep(1);
          if (voiceRef.current && !isMuted) { voiceRef.current.currentTime = 0; voiceRef.current.play(); }
          customAlert("success", "QR Berhasil Dipindai", `Selamat datang kembali, ${data.nama}!`);
        }
      } catch { 
        customAlert("error", "QR Tidak Valid", "Kode QR yang Anda pindai tidak dikenali oleh sistem.");
      }
    }
  };

  const onKeyboardChange = (input: string) => {
    if (activeInput === "phoneNumber") {
      const formatted = formatPhone(input);
      setValue(activeInput, formatted, { shouldValidate: true });
      if (keyboardRef.current) keyboardRef.current.setInput(formatted);
    } 
    else if (activeInput === "institution" || activeInput === "fullName" || activeInput === "hostName") {
      const titleCased = toTitleCase(input);
      setValue(activeInput, titleCased, { shouldValidate: true });
      if (keyboardRef.current) keyboardRef.current.setInput(titleCased);
    } 
    else if (activeInput === "vipPin") {
      setVipPin(input);
      if (keyboardRef.current) keyboardRef.current.setInput(input);
    }
    else {
      setValue(activeInput, input, { shouldValidate: true });
    }
  };

  const onKeyboardKeyPress = (button: string) => {
    playBeep();
    if (button === "{shift}" || button === "{lock}") setKeyboardLayoutName(keyboardLayoutName === "default" ? "shift" : "default");
    if (button === "{enter}") setKeyboardOpen(false); 
  };

  const customKeyboardLayouts = {
    default: [ "1 2 3 4 5 6 7 8 9 0 - {bksp}", "q w e r t y u i o p", "a s d f g h j k l", "{shift} z x c v b n m , .", "{space} {enter}" ],
    shift: [ "! @ # $ % ^ & * ( ) _ {bksp}", "Q W E R T Y U I O P", "A S D F G H J K L", "{shift} Z X C V B N M < >", "{space} {enter}" ],
    numeric: [ "1 2 3", "4 5 6", "7 8 9", "- 0 {bksp}", "{enter}" ]
  };

  const isNumericInput = ["phoneNumber", "internetNumber", "vipPin"].includes(activeInput);
  const currentLayoutName = isNumericInput ? "numeric" : keyboardLayoutName;

let shiftY = 0;
  if (keyboardOpen) {
    // Menambahkan institution dan memperbesar angka minus agar form naik lebih tinggi
    if (activeInput === "institution") shiftY = -80;
    if (activeInput === "fullName") shiftY = -220; 
    
    // Perbesar dari -120 menjadi -160 agar No HP & Internet lebih naik
    if (activeInput === "internetNumber" || activeInput === "phoneNumber") shiftY = -160; 
    if (activeInput === "address") shiftY = -220; 
    
    // Penyesuaian sekalian untuk Step 2 agar tidak terhalang
    if (activeInput === "hostName") shiftY = -10;
    if (activeInput === "purpose") shiftY = -150; 
  }

  return (
    <div onPointerDown={handlePointerDown} className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center font-sans select-none">
      
      {/* ================= MODAL CUSTOM ALERT (TOAST) ================= */}
      <AnimatePresence>
        {alertData.show && (
          <motion.div initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
            <div className={`p-6 rounded-3xl backdrop-blur-2xl shadow-2xl flex items-center gap-6 min-w-[450px] max-w-2xl pointer-events-auto border-2 ${alertData.type === 'success' ? 'bg-green-950/70 border-green-500/50 shadow-[0_15px_40px_rgba(34,197,94,0.3)]' : ''} ${alertData.type === 'error' ? 'bg-red-950/70 border-red-500/50 shadow-[0_15px_40px_rgba(239,68,68,0.3)]' : ''} ${alertData.type === 'warning' ? 'bg-amber-950/70 border-amber-500/50 shadow-[0_15px_40px_rgba(245,158,11,0.3)]' : ''}`}>
              <div className="shrink-0 bg-white/10 p-3 rounded-full">
                {alertData.type === 'success' && <CheckCircle className="w-10 h-10 text-green-400" />}
                {alertData.type === 'error' && <XCircle className="w-10 h-10 text-red-400" />}
                {alertData.type === 'warning' && <AlertTriangle className="w-10 h-10 text-amber-400" />}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-1">{alertData.title}</h3>
                <p className="text-gray-300 text-lg leading-snug">{alertData.message}</p>
              </div>
              <button onClick={() => setAlertData(prev => ({ ...prev, show: false }))} className="p-3 hover:bg-white/10 rounded-full transition-all">
                <XCircle className="w-8 h-8 text-white/50 hover:text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ripples.map(r => (
          <motion.div key={r.id} initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="absolute w-24 h-24 bg-white/40 rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2" style={{ left: r.x, top: r.y }} />
        ))}
      </AnimatePresence>

      <video autoPlay loop muted playsInline src="/video-telkom.mp4" className="absolute inset-0 w-full h-full object-cover z-0" />
      <audio ref={audioRef} src="/bg-music.mp3" loop />
      <audio ref={voiceRef} src="/welcome-voice.mp3" />
      <audio ref={successVoiceRef} src="/success-voice.mp3" />
      <audio ref={scanVoiceRef} src="/scan-instruction.mp3" />
      
      {/* Hidden webcam untuk capture foto/form OCR, tanpa menampilkan preview aktif ke pengguna */}
{/* Kamera Tersembunyi: Diletakkan tepat di belakang background video Telkom (z-[-1]) agar 
          browser mengira kamera tampil penuh di layar dan tidak mem-pause videonya. */}
      {step > 0 && !isScanning && !showIntercom && !showPhotobooth && (
        <div className="absolute inset-0 z-[-1] flex items-center justify-center overflow-hidden">
          <Webcam
            key={previewCameraKey}
            audio={false}
            muted
            mirrored
            playsInline
            ref={previewWebcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <audio ref={beepAudioRef} src="/sounds/beep.mp3" preload="auto" />
      <audio ref={errorAudioRef} src="/sounds/error.mp3" preload="auto" />
      <audio ref={successAudioRef} src="/sounds/success.mp3" preload="auto" />

      <ClockWidget />

      <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute top-6 right-6 z-[100] p-4 bg-black/40 backdrop-blur-md border border-white/20 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:bg-white/10 transition-all cursor-pointer">
        {isMuted ? <VolumeX className="w-8 h-8 text-red-400" /> : <Volume2 className="w-8 h-8 text-green-400" />}
      </button>

      <AnimatePresence>
        {showTimeoutWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-white/10 p-10 rounded-[40px] border border-white/20 text-center shadow-2xl w-[500px]">
              <h2 className="text-3xl font-bold text-white mb-4">Masih di sana?</h2>
              <p className="text-xl text-gray-300 mb-8">Sesi Anda akan direset dalam <span className="text-red-400 font-bold text-3xl">{countdown}</span> detik.</p>
              <button onClick={startIdleTimer} className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full text-xl font-bold transition-all shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-95">Ya, saya masih mengisi</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />}
      </AnimatePresence>

      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="bg-white/10 p-8 rounded-[40px] border border-white/20 shadow-2xl flex flex-col items-center w-[400px]">
              <h2 className="text-2xl font-bold text-white mb-2">Pindai Kode QR</h2>
              <p className="text-gray-400 text-center mb-8">Arahkan kode QR ke kamera kiosk.</p>
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
        
        {step === 0 && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-end pb-24 z-20">
<motion.div 
  animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }} 
  transition={{ repeat: Infinity, duration: 2 }} 
  className="px-10 py-5 
             bg-red-600/60 backdrop-blur-lg 
             border border-red-400/60 
             text-white rounded-full text-2xl font-bold 
             shadow-[0_0_40px_rgba(220,38,38,0.5)] 
             flex items-center gap-3 cursor-pointer"
  onClick={handleStartKiosk}
>
  Sentuh layar untuk memulai <ChevronRight className="w-8 h-8" />
</motion.div>

<button 
      onClick={openFinpayPopup}
      className="flex items-center justify-center mt-4 px-6 py-3 border border-gray-600 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
    >
      <Search className="w-5 h-5 mr-2 text-green-400" />
      Cek Nomor Pelanggan Indibiz
    </button>

<div className="flex gap-4 mt-6">
              <motion.button 
                onClick={() => { setShowPinInput(true); setActiveInput("vipPin"); }} 
                disabled={kioskStatus?.isBusy}
                className={`px-6 py-3 backdrop-blur-md border rounded-full text-lg font-semibold flex items-center gap-3 transition-all ${
                  kioskStatus?.isBusy 
                    ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed" // Tampilan saat dikunci Admin
                    : "bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30" // Tampilan normal
                }`}
              >
                {kioskStatus?.isBusy ? (
                  <>🔒 Layanan Jeda</>
                ) : (
                  <><Star className="w-6 h-6" /> Punya Janji Temu?</>
                )}
              </motion.button>
            </div>

            <AnimatePresence>
              {showPinInput && (
                <motion.div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md">
                  
                  <motion.div animate={{ y: keyboardOpen && activeInput === "vipPin" ? -220 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-white/10 p-10 rounded-[40px] border border-white/20 text-center w-[400px]">
                      
                      {/* Lapis Keamanan 2: Jika Admin mengunci saat tamu sedang mengetik PIN */}
                      {kioskStatus?.isBusy ? (
                        <div className="animate-in fade-in zoom-in duration-300">
                          <div className="text-5xl mb-4">🔒</div>
                          <h2 className="text-2xl font-bold text-white mb-2">Layanan Sedang Jeda</h2>
                          <p className="text-white/70 mb-8">
                            {kioskStatus.message || "Petugas sedang tidak berada di tempat."}
                          </p>
                          <button 
                            onClick={() => { setShowPinInput(false); setVipPin(""); setKeyboardOpen(false); if(keyboardRef.current) keyboardRef.current.setInput(""); }} 
                            className="w-full py-4 bg-white/20 hover:bg-white/30 transition-all text-white rounded-full font-bold"
                          >
                            Kembali ke Awal
                          </button>
                        </div>
                      ) : (
                        // Tampilan Input PIN Normal
                        <div className="animate-in fade-in zoom-in duration-300">
                          <h2 className="text-2xl font-bold text-white mb-6">Masukkan PIN VIP</h2>
                          <input type="password" value={vipPin} onFocus={() => { setActiveInput("vipPin"); setKeyboardOpen(true); }} onKeyDown={playBeep} onChange={(e) => { setVipPin(e.target.value); if (keyboardRef.current && activeInput === "vipPin") keyboardRef.current.setInput(e.target.value); }} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-white text-3xl text-center mb-6 focus:border-amber-500 outline-none transition-all" placeholder="******" inputMode="none" />
                          <div className="flex gap-4">
                            <button onClick={() => { setShowPinInput(false); setVipPin(""); setKeyboardOpen(false); if(keyboardRef.current) keyboardRef.current.setInput(""); }} className="flex-1 py-3 bg-white/10 hover:bg-white/20 transition-all text-white rounded-full">Batal</button>
                            <button onClick={checkVipPin} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full transition-all">Masuk</button>
                          </div>
                        </div>
                      )}

                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

<motion.button 
  onClick={async (e) => { 
    e.stopPropagation(); 
    const locked = await checkKioskLock();
    if (locked) return; // Hentikan fungsi jika terkunci!
    
    setIsScanning(true); 
    if (scanVoiceRef.current && !isMuted) scanVoiceRef.current.play(); 
  }} 
  className="mt-6 px-6 py-3 bg-black/40 backdrop-blur-md border border-white/20 text-white rounded-full text-lg font-semibold flex items-center gap-3 hover:bg-black/60 transition-all cursor-pointer"
>
  <QrCode className="w-6 h-6 text-red-400" /> Punya kode QR? Pindai di sini
</motion.button>
{/* --- TOMBOL BARU UNTUK QR MOBILE --- */}
        <button 
          onClick={() => setShowMobileQR(true)}
          className="flex items-center justify-center mt-4 px-6 py-3 border border-gray-600 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
        >
          <Smartphone className="w-5 h-5 mr-2 text-blue-400" />
          Akses via Mobile
        </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-5xl z-20">
            <motion.div animate={{ y: shiftY }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-white/10 backdrop-blur-2xl border border-white/20 p-12 rounded-[40px] shadow-2xl">
              
              <div className="mb-8 pb-4 border-b-2 border-red-500/50 flex justify-between items-end">
                <div><h2 className="text-3xl font-bold text-white tracking-tight">{greeting}, silakan isi data Anda</h2></div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={handleScanKTP} disabled={isOcrLoading} className={`px-6 py-3 rounded-xl flex items-center gap-3 font-bold transition-all border ${isOcrLoading ? "bg-gray-600/50 text-gray-300 border-gray-400/30 cursor-not-allowed" : "bg-blue-600/80 hover:bg-blue-500 text-white border-blue-400/50 shadow-[0_0_20px_rgba(37,99,235,0.5)]"}`}>
                  {isOcrLoading ? (<div className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full"></div>) : (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/><path d="M7 12h10"/></svg>)}
                  {isOcrLoading ? "Membaca KTP..." : "Pindai KTP Otomatis"}
                </motion.button>
              </div>
              
              <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                <div className="space-y-8">
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Building className="w-6 h-6 text-red-400" /> Nama Instansi <span className="text-red-500">*</span></label>
                    <motion.div animate={errors.institution ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}}>
                      <input {...register("institution", { required: true })} onFocus={() => { setActiveInput("institution"); setKeyboardOpen(true); }} onKeyDown={playBeep} value={watch("institution") || ""} className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none text-white transition-all ${errors.institution ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`} placeholder="Contoh: Telkom" autoComplete="off" inputMode="none"/>
                    </motion.div>
                  </div>
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><User className="w-6 h-6 text-red-400" /> Nama Kostumer <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                      <div className="relative w-40">
                        <select {...register("salutation")} className="w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl outline-none text-white appearance-none cursor-pointer focus:border-red-500 transition-all">
                          <option value="Bapak" className="bg-gray-800">Bapak</option><option value="Ibu" className="bg-gray-800">Ibu</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 pointer-events-none" />
                      </div>
                      <motion.div animate={errors.fullName ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}} className="flex-1">
                        <input {...register("fullName", { required: true })} onFocus={() => { setActiveInput("fullName"); setKeyboardOpen(true); }} onKeyDown={playBeep} value={watch("fullName") || ""} className={`w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border rounded-xl outline-none text-white ${errors.fullName ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`} placeholder="Contoh: Nita" autoComplete="off" inputMode="none"/>
                      </motion.div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Phone className="w-6 h-6 text-red-400" /> No. HP PIC <span className="text-red-500">*</span></label>
                      <motion.div animate={errors.phoneNumber ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}}>
                        <input type="tel" readOnly {...register("phoneNumber", { required: true })} onFocus={() => { setActiveInput("phoneNumber"); setKeyboardOpen(true); }} onKeyDown={playBeep} onChange={(e) => { const formatted = formatPhone(e.target.value); setValue("phoneNumber", formatted, { shouldValidate: true }); if (keyboardRef.current && activeInput === "phoneNumber") keyboardRef.current.setInput(formatted); }} value={watch("phoneNumber") || ""} className={`w-full text-2xl p-5 bg-black/30 border rounded-xl outline-none text-white ${errors.phoneNumber ? 'border-red-500 bg-red-500/10' : 'border-white/20 focus:border-red-500'}`} placeholder="0812..." autoComplete="off" inputMode="none" />
                      </motion.div>
                    </div>
                    <div>
                      <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Hash className="w-6 h-6 text-red-400" /> Nomor Internet <span className="text-red-500">*</span></label>
                      <motion.div animate={errors.internetNumber ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}}>
                        <input type="text" {...register("internetNumber", { required: true })} onFocus={() => { setActiveInput("internetNumber"); setKeyboardOpen(true); }} onKeyDown={playBeep} value={watch("internetNumber") || ""} className={`w-full text-2xl p-5 bg-black/30 border border-white/20 rounded-xl outline-none text-white ${errors.internetNumber ? 'border-red-500 bg-red-500/10' : 'focus:border-red-500'}`} placeholder="Contoh: 1412..." autoComplete="off" inputMode="none"/>
                      </motion.div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><MapPin className="w-6 h-6 text-red-400" /> Alamat Pelanggan</label>
                    <input type="text" {...register("address")} onFocus={() => { setActiveInput("address"); setKeyboardOpen(true); }} onKeyDown={playBeep} value={watch("address") || ""} className="w-full text-2xl p-5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl outline-none text-white focus:border-red-500 transition-all" placeholder="Jl. Cik Ditiro" autoComplete="off" inputMode="none"/>
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

        {/* --- OVERLAY & MODAL GLASSMORPHISM --- */}
      {showMobileQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          
          {/* Container Glassmorphism */}
          <div className="relative flex flex-col items-center p-8 rounded-3xl max-w-sm w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] bg-white/10 backdrop-blur-md border border-white/20">
            
            {/* Tombol Close */}
            <button 
              onClick={() => setShowMobileQR(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white/80 hover:text-white hover:bg-black/40 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-md">Akses Mobile</h3>
            <p className="text-sm text-gray-200 text-center mb-6 drop-shadow-sm">
              Gunakan kamera HP Anda untuk memindai QR code ini dan melanjutkan via mobile.
            </p>

            {/* Area QR Code (Background solid agar QR mudah discan) */}
            <div className="p-4 bg-white rounded-2xl shadow-inner">
              <NextImage 
                src="/qr-mobile1.png" 
                alt="QR Code Mobile" 
                width={200} 
                height={200} 
                className="rounded-xl"
              />
            </div>

          </div>
          
        </div>
      )}
      {/* --- AKHIR MODAL --- */}

      {/* --- MODAL IFRAME FINPAY --- */}
      {showFinpayModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          
          {/* Container Glassmorphism yang lebih besar */}
          <div className="relative flex flex-col w-full max-w-5xl h-[85vh] p-3 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] bg-white/10 backdrop-blur-md border border-white/20">
            
            {/* Tombol Close (Dibuat lebih besar & mencolok untuk Kiosk) */}
            <button 
              onClick={() => setShowFinpayModal(false)}
              className="absolute -top-5 -right-5 p-4 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700 transition-all z-[70]"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Area Iframe */}
            <div className="w-full h-full bg-white rounded-2xl overflow-hidden shadow-inner">
              <iframe 
                src="https://live.finpay.id/widgetpg/001001/indibiz"
                className="w-full h-full border-none"
                title="Portal Finpay Indibiz"
                allow="clipboard-write"
              />
            </div>

          </div>
          
        </div>
      )}
      {/* --- AKHIR MODAL IFRAME --- */}

        {step === 2 && (
          <motion.div key="step2" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-6xl z-20">
            <motion.div animate={{ y: shiftY }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[40px] shadow-2xl">
              <div className="mb-6 border-b-2 border-red-500/50 w-72 pb-2"><h2 className="text-3xl font-bold text-white tracking-tight">Tujuan Kunjungan</h2></div>
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-7 space-y-4">
                  <label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-1"><Tag className="w-6 h-6 text-red-400" /> Kategori <span className="text-red-500">*</span></label>
                  <motion.div animate={errors.category ? { x: [-8, 8, -5, 5, 0], transition: { duration: 0.4 } } : {}} className="grid grid-cols-3 gap-3">
                    {KATEGORI_KUNJUNGAN.map((kat) => (
                      <motion.div key={kat.id} whileTap={{ scale: 0.95 }} onClick={() => { setSelectedCategory(kat.label); setValue("category", kat.label, { shouldValidate: true }); setKeyboardOpen(false); playBeep(); }} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-2 h-28 ${selectedCategory === kat.label ? "bg-red-600/80 border-red-400 shadow-[0_0_25px_rgba(220,38,38,0.5)]" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                        <span className="text-3xl">{kat.icon}</span><span className={`text-xs font-bold leading-tight ${selectedCategory === kat.label ? "text-white" : "text-gray-300"}`}>{kat.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                  <input type="hidden" {...register("category", { required: true })} inputMode="none"/>
                </div>
                <div className="col-span-5 space-y-6">
                  <div><label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Contact className="w-6 h-6 text-red-400" /> Petugas yang Dituju</label><input {...register("hostName")} onFocus={() => { setActiveInput("hostName"); setKeyboardOpen(true); }} onKeyDown={playBeep} value={watch("hostName") || ""} className="w-full text-xl p-5 bg-black/30 border border-white/10 rounded-2xl outline-none text-white focus:border-red-500" placeholder="Nita Wulandari" autoComplete="off" inputMode="none"/></div>
                  <div><label className="text-xl font-semibold text-gray-200 flex items-center gap-3 mb-3"><Target className="w-6 h-6 text-red-400" /> Detail Kunjungan</label><textarea {...register("purpose")} onFocus={() => { setActiveInput("purpose"); setKeyboardOpen(true); }} onKeyDown={playBeep} value={watch("purpose") || ""} className="w-full text-lg p-5 bg-black/30 border border-white/10 rounded-2xl outline-none text-white min-h-[160px] resize-none focus:border-red-500" placeholder="Silakan jelaskan detail kunjungan Anda" inputMode="none" /></div>
                </div>
              </div>
              <div className="mt-8 p-4 bg-black/20 rounded-2xl border border-white/5">
                <label className="flex items-start gap-4 cursor-pointer group">
                  <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="h-7 w-7 rounded-lg border-2 border-white/20 bg-black/40 accent-red-600 cursor-pointer" inputMode="none"/>
                  <p className="text-gray-300 text-lg leading-snug">Saya setuju data saya digunakan untuk administrasi di <span className="text-red-400 font-bold">Telkom Witel Sulbagteng</span>.</p>
                </label>
              </div>
              <div className="mt-10 flex justify-between items-center">
                <button onClick={() => setStep(1)} className="px-8 py-5 text-xl font-semibold text-gray-400 hover:text-white flex items-center gap-2"><ChevronLeft className="w-6 h-6" /> Kembali</button>
                <button onClick={handleSubmit(onSubmit, onErrorSubmit)} disabled={isSubmitting || !isAgreed} className={`px-14 py-5 text-white text-xl font-bold rounded-2xl backdrop-blur-md border border-white/20 shadow-xl transition-all ${(isSubmitting || !isAgreed) ? 'bg-gray-600/50 opacity-50 grayscale' : 'bg-red-600/90 hover:bg-red-500'}`}>{isSubmitting ? 'Menyimpan...' : 'Selesai & Kirim'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col w-full max-w-5xl z-20">
            <div className="flex w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl overflow-hidden">
              <div className="flex-1 p-16 flex flex-col items-center justify-center text-center border-r border-white/10">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="bg-green-500/20 rounded-full p-4 mb-8"><CheckCircle className="w-32 h-32 text-green-400" /></motion.div>
                <h2 className="text-5xl font-bold text-white mb-4">Pendaftaran Berhasil!</h2>

                {/* 👇 KOTAK NOMOR ANTREAN BARU 👇 */}
                {queueNumber && (
<motion.div 
  initial={{ scale: 0.8, opacity: 0 }} 
  animate={{ scale: 1, opacity: 1 }} 
  transition={{ delay: 0.3 }} 
  className="my-4 px-6 py-4 bg-black/40 border border-amber-500/30 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.15)] inline-block"
>
  <p className="text-amber-400 font-semibold uppercase tracking-widest mb-1 text-xs">
    Nomor Antrean Anda
  </p>
  <p className="text-5xl font-black text-white">{queueNumber}</p>
</motion.div>

                )}

                <p className="text-2xl text-gray-300">Mohon tunggu sebentar, petugas kami akan menemui Anda.</p>
                <div className="mt-12 flex flex-row gap-6 justify-center">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowPhotobooth(true)} className="px-8 py-5 bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-3"><span className="text-2xl">📸</span> Buka Foto Kenangan</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setStep(4)} className="px-8 py-5 bg-green-600 text-white text-xl font-bold rounded-2xl shadow-lg shadow-green-900/20 hover:bg-green-500 transition-all">Selesai & Beri Penilaian</motion.button>
                </div>
              </div>
              <div className="w-[400px] bg-black/40 p-12 flex flex-col items-center justify-center text-center">
                <QrCode className="w-12 h-12 text-red-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Sering Berkunjung?</h3>
                <p className="text-sm text-gray-400 mb-8">Pindai dan simpan kode QR ini untuk pendaftaran instan pada kunjungan berikutnya.</p>
                <div className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <QRCodeCanvas value={JSON.stringify({ inst: getValues("institution"), nama: getValues("fullName"), hp: getValues("phoneNumber"), inet: getValues("internetNumber"), alamat: getValues("address") })} size={180} level="H" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="step4" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-5xl z-20">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-12 rounded-[40px] shadow-2xl flex flex-col items-center justify-center min-h-[500px]">
              {!ratingSubmitted ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center w-full">
                  <h2 className="text-4xl font-bold text-white mb-4">Langkah Terakhir</h2>
                  <h3 className="text-xl text-gray-300 mb-12">Bagaimana pengalaman Anda menggunakan layanan kiosk ini?</h3>
                  <div className="flex justify-center gap-8">
                    {[ { score: 1, emoji: "😡", label: "Buruk" }, { score: 2, emoji: "🙁", label: "Kurang" }, { score: 3, emoji: "😐", label: "Cukup" }, { score: 4, emoji: "🙂", label: "Baik" }, { score: 5, emoji: "😍", label: "Sangat Baik" }].map((item) => (
                      <motion.button key={item.score} whileHover={{ scale: 1.2, y: -10 }} whileTap={{ scale: 0.9 }} onClick={async () => { setRatingSubmitted(true); playSuccessSound(); await submitVisitorRating(currentVisitorId, item.score); setTimeout(() => { setStep(0); setRatingSubmitted(false); setCurrentVisitorId(""); reset(); setPhotoBase64(null); setIsAgreed(false); setSelectedCategory(""); }, 3000); }} className="flex flex-col items-center gap-4 group">
                        <span className="text-7xl filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300">{item.emoji}</span><span className="text-lg font-medium text-gray-400 group-hover:text-white transition-colors">{item.label}</span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="mt-16"><button onClick={() => { setStep(0); setRatingSubmitted(false); setCurrentVisitorId(""); setQueueNumber(null); reset(); setPhotoBase64(null); setIsAgreed(false); setSelectedCategory(""); setVipPin(""); }} className="text-gray-400 hover:text-white transition-colors">Lewati (Tutup)</button></div>
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-6 text-center">
                  <div className="inline-flex flex-col items-center gap-6">
                    <div className="w-24 h-24 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center text-5xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-white">Terima Kasih!</h2>
                    <p className="text-xl text-gray-300">Penilaian Anda sangat berarti bagi pengembangan Telkom.</p>
                    <p className="text-sm text-gray-500 mt-4">Kiosk akan kembali ke layar awal dalam beberapa detik...</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPhotobooth && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-10">
            <div className="bg-white/10 p-8 rounded-[40px] border border-white/20 shadow-2xl flex gap-10 max-w-6xl w-full">
              <div className="flex-1 relative overflow-hidden rounded-3xl bg-black border-4 border-red-500/50">
                {!photoboothResult ? (
                  <>
                    <Webcam
                      key={photoboothCameraKey}
                      audio={false}
                      muted
                      mirrored
                      playsInline
                      ref={photoboothWebcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
                      className="w-[640px] h-[480px]"
                      
                    />
                    <img src="/frame-telkom.png" alt="frame" className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10" />
                  </>
                ) : (<img src={photoboothResult} alt="Hasil foto kenangan" className="w-full h-full object-cover" />)}
              </div>
              <div className="w-[350px] flex flex-col justify-center text-center">
                <h2 className="text-3xl font-bold text-white mb-4">Foto Kenangan Telkom</h2><p className="text-gray-400 mb-8">Abadikan kenang-kenangan kunjungan Anda hari ini.</p>
                {!photoboothResult ? (
                  <div className="flex flex-col gap-4">
                     <button onClick={handleCapturePhotobooth} className="py-6 bg-red-600 text-white font-bold text-2xl rounded-2xl shadow-lg shadow-red-900/30 hover:bg-red-500 transition-all">📸 Ambil Foto</button>
                     <button onClick={() => setShowPhotobooth(false)} className="py-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all">Batal/Tutup</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <div className="p-4 bg-white rounded-2xl shadow-lg w-[232px] h-[232px] flex items-center justify-center">
                      {isUploadingPhoto ? (
                        <div className="flex flex-col items-center gap-3"><div className="animate-spin w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full"></div><span className="text-gray-500 font-semibold text-sm animate-pulse">Menyiapkan kode QR...</span></div>
                      ) : photoboothUrl ? (
                        <QRCodeCanvas value={photoboothUrl} size={200} level="H" />
                      ) : (<span className="text-red-500 text-sm font-bold">Gagal memuat QR</span>)}
                    </div>
                    <div className="text-center">
                      {isUploadingPhoto ? (<p className="text-sm text-yellow-400 font-semibold">Sedang mengunggah ke server Telkom...</p>) : photoboothUrl ? (<p className="text-sm text-green-400 font-bold">Pindai kode QR di atas untuk menyimpan foto ke ponsel Anda.</p>) : (<p className="text-sm text-red-400">Terjadi kesalahan jaringan.</p>)}
                    </div>
                    <div className="flex w-full gap-3 mt-4">
                      <button onClick={() => { setPhotoboothResult(null); setPhotoboothUrl(null); }} disabled={isUploadingPhoto} className={`flex-1 py-3 text-white font-semibold rounded-xl transition-all ${isUploadingPhoto ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20'}`}>Ulangi</button>
                      <button onClick={() => { setShowPhotobooth(false); setPhotoboothResult(null); setPhotoboothUrl(null); }} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-500 transition-all">Selesai</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

{/* 4. TOMBOL PANGGILAN INTERKOM (POJOK KANAN BAWAH) */}
      {step < 2 && !showIntercom && (
        <motion.button 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          whileHover={kioskStatus?.isBusy ? {} : { scale: 1.1 }} 
          whileTap={kioskStatus?.isBusy ? {} : { scale: 0.9 }} 
          onClick={async () => {
            // Jika sedang sibuk, tampilkan modal peringatan dari checkKioskLock
            if (kioskStatus?.isBusy) {
              await checkKioskLock();
              return;
            }
            setShowIntercom(true);
          }} 
          className={`fixed bottom-10 right-10 z-50 p-6 rounded-full flex items-center justify-center group transition-all ${
            kioskStatus?.isBusy 
              ? "bg-gray-600/50 backdrop-blur-md border border-white/10 cursor-not-allowed opacity-60" 
              : "bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.6)] cursor-pointer"
          }`}
        >
          <Headset className={`w-10 h-10 text-white ${kioskStatus?.isBusy ? "" : "animate-pulse group-hover:animate-none"}`} />
        </motion.button>
      )}

      <AnimatePresence>
        {showIntercom && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[300] flex items-center justify-center p-10 bg-gray-700/40 backdrop-blur-md border border-white/20 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <div className="w-[95vw] max-w-7xl h-[85vh] flex flex-col p-8 rounded-[40px] border border-white/10 bg-gray-800/15 backdrop-blur-[30px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-6 px-4">
                <div className="flex items-center gap-3"><div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div><h2 className="text-3xl font-bold text-white tracking-tight">Layanan Bantuan Langsung</h2></div>
                <button onClick={() => setShowIntercom(false)} className="px-6 py-3 bg-gray-600/50 hover:bg-gray-500/50 text-white rounded-xl font-semibold transition-all">Tutup Panggilan</button>
              </div>
              <div className="flex-1 w-full relative">
                <div className="absolute inset-0 bg-black/40 border border-white/5 rounded-[32px] overflow-hidden">
                  <ZegoCall roomID="ruang-bantuan-telkom" onClose={() => setShowIntercom(false)} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {keyboardOpen && ((step > 0 && step < 3) || showPinInput) && (
        <motion.div 
            initial={{ y: 80, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 80, opacity: 0 }} 
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }} 
            className={`absolute bottom-0 z-[250] p-6 bg-white/5 backdrop-blur-3xl border-t border-x border-white/20 rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transition-all ${isNumericInput ? 'w-full max-w-md' : 'w-full max-w-6xl'}`}
          >
            <div className="flex justify-between items-center mb-4 px-6">
              <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div><span className="text-white/60 font-semibold text-sm uppercase tracking-widest">{isNumericInput ? "Keyboard Angka" : "Keyboard Layar Sentuh"}</span></div>
              <button onClick={() => setKeyboardOpen(false)} className="text-white font-bold px-6 py-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-all shadow-lg text-sm border border-red-400/50">TUTUP</button>
            </div>
            
            <div className={`glass-keyboard-container rounded-3xl overflow-hidden p-2 ${isNumericInput ? 'numpad-style' : ''}`}>
              <Keyboard 
                keyboardRef={(r) => {
                  keyboardRef.current = r;
                }} 
                layoutName={currentLayoutName} 
                layout={customKeyboardLayouts}
                display={{
                  "{bksp}": "Hapus",
                  "{enter}": "Selesai",
                  "{shift}": "Kapital",
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

      <style jsx global>{`
        .custom-glass-theme { background: transparent !important; font-family: inherit; }
        .hg-button { background: rgba(255, 255, 255, 0.1) !important; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1) !important; color: white !important; border-radius: 12px !important; box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important; height: 60px !important; font-size: 1.2rem !important; font-weight: 600 !important; transition: all 0.2s ease !important; }
        .hg-button:active { background: rgba(255, 255, 255, 0.3) !important; transform: scale(0.95); }
        .hg-button.hg-functionBtn { background: rgba(239, 68, 68, 0.2) !important; color: #f87171 !important; }
        .numpad-style .hg-button { height: 80px !important; font-size: 2rem !important; font-weight: bold !important; }
        .numpad-style .hg-button-bksp, .numpad-style .hg-button-enter { font-size: 1.2rem !important; background: rgba(239, 68, 68, 0.3) !important; color: white !important; }
      `}</style>

      {/* MODAL PENOLAKAN KARENA CS SIBUK */}
      {isCsBusy && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-gradient-to-b from-red-950 to-black p-12 rounded-[40px] border border-red-500/50 text-center max-w-3xl shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <span className="text-6xl">⏳</span>
            </div>
            <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-wide">Pendaftaran Dijeda</h2>
            <p className="text-lg text-red-300 mb-8 font-semibold">Petugas Customer Service sedang tidak berada di meja.</p>
            
            {/* INI ADALAH PESAN ASLI KETIKAN CS */}
            <div className="bg-white/10 p-8 rounded-3xl border border-white/20 mb-10 w-full relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 px-4 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Pesan dari Petugas
              </div>
              <p className="text-2xl text-white leading-relaxed italic bold">
                {busyMessage}
              </p>
            </div>

            <button 
              onClick={() => setIsCsBusy(false)}
              className="px-10 py-5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all border border-white/20 shadow-lg active:scale-95"
            >
              Tutup & Coba Lagi Nanti
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
