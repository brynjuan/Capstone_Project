"use client";

import { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

// 1. DAFTARKAN USERID DAN USERNAME DI SINI (Opsional dengan tanda '?')
interface ZegoCallProps {
  roomID: string;
  onClose: () => void;
  userID?: string;   
  userName?: string; 
}

// 2. PANGGIL MEREKA DI DALAM KURUNG KURAWAL INI
export default function ZegoCall({ roomID, onClose, userID, userName }: ZegoCallProps) {
  const zpRef = useRef<any>(null);

  const myMeeting = (element: HTMLDivElement | null) => {
    if (!element) return; 

    const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
    const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET as string;
    
    if (!appID || !serverSecret) {
      console.error("API Key ZegoCloud belum terbaca.");
      return;
    }

    // 3. SEKARANG TYPESCRIPT PAHAM DARI MANA ASAL USERID & USERNAME INI
    const finalUserID = userID ? userID : "kiosk-witel-01";
    const finalUserName = userName ? userName : "Kiosk Witel Sulbagteng";

    console.log("Masuk sebagai:", finalUserName, `(ID: ${finalUserID})`);

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomID,
      finalUserID,
      finalUserName
    );

    zpRef.current = ZegoUIKitPrebuilt.create(kitToken);
    
    zpRef.current.joinRoom({
      container: element, 
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
  };

  useEffect(() => {
    return () => {
      if (zpRef.current) {
        zpRef.current.destroy();
      }
    };
  }, []);

  return (
    <div 
      className="w-full h-full rounded-[32px] overflow-hidden bg-black border border-white/10" 
      ref={myMeeting} 
    />
  );
}