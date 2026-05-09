"use client";

import { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

interface ZegoCallProps {
  roomID: string;
  onClose: () => void;
  userID?: string;   // Tambahkan ini
  userName?: string; // Tambahkan ini
}

export default function ZegoCall({ roomID, onClose }: ZegoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let zpInstance: any = null;

    const initZego = async () => {
      // 1. Ambil Kunci dari .env
      const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
      const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET as string;
      
      // PERTAHANAN: Cek apakah .env sudah terbaca
      if (!appID || !serverSecret) {
        alert("Gagal: API Key ZegoCloud tidak ditemukan! Pastikan sudah menaruh di .env dan MERESTART server (npm run dev).");
        return;
      }

      // 2. Gunakan ID Statis untuk Kiosk (Agar tidak ada tamu hantu)
      const userID = "kiosk-lobi-witel-01";
      const userName = "Kiosk Witel Sulbagteng";

      // 3. Buat Tiket Masuk
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        userID,
        userName
      );

      // 4. Bangun Ruangan Video
      zpInstance = ZegoUIKitPrebuilt.create(kitToken);
      zpInstance.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        showPreJoinView: false, 
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: true,
        showLeaveRoomConfirmDialog: false,
        onLeaveRoom: () => {
          // Beritahu parent (page.tsx) untuk menutup pop-up saat tombol merah ditekan
          onClose(); 
        },
      });
    };

    if (containerRef.current) {
      initZego();
    }

    // CLEANUP FUNCTION
    return () => {
      if (zpInstance) {
        zpInstance.destroy();
      }
    };
    
    // PERBAIKAN UTAMA: Hapus 'onClose' dari array di bawah ini!
    // Ini mencegah Kiosk menghancurkan video call setiap kali ada render ulang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomID]); 

  return (
    <div 
      className="w-full h-full rounded-3xl overflow-hidden bg-black border border-white/10" 
      ref={containerRef} 
    />
  );
}