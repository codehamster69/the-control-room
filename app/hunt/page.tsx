import { HuntBotPanel } from "@/components/hunt-bot-panel";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function HuntPage() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Check Instagram verification
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_instagram_verified")
    .eq("id", user.id)
    .single();

  if (!profile?.is_instagram_verified) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-50 bg-[#050505] p-3 sm:p-4 border-b border-gray-800 flex flex-row justify-between items-center gap-2 sm:gap-4">
        <h1
          className="text-base sm:text-lg"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ff00",
            textShadow: "0 0 5px #00ff00",
          }}
        >
          HUNT BOT
        </h1>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded border border-gray-700 hover:bg-gray-800 transition-colors"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: "0.6rem",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </Link>
      </div>

      {/* Hunt Bot Panel */}
      <HuntBotPanel />
    </div>
  );
}
