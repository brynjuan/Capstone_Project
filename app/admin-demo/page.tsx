"use client";

import dynamic from "next/dynamic";
import { Headset } from "lucide-react";

// Muat ZegoCall tanpa Server-Side Rendering
const ZegoCall = dynamic(() => import("../components/ZegoCall"), { ssr: false });

export default function AdminDemoPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-10 font-sans">
      <div className="w-full max-w-6xl">
        
        {/* Layar Video Admin */}
        <div className="w-full h-[75vh] bg-black rounded-3xl overflow-hidden border-2 border-gray-700 shadow-2xl">
          <ZegoCall 
            roomID="ruang-bantuan-telkom" // Harus sama persis dengan kiosk
            onClose={() => alert("Panggilan telah ditutup oleh tamu.")}
            userID="admin-cs-nita"        // ID KHUSUS ADMIN
            userName="CS: Nita Wulandari" // NAMA KHUSUS ADMIN
          />
        </div>

      </div>
    </div>
  );
}
