"use client";

import { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

interface ZegoCallProps {
  roomID: string;
  onClose: () => void;
  userID?: string;   
  userName?: string; 
}

export default function ZegoCall({ roomID, onClose, userID, userName }: ZegoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  
  // DETEKTIF BARU: Mencatat apakah kita sudah masuk ruangan atau belum
  const isJoined = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // =================================================================
    // BENTENG BESI: Jika terdeteksi sudah join, tendang keluar eksekusi ke-2!
    if (isJoined.current) return;
    isJoined.current = true; // Langsung kunci pintunya!
    // =================================================================

    const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
    const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET as string;
    
    if (!appID || !serverSecret) return;

    const finalUserID = userID ? userID : "Kiosk-witel-01";
    const finalUserName = userName ? userName : "CS Witel Sulbagteng";

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomID,
      finalUserID,
      finalUserName
    );

    zpRef.current = ZegoUIKitPrebuilt.create(kitToken);
    
    // Sekarang joinRoom aman di dalam benteng perlindungan
    zpRef.current.joinRoom({
      container: containerRef.current, 
      scenario: {
        mode: ZegoUIKitPrebuilt.OneONoneCall,
      },
      showPreJoinView: false,
      turnOnMicrophoneWhenJoining: true,
      turnOnCameraWhenJoining: true,
      showLeaveRoomConfirmDialog: false,
      onLeaveRoom: () => {
        onClose(); 
      },
    });

    return () => {
      // CLEANUP: Bersihkan semuanya saat Kiosk menutup panggilan
      if (zpRef.current) {
        zpRef.current.destroy();
        zpRef.current = null;
      }
      isJoined.current = false; // Buka kunci untuk panggilan berikutnya
      
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Array kosong memastikan ini hanya pernah dijalankan 1x saat komponen muncul

  return (
    <div 
      className="w-full h-full rounded-[32px] overflow-hidden bg-black border border-white/10" 
      ref={containerRef} 
    />
  );
}