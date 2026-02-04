"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Instagram,
  Gift,
  Search,
  Users,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import InstagramVerification from "@/components/instagram-verification-form";
import Link from "next/link";

interface ProfileData {
  id: string;
  instagram_username: string | null;
  avatar_url: string | null;
  is_instagram_verified: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Get user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, instagram_username, avatar_url, is_instagram_verified")
          .eq("id", user.id)
          .single();

        setProfile(profileData);
      }

      setUser(user);
      setIsLoading(false);
    };

    checkUser();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setAuthError(error.message);
        } else {
          setAuthError(
            "Check your email for the confirmation link! (Check spam/junk folder if not in inbox)",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (
            error.message.includes("Failed to fetch") ||
            error.message.includes("network")
          ) {
            setAuthError(
              "Unable to connect to authentication server. Please check your Supabase configuration.",
            );
          } else {
            setAuthError(error.message);
          }
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          setUser(user);

          // Get profile after login
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, instagram_username, avatar_url, is_instagram_verified")
            .eq("id", user?.id)
            .single();
          setProfile(profileData);
        }
      }
    } catch (err: any) {
      if (
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("network")
      ) {
        setAuthError(
          "Unable to connect to authentication server. Please check your Supabase configuration.",
        );
      } else {
        setAuthError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setEmail("");
    setPassword("");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, instagram_username, avatar_url, is_instagram_verified")
        .ilike("instagram_username", `%${searchQuery}%`)
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          INITIALIZING...
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-8 max-w-lg">
          <h1
            className="text-5xl md:text-7xl font-bold text-center"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              color: "#ff00ff",
              textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
            }}
          >
            THE CONTROL ROOM
          </h1>

          <p
            className="text-center text-lg"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              color: "#00ffff",
              textShadow: "0 0 10px #00ffff",
            }}
          >
            ENTER THE GLITCH
          </p>

          {/* Email/Password Auth Form */}
          <form
            onSubmit={handleEmailAuth}
            className="w-full max-w-sm space-y-4"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="EMAIL"
              className="w-full px-4 py-3 bg-black/50 border border-pink-500/30 text-white font-mono placeholder:text-gray-600 focus:border-pink-500 focus:ring-pink-500/20 rounded"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="PASSWORD"
              className="w-full px-4 py-3 bg-black/50 border border-pink-500/30 text-white font-mono placeholder:text-gray-600 focus:border-pink-500 focus:ring-pink-500/20 rounded"
              required
              minLength={6}
            />

            {authError && (
              <div className="text-red-400 font-mono text-xs text-center">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full px-12 py-6 text-2xl"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                backgroundColor: "#ff00ff",
                color: "#050505",
              }}
            >
              {isLoading ? "LOADING..." : isSignUp ? "SIGN UP" : "PRESS START"}
            </Button>
          </form>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthError(null);
            }}
            className="text-cyan-400 font-mono text-sm hover:text-cyan-300"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    );
  }

  // Show verification form if logged in but not verified
  if (!profile?.is_instagram_verified) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <h1
          className="text-2xl md:text-4xl font-bold mb-8 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
          }}
        >
          VERIFY INSTAGRAM
        </h1>

        <p
          className="text-center text-gray-400 font-mono mb-8 max-w-md"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: "0.75rem",
          }}
        >
          You must verify your Instagram account to access The Control Room.
        </p>

        <div className="w-full max-w-md">
          <InstagramVerification />
        </div>

        <button
          onClick={handleLogout}
          className="mt-8 px-6 py-3 text-sm"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#ff00ff",
            color: "#050505",
          }}
        >
          LOGOUT
        </button>
      </div>
    );
  }

  // Show dashboard if logged in and verified
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center p-6">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1
          className="text-xl md:text-3xl font-bold"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
          }}
        >
          THE CONTROL ROOM
        </h1>

        <div className="flex items-center gap-4">
          <Link
            href={`/profile/${user.id}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-10 h-10 rounded-full border-2"
                style={{ borderColor: "#00ffff" }}
              />
            )}
            <div className="text-right">
              <div
                className="text-cyan-400 font-mono"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  fontSize: "0.75rem",
                }}
              >
                @{profile?.instagram_username}
              </div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-400 text-xs font-mono"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* Search Section */}
      <Card className="w-full max-w-4xl mb-8 bg-black/50 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-cyan-400 font-mono flex items-center gap-2">
            <Search className="w-5 h-5" />
            SEARCH USERS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Instagram username..."
              className="flex-1 bg-black/50 border-pink-500/30 text-white font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-cyan-600 hover:bg-cyan-700 font-mono"
            >
              {searching ? "SEARCHING..." : "SEARCH"}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((result) => (
                <Link
                  key={result.id}
                  href={`/profile/${result.id}`}
                  className="flex items-center gap-4 p-3 bg-black/30 rounded-lg border border-pink-500/20 hover:bg-pink-500/10 transition-colors cursor-pointer"
                >
                  {result.avatar_url ? (
                    <img
                      src={result.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                      <span className="text-gray-400">?</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-cyan-400 font-mono">
                      @{result.instagram_username}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {result.is_instagram_verified ? (
                        <span className="text-green-400">✓ Verified</span>
                      ) : (
                        <span className="text-gray-500">Unverified</span>
                      )}
                    </div>
                  </div>
                  <div className="text-pink-500 text-sm font-mono">→</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-4xl">
        {/* Gacha */}
        <Link
          href="/gacha"
          className="group p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105 text-center"
          style={{
            borderColor: "#ff00ff",
            boxShadow: "0 0 10px rgba(255, 0, 255, 0.2)",
          }}
        >
          <Gift className="w-12 h-12 mx-auto mb-4 text-pink-500 group-hover:animate-bounce" />
          <h3
            className="font-bold mb-2"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "0.9rem",
              color: "#ff00ff",
            }}
          >
            GACHA
          </h3>
          <p className="text-gray-400 font-mono text-xs">
            Spin daily for items
          </p>
        </Link>

        {/* Armory */}
        <Link
          href="/armory"
          className="group p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105 text-center"
          style={{
            borderColor: "#00ffff",
            boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
          }}
        >
          <Users className="w-12 h-12 mx-auto mb-4 text-cyan-500 group-hover:animate-bounce" />
          <h3
            className="font-bold mb-2"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "0.9rem",
              color: "#00ffff",
            }}
          >
            ARMORY
          </h3>
          <p className="text-gray-400 font-mono text-xs">View your inventory</p>
        </Link>

        {/* Leaderboard */}
        <Link
          href="/leaderboard"
          className="group p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105 text-center"
          style={{
            borderColor: "#ffff00",
            boxShadow: "0 0 10px rgba(255, 255, 0, 0.2)",
          }}
        >
          <svg
            className="w-12 h-12 mx-auto mb-4 text-yellow-500 group-hover:animate-bounce"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <h3
            className="font-bold mb-2"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "0.9rem",
              color: "#ffff00",
            }}
          >
            RANKING
          </h3>
          <p className="text-gray-400 font-mono text-xs">Top collectors</p>
        </Link>

        {/* Community */}
        <Link
          href="/community"
          className="group p-6 border-2 hover:bg-[#1a1a2e] transition-all hover:scale-105 text-center"
          style={{
            borderColor: "#00ff00",
            boxShadow: "0 0 10px rgba(0, 255, 0, 0.2)",
          }}
        >
          <svg
            className="w-12 h-12 mx-auto mb-4 text-green-500 group-hover:animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3
            className="font-bold mb-2"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "0.9rem",
              color: "#00ff00",
            }}
          >
            COMMUNITY
          </h3>
          <p className="text-gray-400 font-mono text-xs">Join our links</p>
        </Link>
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
