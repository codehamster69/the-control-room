"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CommunityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(
    null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("instagram_username, avatar_url, is_instagram_verified")
        .eq("id", user.id)
        .single();

      // Check if user is verified, if not redirect to home
      if (!profile?.is_instagram_verified) {
        router.push("/");
        return;
      }

      setUser(user);
      setInstagramUsername(profile?.instagram_username);
      setAvatarUrl(profile?.avatar_url);
      setIsLoading(false);
    };

    checkUser();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center p-6">
      {/* Header with User Info */}
      <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <Link
          href="/"
          className="px-4 py-2 text-sm hover:opacity-80"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#ff00ff",
            color: "#050505",
          }}
        >
          ← BACK
        </Link>

        <div className="flex items-center gap-4">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: "#00ffff" }}
            />
          )}
          <span
            className="text-cyan-400 font-mono"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "0.75rem",
            }}
          >
            @{instagramUsername}
          </span>
        </div>
      </div>

      {/* Title */}
      <h1
        className="text-3xl md:text-5xl font-bold mb-12 text-center"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          color: "#ff00ff",
          textShadow: "0 0 10px #ff00ff, 0 0 20px #00ffff",
        }}
      >
        COMMUNITY
      </h1>

      {/* Community Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Discord */}
        <a
          href="https://discord.gg/your-server"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105"
          style={{
            borderColor: "#5865F2",
            boxShadow: "0 0 10px rgba(88, 101, 242, 0.3)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center text-4xl">
              💬
            </div>
            <div>
              <h3
                className="text-lg font-bold mb-1"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#5865F2",
                }}
              >
                DISCORD
              </h3>
              <p className="text-gray-400 font-mono text-sm">
                Join our community
              </p>
            </div>
          </div>
        </a>

        {/* Twitter/X */}
        <a
          href="https://twitter.com/your-account"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105"
          style={{
            borderColor: "#000000",
            boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center text-4xl">
              𝕏
            </div>
            <div>
              <h3
                className="text-lg font-bold mb-1"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ffffff",
                }}
              >
                X / TWITTER
              </h3>
              <p className="text-gray-400 font-mono text-sm">
                Follow us for updates
              </p>
            </div>
          </div>
        </a>

        {/* GitHub */}
        <a
          href="https://github.com/your-repo"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105"
          style={{
            borderColor: "#333333",
            boxShadow: "0 0 10px rgba(51, 51, 51, 0.3)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center text-4xl">
              ⭐
            </div>
            <div>
              <h3
                className="text-lg font-bold mb-1"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ffffff",
                }}
              >
                GITHUB
              </h3>
              <p className="text-gray-400 font-mono text-sm">
                View source code
              </p>
            </div>
          </div>
        </a>

        {/* Website */}
        <a
          href="https://your-website.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105"
          style={{
            borderColor: "#00ffff",
            boxShadow: "0 0 10px rgba(0, 255, 255, 0.3)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center text-4xl">
              🌐
            </div>
            <div>
              <h3
                className="text-lg font-bold mb-1"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#00ffff",
                }}
              >
                WEBSITE
              </h3>
              <p className="text-gray-400 font-mono text-sm">
                Official homepage
              </p>
            </div>
          </div>
        </a>
      </div>

      {/* Footer */}
      <div
        className="mt-16 text-center"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          color: "#666666",
          fontSize: "0.6rem",
        }}
      >
        <p>THE CONTROL ROOM © 2025</p>
      </div>
    </div>
  );
}
