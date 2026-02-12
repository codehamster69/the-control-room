"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_power: number;
  monthly_power_gain: number;
  instagram_username?: string;
  instagram_avatar_url?: string;
}

interface UserRankInfo {
  rank: number | null;
  entry: LeaderboardEntry | null;
}

type LeaderboardType = "global" | "monthly";

export function LeaderboardView() {
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [activeTab, setActiveTab] = useState<LeaderboardType>("global");
  const [displayedEntries, setDisplayedEntries] = useState<LeaderboardEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userRank, setUserRank] = useState<UserRankInfo>({
    rank: null,
    entry: null,
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const ITEMS_PER_PAGE = 10;

  const loadLeaderboard = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_instagram_verified")
      .eq("id", user.id)
      .single();

    if (!profile?.is_instagram_verified) {
      router.push("/");
      return;
    }

    // Load both leaderboards - only verified users
    const { data: globalData } = await supabase
      .from("profiles")
      .select(
        "id, username, avatar_url, total_power, monthly_power_gain, instagram_username",
      )
      .eq("is_instagram_verified", true)
      .order("total_power", { ascending: false })
      .limit(100);

    const { data: monthlyData } = await supabase
      .from("profiles")
      .select(
        "id, username, avatar_url, total_power, monthly_power_gain, instagram_username",
      )
      .eq("is_instagram_verified", true)
      .order("monthly_power_gain", { ascending: false })
      .limit(100);

    const processEntries = (data: any[] | null): LeaderboardEntry[] => {
      return (data || []).map((entry: any, index: number) => ({
        id: entry.id,
        user_id: entry.id,
        username: entry.username || entry.instagram_username || "Unknown",
        avatar_url: entry.avatar_url,
        total_power: entry.total_power || 0,
        monthly_power_gain: entry.monthly_power_gain || 0,
        instagram_username: entry.instagram_username,
      }));
    };

    const globalEntries = processEntries(globalData);
    const monthlyEntries = processEntries(monthlyData);

    setGlobalLeaderboard(globalEntries);
    setMonthlyLeaderboard(monthlyEntries);

    // Find user in both leaderboards
    const globalUserIndex = globalEntries.findIndex(
      (entry) => entry.user_id === user.id,
    );
    const monthlyUserIndex = monthlyEntries.findIndex(
      (entry) => entry.user_id === user.id,
    );

    if (activeTab === "global" && globalUserIndex !== -1) {
      setUserRank({
        rank: globalUserIndex + 1,
        entry: globalEntries[globalUserIndex],
      });
      setUserEntry(globalEntries[globalUserIndex]);
    } else if (activeTab === "monthly" && monthlyUserIndex !== -1) {
      setUserRank({
        rank: monthlyUserIndex + 1,
        entry: monthlyEntries[monthlyUserIndex],
      });
      setUserEntry(monthlyEntries[monthlyUserIndex]);
    }

    setDisplayedEntries(
      activeTab === "global"
        ? globalEntries.slice(0, ITEMS_PER_PAGE)
        : monthlyEntries.slice(0, ITEMS_PER_PAGE),
    );
    setHasMore(
      (activeTab === "global" ? globalEntries : monthlyEntries).length >
        ITEMS_PER_PAGE,
    );
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    // Update displayed entries when tab changes
    const entries =
      activeTab === "global" ? globalLeaderboard : monthlyLeaderboard;
    setDisplayedEntries(entries.slice(0, (page + 1) * ITEMS_PER_PAGE));
    setHasMore(entries.length > (page + 1) * ITEMS_PER_PAGE);

    // Update user rank for current tab
    if (currentUserId) {
      const userIndex = entries.findIndex(
        (entry) => entry.user_id === currentUserId,
      );
      if (userIndex !== -1) {
        setUserRank({ rank: userIndex + 1, entry: entries[userIndex] });
        setUserEntry(entries[userIndex]);
      }
    }
  }, [activeTab, globalLeaderboard, monthlyLeaderboard]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const entries =
            activeTab === "global" ? globalLeaderboard : monthlyLeaderboard;
          const nextPage = page + 1;
          const nextEntries = entries.slice(0, (nextPage + 1) * ITEMS_PER_PAGE);
          setDisplayedEntries(nextEntries);
          setPage(nextPage);
          setHasMore(entries.length > (nextPage + 1) * ITEMS_PER_PAGE);
        }
      },
      { threshold: 0.1 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [
    hasMore,
    loading,
    page,
    activeTab,
    globalLeaderboard,
    monthlyLeaderboard,
  ]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      const entries =
        activeTab === "global" ? globalLeaderboard : monthlyLeaderboard;
      setDisplayedEntries(entries.slice(0, ITEMS_PER_PAGE));
      setPage(0);
      setHasMore(entries.length > ITEMS_PER_PAGE);
      return;
    }

    const query = searchQuery.toLowerCase();
    const entries =
      activeTab === "global" ? globalLeaderboard : monthlyLeaderboard;
    const filtered = entries.filter(
      (entry) =>
        entry.username.toLowerCase().includes(query) ||
        entry.instagram_username?.toLowerCase().includes(query),
    );
    setDisplayedEntries(filtered);
    setHasMore(false);
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1)
      return {
        color: "#ffd700",
        bg: "rgba(255, 215, 0, 0.2)",
        border: "#ffd700",
      };
    if (rank === 2)
      return {
        color: "#c0c0c0",
        bg: "rgba(192, 192, 192, 0.2)",
        border: "#c0c0c0",
      };
    if (rank === 3)
      return {
        color: "#cd7f32",
        bg: "rgba(205, 127, 50, 0.2)",
        border: "#cd7f32",
      };
    return {
      color: "#00ffff",
      bg: "rgba(0, 255, 255, 0.1)",
      border: "#00ffff",
    };
  };

  const currentLeaderboard =
    activeTab === "global" ? globalLeaderboard : monthlyLeaderboard;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505] mb-4 flex justify-between items-center flex-wrap gap-4">
        <h1
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
            fontSize: "1.2rem",
          }}
        >
          RANKING
        </h1>
        <button
          onClick={() => router.push("/")}
          className="px-3 py-1.5 text-[10px]"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#ff00ff",
            color: "#050505",
          }}
        >
          BACK
        </button>
      </div>

      {/* Tab Selection */}
      <div className="mb-4 flex border-2" style={{ borderColor: "#333" }}>
        <button
          onClick={() => setActiveTab("global")}
          className="flex-1 px-4 py-2 text-[10px] transition-colors"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor:
              activeTab === "global" ? "rgba(255, 215, 0, 0.3)" : "transparent",
            color: activeTab === "global" ? "#ffd700" : "#666",
          }}
        >
          🏆 GLOBAL (ALL TIME)
        </button>
        <button
          onClick={() => setActiveTab("monthly")}
          className="flex-1 px-4 py-2 text-[10px] transition-colors"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor:
              activeTab === "monthly"
                ? "rgba(0, 255, 255, 0.3)"
                : "transparent",
            color: activeTab === "monthly" ? "#00ffff" : "#666",
          }}
        >
          📅 MONTHLY (RESETS 1ST)
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="SEARCH USER..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 px-3 py-2 text-[10px] bg-black border-2"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            borderColor: "#333",
            color: "#00ffff",
          }}
        />
        <button
          onClick={handleSearch}
          className="px-3 py-2"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#00ffff",
            color: "#000",
            fontSize: "0.6rem",
          }}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* User's Own Rank - Mobile Optimized */}
      {userRank.entry && (
        <div
          className="mb-4 p-3 rounded border-2 fixed bottom-0 right-0 left-0"
          style={{
            borderColor: "#ff00ff",
            backgroundColor: "rgba(255, 0, 255, 0.1)",
          }}
        >
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div
              className="text-lg font-bold"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ff00ff",
                fontSize: "0.8rem",
              }}
            >
              #{userRank.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-xs truncate"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#fff",
                }}
              >
                {userRank.entry.instagram_username}
              </div>
              <div
                className="text-[9px] text-gray-400"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                YOU
              </div>
            </div>
            <div
              className="px-2 py-1 rounded text-xs"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                backgroundColor: "#ffff00",
                color: "#000",
              }}
            >
              {activeTab === "global"
                ? userRank.entry.total_power
                : userRank.entry.monthly_power_gain}{" "}
              PWR
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Entries - Mobile Optimized */}
      <div className="space-y-2">
        {displayedEntries.map((entry, index) => {
          const rank = index + 1;
          const rankStyle = getRankStyle(rank);
          const isCurrentUser = entry.user_id === currentUserId;

          return (
            <div
              key={entry.user_id}
              onClick={() => router.push(`/profile/${entry.user_id}`)}
              className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded border cursor-pointer transition-all hover:scale-[1.02] ${isCurrentUser ? "ring-2 ring-pink-500" : ""}`}
              style={{
                fontFamily: "'Press Start 2P', cursive",
                borderColor: rankStyle.border,
                backgroundColor: rankStyle.bg,
              }}
            >
              {/* Rank */}
              <div className="w-8 md:w-10 text-center shrink-0">
                <span
                  style={{
                    color: rankStyle.color,
                    fontSize: rank <= 3 ? "1rem" : "0.75rem",
                  }}
                >
                  {rank <= 3
                    ? rank === 1
                      ? "🥇"
                      : rank === 2
                        ? "🥈"
                        : "🥉"
                    : `#${rank}`}
                </span>
              </div>

              {/* Avatar */}
              <div
                className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 border"
                style={{ borderColor: rankStyle.border }}
              >
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs">
                    ?
                  </div>
                )}
              </div>

              {/* Username - Truncated on mobile */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs truncate"
                  style={{ color: rankStyle.color }}
                >
                  @{entry.instagram_username}
                </div>
                {entry.instagram_username &&
                  entry.instagram_username !== entry.username && (
                    <div className="text-[8px] text-gray-500 truncate">
                      IG: @{entry.instagram_username}
                    </div>
                  )}
              </div>

              {/* Power - Compact on mobile */}
              <div
                className="px-2 py-1 rounded text-right shrink-0"
                style={{
                  backgroundColor:
                    rank <= 3 ? rankStyle.color : "rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="text-xs font-bold"
                  style={{
                    color: rank <= 3 ? "#000" : rankStyle.color,
                    fontSize: "0.65rem",
                  }}
                >
                  {activeTab === "global"
                    ? entry.total_power
                    : entry.monthly_power_gain}
                </div>
                <div
                  className="text-[7px]"
                  style={{ color: rank <= 3 ? "#000" : "#888" }}
                >
                  PWR
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading indicator */}
      <div ref={observerTarget} className="h-4 mt-4" />

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div
            className="text-cyan-400 font-mono animate-pulse"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "0.7rem",
            }}
          >
            LOADING...
          </div>
        </div>
      )}

      {/* No entries */}
      {!loading && currentLeaderboard.length === 0 && (
        <div
          className="text-center py-12"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#666",
            fontSize: "0.7rem",
          }}
        >
          NO PLAYERS ON LEADERBOARD YET
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 rounded bg-black/30 border border-gray-800">
        <p
          className="text-gray-500 text-[9px] md:text-[10px]"
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          {activeTab === "global"
            ? "GLOBAL: All-time power ranking. Never resets."
            : "MONTHLY: Resets on the 1st of each month. Hunt to gain monthly power!"}
        </p>
      </div>
    </div>
  );
}
