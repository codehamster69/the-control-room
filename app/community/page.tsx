"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CommunityLink {
  id: string;
  name: string;
  url: string;
  icon_emoji: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

export default function CommunityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(
    null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [communityLinks, setCommunityLinks] = useState<CommunityLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

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
    fetchCommunityLinks();
  }, []);

  const fetchCommunityLinks = async () => {
    try {
      const response = await fetch("/api/community/links");
      if (!response.ok) {
        throw new Error("Failed to fetch community links");
      }
      const data = await response.json();
      setCommunityLinks(data.links || []);
    } catch (err) {
      console.error("Failed to fetch community links:", err);
    } finally {
      setLinksLoading(false);
    }
  };

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
          textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
        }}
      >
        COMMUNITY
      </h1>

      {/* Community Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {linksLoading ? (
          <div className="col-span-full text-center py-12">
            <div className="text-cyan-400 font-mono text-xl animate-pulse">
              LOADING LINKS...
            </div>
          </div>
        ) : communityLinks.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#666",
                fontSize: "0.8rem",
              }}
            >
              NO COMMUNITY LINKS AVAILABLE
            </p>
            <p
              className="mt-4"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#444",
                fontSize: "0.6rem",
              }}
            >
              Check back later for group chat links!
            </p>
          </div>
        ) : (
          communityLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-5 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105 group"
              style={{
                borderColor: "#00ffff",
                boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 flex items-center justify-center text-3xl bg-black/50 border border-cyan-500/30 rounded-lg group-hover:border-cyan-400 transition-colors"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                  }}
                >
                  {link.icon_emoji || "🔗"}
                </div>
                <div className="flex-1">
                  <h3
                    className="font-bold mb-1"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: "#00ffff",
                      fontSize: "0.9rem",
                    }}
                  >
                    {link.name}
                  </h3>
                  {link.description && (
                    <p
                      className="text-gray-400 font-mono text-xs"
                      style={{ fontSize: "0.65rem" }}
                    >
                      {link.description}
                    </p>
                  )}
                </div>
                <div
                  className="text-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#00ffff" }}
                >
                  →
                </div>
              </div>
            </a>
          ))
        )}
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
