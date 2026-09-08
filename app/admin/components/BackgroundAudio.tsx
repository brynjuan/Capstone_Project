"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, SkipForward, Music, Radio, Disc } from "lucide-react";

const PLAYLIST_DATA = [
  { src: "/bg-music.mp3", title: "Jayalah Telkom Indonesia", artist: "Mars Telkom Group" },
  { src: "/bg-music(1).mp3", title: "Always The Best", artist: "Telkom Indonesia" },
  { src: "/bg-music(2).mp3", title: "Relaxing Instrumental", artist: "Background Music 3" }
];

export default function BackgroundAudio({ role = "admin", channel, isMutedFromParent = false }: { role?: "admin" | "kiosk", channel?: any, isMutedFromParent?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.2); // Default volume 20%
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [syncTrigger, setSyncTrigger] = useState(0);

  const sendCommand = (action: string, value?: any) => {
    if (role === "admin" && channel) {
      channel.send({
        type: 'broadcast',
        event: 'music-control',
        payload: { action, value }
      });
    }
  };

  const handleNextTrack = () => {
    if (role === "admin") {
      sendCommand("next");
    } else {
      setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % PLAYLIST_DATA.length);
    }
  };

  const jumpToTrack = (index: number) => {
    if (role === "admin") {
      sendCommand("jump", index);
      setCurrentTrackIndex(index); // optimistic update
      setIsPlaying(true);
      sendCommand("play");
    } else {
      setCurrentTrackIndex(index);
    }
  };

  // ADMIN: Request initial state and listen to Kiosk state updates
  useEffect(() => {
    if (role === "admin" && channel) {
      // Beri jeda 1 detik agar channel Supabase selesai melakukan koneksi (SUBSCRIBED)
      const timer = setTimeout(() => {
        channel.send({
          type: 'broadcast',
          event: 'music-request-state',
          payload: {}
        }).catch(() => {});
      }, 1500);

      // Dengarkan update status dari Kiosk (sinkronisasi dua arah)
      channel.on('broadcast', { event: 'music-state' }, (payload: any) => {
        const { isPlaying: newPlaying, volume: newVol, isMuted: newMuted, currentTrackIndex: newIndex } = payload.payload;
        setIsPlaying(newPlaying);
        setVolume(newVol);
        setIsMuted(newMuted);
        setCurrentTrackIndex(newIndex);
      });

      return () => clearTimeout(timer);
    }
  }, [role, channel]);

  // KIOSK: Listener perintah dari admin
  useEffect(() => {
    if (role === "kiosk" && channel) {
      channel.on('broadcast', { event: 'music-control' }, (payload: any) => {
        const { action, value } = payload.payload;
        if (action === "play") {
          setIsPlaying(true);
        } else if (action === "pause") {
          setIsPlaying(false);
        } else if (action === "next") {
          setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST_DATA.length);
        } else if (action === "jump") {
          setCurrentTrackIndex(value);
          setIsPlaying(true);
        } else if (action === "volume") {
          setVolume(value);
        } else if (action === "mute") {
          setIsMuted(value);
        }
      });
      
      channel.on('broadcast', { event: 'music-request-state' }, () => {
        setSyncTrigger((prev) => prev + 1);
      });
    }
  }, [role, channel]);

  // KIOSK: Broadcast status ke Admin setiap ada perubahan
  useEffect(() => {
    if (role === "kiosk" && channel) {
      channel.send({
        type: 'broadcast',
        event: 'music-state',
        payload: { isPlaying, volume, isMuted, currentTrackIndex }
      });
    }
  }, [isPlaying, volume, isMuted, currentTrackIndex, syncTrigger, role, channel]);

  // KIOSK: Sinkronisasi pemutar audio dengan state React
  useEffect(() => {
    if (role === "kiosk" && audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted || isMutedFromParent;
      
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Autoplay diblokir:", e);
          setIsPlaying(false); // Kembalikan state ke false jika diblokir
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentTrackIndex, volume, isPlaying, isMuted, isMutedFromParent, role]);

  // KIOSK: Efek autoplay pada saat komponen dimuat
  useEffect(() => {
    let isMounted = true;
    const currentAudio = audioRef.current;
    
    if (role === "kiosk" && currentAudio) {
      currentAudio.volume = volume;
      currentAudio.muted = isMuted || isMutedFromParent;
      
      const playInteraction = () => {
        if (isMounted && currentAudio.paused) {
          currentAudio.play()
            .then(() => setIsPlaying(true))
            .catch(e => console.error(e));
        }
        window.removeEventListener('click', playInteraction);
        window.removeEventListener('touchstart', playInteraction);
      };

      currentAudio.play()
        .then(() => {
          if (isMounted) setIsPlaying(true);
        })
        .catch(() => {
          console.log("Autoplay awal diblokir oleh browser. Menunggu interaksi user...");
          window.addEventListener('click', playInteraction);
          window.addEventListener('touchstart', playInteraction);
        });
        
      return () => {
        isMounted = false;
        if (currentAudio) currentAudio.pause();
        window.removeEventListener('click', playInteraction);
        window.removeEventListener('touchstart', playInteraction);
      };
    }
  }, [role]); 

  const togglePlay = () => {
    if (role === "admin") {
      const newPlayState = !isPlaying;
      setIsPlaying(newPlayState); // Pembaruan UI optimistik, akan dikoreksi otomatis bila gagal
      sendCommand(newPlayState ? "play" : "pause");
    } else {
      if (isPlaying) {
        audioRef.current?.pause();
      } else {
        audioRef.current?.play().catch(e => console.error(e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (role === "admin") {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      sendCommand("mute", newMuteState);
    } else {
      if (audioRef.current) {
        audioRef.current.muted = !isMuted;
      }
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (role === "admin") {
      sendCommand("volume", newVolume);
    } else {
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
      }
    }
  };

  if (role === "kiosk") {
    return (
      <audio 
        ref={audioRef} 
        src={PLAYLIST_DATA[currentTrackIndex]?.src} 
        onEnded={() => handleNextTrack()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          if (!audioRef.current?.ended) {
            setIsPlaying(false);
          }
        }}
        className="kiosk-bg-audio hidden"
      />
    );
  }

  const currentTrack = PLAYLIST_DATA[currentTrackIndex];

  return (
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* KIRI: Player Card */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2b211f] to-[#4a1f1b] p-8 shadow-2xl flex flex-col items-center">
        {/* Dekorasi Latar Belakang */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-[#b3261e] opacity-20 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center w-full">
          {/* Header */}
          <div className="flex items-center gap-2 mb-8 text-white/70">
            <Radio className="w-4 h-4 animate-pulse text-[#ff8b7a]" />
            <span className="text-xs font-bold uppercase tracking-widest">Live Sync Kiosk</span>
          </div>

          {/* Album Art / Disk */}
          <div className="relative mb-8">
            <div className={\`w-48 h-48 rounded-full bg-gradient-to-tr from-[#1a1210] to-[#3a221f] border-4 border-[#5e2b25] shadow-2xl flex items-center justify-center transition-transform duration-1000 \${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}\`}>
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center border-2 border-[#b3261e]/30">
                <Music className="w-6 h-6 text-[#ff8b7a]" />
              </div>
            </div>
            {/* Indikator Suara */}
            {isPlaying && (
              <div className="absolute -bottom-2 right-4 flex items-end gap-1 h-8">
                <div className="w-1.5 bg-[#ff8b7a] rounded-t-sm animate-[bounce_1s_ease-in-out_infinite] h-full"></div>
                <div className="w-1.5 bg-[#ff8b7a] rounded-t-sm animate-[bounce_1.2s_ease-in-out_infinite_0.1s] h-2/3"></div>
                <div className="w-1.5 bg-[#ff8b7a] rounded-t-sm animate-[bounce_0.8s_ease-in-out_infinite_0.2s] h-4/5"></div>
              </div>
            )}
          </div>

          {/* Informasi Lagu */}
          <div className="text-center mb-8 w-full">
            <h4 className="text-xl font-bold text-white mb-1 truncate px-4">{currentTrack?.title}</h4>
            <p className="text-sm text-white/50">{currentTrack?.artist}</p>
          </div>

          {/* Kontrol Utama */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <button 
              onClick={togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff8b7a] text-[#2b211f] shadow-[0_0_20px_rgba(255,139,122,0.3)] transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current ml-1" />}
            </button>

            <button 
              onClick={handleNextTrack}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 active:scale-95"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Kontrol Volume */}
          <div className="flex w-full items-center gap-4 bg-black/20 rounded-full px-5 py-3 border border-white/5">
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume} 
              onChange={handleVolumeChange}
              className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#ff8b7a]"
            />
          </div>
        </div>
      </div>

      {/* KANAN: Daftar Lagu */}
      <div className="flex flex-col bg-white rounded-[2rem] border border-[#f0dfdb] shadow-sm overflow-hidden h-full">
        <div className="p-6 border-b border-[#f0dfdb] bg-[#faf6f5]">
          <h3 className="text-lg font-black text-[#2b211f] flex items-center gap-2">
            <Disc className="w-5 h-5 text-[#b3261e]" />
            Daftar Putar (*Playlist*)
          </h3>
          <p className="text-xs text-[#7a625d] mt-1">Pilih lagu untuk langsung diputar di Kiosk</p>
        </div>

        <div className="p-4 flex flex-col gap-2 overflow-y-auto max-h-[400px]">
          {PLAYLIST_DATA.map((track, idx) => {
            const isActive = idx === currentTrackIndex;
            return (
              <button
                key={idx}
                onClick={() => jumpToTrack(idx)}
                className={\`flex items-center gap-4 p-4 rounded-2xl text-left transition-all group \${isActive ? 'bg-[#fcedea] border border-[#f5b8b1] shadow-sm' : 'hover:bg-[#faf6f5] border border-transparent'}\`}
              >
                <div className={\`flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm transition-colors \${isActive ? 'bg-[#b3261e] text-white' : 'bg-[#f0dfdb] text-[#7a625d] group-hover:bg-[#e8d2ce]'}\`}>
                  {isActive && isPlaying ? (
                    <Music className="w-4 h-4 animate-pulse" />
                  ) : (
                    idx + 1
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={\`truncate font-bold text-sm transition-colors \${isActive ? 'text-[#b3261e]' : 'text-[#2b211f]'}\`}>
                    {track.title}
                  </h4>
                  <p className="text-xs text-[#7a625d] truncate mt-0.5">{track.artist}</p>
                </div>

                {!isActive && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-[#b3261e]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
