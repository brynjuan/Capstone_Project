"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const ZegoCall = dynamic(() => import("../../components/ZegoCall"), { ssr: false });

export default function LiveHelpRoom({ adminName }: { adminName: string }) {
  const router = useRouter();

  return (
    <div className="h-full min-h-[560px]">
      <ZegoCall
        roomID="ruang-bantuan-telkom"
        userID="admin-cs"
        userName={`CS: ${adminName}`}
        onClose={() => router.push("/admin")}
      />
    </div>
  );
}
