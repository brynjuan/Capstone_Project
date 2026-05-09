"use client";

import dynamic from "next/dynamic";
import { Headset } from "lucide-react";

// Muat ZegoCall tanpa Server-Side Rendering
const ZegoCall = dynamic(() => import("../components/ZegoCall"), { ssr: false });

export default function AdminDemoPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-10 font-sans">
      <div className="w-full max-w-6xl">
        
        {/* Header Admin */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-red-600 rounded-2xl">
            <Headset className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard CS Telkom (Demo)</h1>
            <p className="text-gray-400">Menunggu panggilan masuk dari Kiosk...</p>
          </div>
        </div>

        {/* Layar Video Admin */}
        <div className="w-full h-[75vh] bg-black rounded-3xl overflow-hidden border-2 border-gray-700 shadow-2xl">
          <ZegoCall 
            roomID="ruang-bantuan-telkom" // Harus SAMA PERSIS dengan Kiosk
            onClose={() => alert("Panggilan telah ditutup oleh tamu.")}
            userID="admin-cs-nita"        // ID KHUSUS ADMIN
            userName="CS: Nita Wulandari" // NAMA KHUSUS ADMIN
          />
        </div>

      </div>
    </div>
  );
}