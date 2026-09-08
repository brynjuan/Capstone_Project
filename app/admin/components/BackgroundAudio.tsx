"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, SkipForward } from "lucide-react";

export default function BackgroundAudio({ role = "admin", channel }: { role?: "admin" | "kiosk", channel?: any }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.2); // Default volume 20%
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [syncTrigger, setSyncTrigger] = useState(0);

  // Daftar lagu yang akan diputar bergantian
  const playlist = ["/bg-music.mp3", "/bg-music(1).mp3", "/bg-music(2).mp3"];

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
      setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % playlist.length);
    }
  };

  // ADMIN: Request initial state and listen to Kiosk state updates
  useEffect(() => {
    if (role === "admin" && channel) {
      // Minta status awal ke Kiosk
      channel.send({
        type: 'broadcast',
        event: 'music-request-state',
        payload: {}
      });

      // Dengarkan update status dari Kiosk (sinkronisasi dua arah)
      channel.on('broadcast', { event: 'music-state' }, (payload: any) => {
        const { isPlaying: newPlaying, volume: newVol, isMuted: newMuted, currentTrackIndex: newIndex } = payload.payload;
        setIsPlaying(newPlaying);
        setVolume(newVol);
        setIsMuted(newMuted);
        setCurrentTrackIndex(newIndex);
      });
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
          setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
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
  }, [role, channel, playlist.length]);

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
      audioRef.current.muted = isMuted;
      
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Autoplay diblokir:", e);
          setIsPlaying(false); // Kembalikan state ke false jika diblokir
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentTrackIndex, volume, isPlaying, isMuted, role]);

  // KIOSK: Efek autoplay pada saat komponen dimuat
  useEffect(() => {
    let isMounted = true;
    const currentAudio = audioRef.current;
    
    if (role === "kiosk" && currentAudio) {
      currentAudio.volume = volume;
      currentAudio.play().catch(() => {
        console.log("Autoplay awal diblokir oleh browser.");
      });
    }
    
    return () => {
      isMounted = false;
      if (currentAudio) currentAudio.pause();
    };
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
        src={playlist[currentTrackIndex]} 
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

  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-[#f0dfdb] bg-white p-10 shadow-sm">
      <div className="flex items-center gap-6">
        <button 
          onClick={togglePlay}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-[#b3261e] text-white shadow-lg transition-transform hover:scale-105 active:scale-95" 
          title={isPlaying ? "Jeda (Pause)" : "Putar (Play)"}
        >
          {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10 ml-2" />}
        </button>

        <button 
          onClick={handleNextTrack}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fcedea] text-[#b3261e] shadow-sm transition-transform hover:scale-105 active:scale-95"
          title="Lewati ke lagu berikutnya"
        >
          <SkipForward className="h-8 w-8" />
        </button>
      </div>

      <div className="flex w-full max-w-sm items-center gap-4 px-4 mt-4">
        <button onClick={toggleMute} className="text-[#725b56] hover:text-[#b3261e]">
          {isMuted || volume === 0 ? <VolumeX className="h-8 w-8" /> : <Volume2 className="h-8 w-8" />}
        </button>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={isMuted ? 0 : volume} 
          onChange={handleVolumeChange}
          className="cursor-pointer appearance-none rounded-full bg-[#f0dfdb] accent-[#b3261e] h-2 w-full"
          title="Volume Musik"
        />
      </div>
      
      <div className="mt-4 text-sm font-bold text-[#b3261e]">
        Remote Control Mode Aktif
      </div>
    </div>
  );
}
