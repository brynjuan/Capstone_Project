"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, SkipForward } from "lucide-react";

export default function BackgroundAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.2); // Default volume 20%
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // Daftar lagu yang akan diputar bergantian
  const playlist = ["/bg-music.mp3", "/bg-music(1).mp3"];

  const handleNextTrack = () => {
    setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % playlist.length);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      
      // Karena sumber src berubah saat currentTrackIndex berubah,
      // kita coba putar otomatis (autoplay) lagu selanjutnya jika isPlaying = true
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Autoplay diblokir:", e));
      }
    }
  }, [currentTrackIndex, volume, isPlaying]);

  // Efek untuk memicu autoplay pertama kali komponen dimuat (sering diblokir browser tanpa interaksi)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          console.log("Autoplay awal diblokir oleh browser, butuh interaksi user.");
          setIsPlaying(false);
        });
    }
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Autoplay diblokir:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-[#f0dfdb] bg-white/90 p-3 shadow-xl backdrop-blur-md">
      {/* src akan otomatis ganti ke lagu berikutnya ketika lagu selesai (onEnded) */}
      <audio 
        ref={audioRef} 
        src={playlist[currentTrackIndex]} 
        onEnded={handleNextTrack}
      />
      
      <div className="flex items-center gap-2">
        <button 
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b3261e] text-white transition-transform hover:scale-105 active:scale-95"
          title={isPlaying ? "Jeda (Pause)" : "Putar (Play)"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
        </button>

        <button 
          onClick={handleNextTrack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fcedea] text-[#b3261e] transition-transform hover:scale-105 active:scale-95"
          title="Lewati ke lagu berikutnya"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-2 border-l border-[#f0dfdb] ml-1 pl-3">
        <button onClick={toggleMute} className="text-[#725b56] hover:text-[#b3261e]">
          {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={isMuted ? 0 : volume} 
          onChange={handleVolumeChange}
          className="h-1.5 w-16 md:w-20 cursor-pointer appearance-none rounded-full bg-[#f0dfdb] accent-[#b3261e]"
          title="Volume Musik"
        />
      </div>
      
      {/* Indikator Lagu Kecil (Opsional, untuk tau ini lagu ke berapa) */}
      <div className="absolute -top-3 right-4 rounded-full bg-[#b3261e] px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
        Track {currentTrackIndex + 1}/{playlist.length}
      </div>
    </div>
  );
}
