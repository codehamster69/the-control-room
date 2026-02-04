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
  chaos_stat: number;
  simp_stat: number;
  item_power: number;
  total_power: number;
  instagram_username?: string;
  instagram_avatar_url?: string;
}

interface UserRankInfo {
  rank: number | null;
  entry: LeaderboardEntry | null;
}

export function LeaderboardView() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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

    const { data, error } = await supabase
      .from("leaderboard")
      .select(
        `
        id,
        chaos_stat,
        simp_stat,
        item_power,
        total_power,
        username,
        avatar_url
      `,
      )
      .order("total_power", { ascending: false });

    // Also fetch profile data for instagram_username
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, instagram_username, avatar_url")
      .in(
        "id",
        (data || []).map((entry: any) => entry.id),
      );

    const profileMap = new Map(
      (profileData || []).map((profile) => [profile.id, profile]),
    );

    const leaderboardData = (data || []).map((entry: any) => {
      const profile = profileMap.get(entry.id);
      return {
        ...entry,
        user_id: entry.id,
        username: profile?.instagram_username || entry.username || "unknown",
        avatar_url: profile?.avatar_url || entry.avatar_url || null,
      };
    });

    setLeaderboard(leaderboardData);

    const userEntryIndex = leaderboardData.findIndex(
      (entry) => entry.user_id === user.id,
    );

    if (userEntryIndex !== -1) {
      setUserRank({
        rank: userEntryIndex + 1,
        entry: leaderboardData[userEntryIndex],
      });
      setUserEntry(leaderboardData[userEntryIndex]);
    } else {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("instagram_username, avatar_url")
        .eq("id", user.id)
        .single();

      const placeholderEntry: LeaderboardEntry = {
        id: user.id,
        user_id: user.id,
        username: userProfile?.instagram_username || "unknown",
        avatar_url: userProfile?.avatar_url || null,
        chaos_stat: 0,
        simp_stat: 0,
        item_power: 0,
        total_power: 0,
      };

      setUserRank({
        rank: null,
        entry: placeholderEntry,
      });
      setUserEntry(placeholderEntry);
    }

    const filtered = searchQuery
      ? leaderboardData.filter((entry) =>
          entry.username.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : leaderboardData;

    let initialEntries = filtered.slice(0, ITEMS_PER_PAGE);
    if (userEntryIndex === -1 && userEntry) {
      initialEntries = [...initialEntries, userEntry];
    }
    setDisplayedEntries(initialEntries);
    setPage(1);
    setHasMore(filtered.length > ITEMS_PER_PAGE);
    setLoading(false);
  }, [router, supabase, searchQuery]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;

    const filtered = searchQuery
      ? leaderboard.filter((entry) =>
          entry.username.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : leaderboard;

    const startIndex = page * ITEMS_PER_PAGE;
    const nextEntries = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    if (nextEntries.length > 0) {
      let entriesToAdd = nextEntries;
      if (userEntry && !filtered.find((e) => e.user_id === currentUserId)) {
        const insertIndex = startIndex + ITEMS_PER_PAGE - 1;
        if (insertIndex >= filtered.length) {
          entriesToAdd = [...nextEntries, userEntry];
        }
      }

      setDisplayedEntries((prev) => [...prev, ...entriesToAdd]);
      setPage((p) => p + 1);
      setHasMore(startIndex + ITEMS_PER_PAGE < filtered.length || !userEntry);
    } else {
      if (
        userEntry &&
        !displayedEntries.find((e) => e.user_id === currentUserId)
      ) {
        setDisplayedEntries((prev) => [...prev, userEntry]);
      }
      setHasMore(false);
    }
  }, [
    leaderboard,
    page,
    hasMore,
    searchQuery,
    userEntry,
    currentUserId,
    displayedEntries,
  ]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#ffff00";
    if (rank === 2) return "#00ffff";
    if (rank === 3) return "#ff6b6b";
    return "#ff00ff";
  };

  const getDisplayRank = (entry: LeaderboardEntry) => {
    const leaderboardIndex = leaderboard.findIndex(
      (e) => e.user_id === entry.user_id,
    );
    if (leaderboardIndex !== -1) {
      return leaderboardIndex + 1;
    }
    if (userRank.rank && entry.user_id === currentUserId) {
      return userRank.rank;
    }
    return displayedEntries.indexOf(entry) + 1;
  };

  const isCurrentUser = (entry: LeaderboardEntry) => {
    return entry.user_id === currentUserId;
  };

  const navigateToProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          LOADING LEADERBOARD...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-4 md:p-6">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
        <h1
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 10px #ff00ff, 0 0 20px #00ffff",
            fontSize: "1.25rem",
          }}
        >
          LEADERBOARD
        </h1>
        <button
          onClick={() => router.push("/")}
          className="px-3 py-2 text-xs"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#ff00ff",
            color: "#050505",
          }}
        >
          BACK
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="SEARCH PLAYER..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/50 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: "0.65rem",
          }}
        />
      </div>

      {/* Results count */}
      <div className="mb-3 text-gray-400 font-mono text-xs">
        {searchQuery
          ? `Found ${
              leaderboard.filter((entry) =>
                entry.username
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()),
              ).length
            } players`
          : `${leaderboard.length} players total`}
      </div>

      {/* Table Header */}
      <div
        className="grid gap-0 border-2 mb-1"
        style={{
          borderColor: "#00ffff",
          backgroundColor: "rgba(0, 255, 255, 0.1)",
          gridTemplateColumns: "60px 1fr 80px 80px 100px",
        }}
      >
        <div
          className="px-3 py-2 text-left"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ffff",
            fontSize: "0.55rem",
          }}
        >
          RANK
        </div>
        <div
          className="px-3 py-2 text-left"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ffff",
            fontSize: "0.55rem",
          }}
        >
          PLAYER
        </div>
        <div
          className="px-3 py-2 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            fontSize: "0.55rem",
          }}
        >
          CHAOS
        </div>
        <div
          className="px-3 py-2 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            fontSize: "0.55rem",
          }}
        >
          SIMP
        </div>
        <div
          className="px-3 py-2 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ffff00",
            fontSize: "0.55rem",
          }}
        >
          TOTAL
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        {displayedEntries.map((entry) => {
          const rank = getDisplayRank(entry);
          const isUser = isCurrentUser(entry);
          return (
            <div
              key={entry.user_id}
              className="grid gap-0 border-b border-gray-700 cursor-pointer hover:bg-[#1a1a2e] transition-colors"
              style={{
                gridTemplateColumns: "60px 1fr 80px 80px 100px",
                backgroundColor: isUser
                  ? "rgba(255, 200, 0, 0.08)"
                  : rank % 2 === 0
                    ? "rgba(255, 0, 255, 0.03)"
                    : "transparent",
                borderLeft: isUser ? "4px solid #ffff00" : "none",
              }}
              onClick={() => navigateToProfile(entry.user_id)}
            >
              {/* Rank */}
              <div
                className="px-3 py-3 flex items-center"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: getRankColor(rank),
                  fontSize: "0.65rem",
                }}
              >
                #{rank}
              </div>

              {/* Player */}
              <div className="px-3 py-3 flex items-center gap-2">
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      fontSize: "0.5rem",
                      color: "#ff00ff",
                    }}
                  >
                    ?
                  </div>
                )}
                <div className="flex flex-col">
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: isUser ? "#ffff00" : "#00ffff",
                      fontSize: "0.6rem",
                    }}
                  >
                    @{entry.username || "unknown"}
                  </span>
                  {isUser && (
                    <span
                      className="text-[9px] text-yellow-500"
                      style={{ fontFamily: "'Press Start 2P', cursive" }}
                    >
                      YOU
                    </span>
                  )}
                </div>
              </div>

              {/* Chaos */}
              <div
                className="px-3 py-3 flex items-center justify-center"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ff00ff",
                  fontSize: "0.65rem",
                }}
              >
                {(entry.chaos_stat || 0).toFixed(1)}
              </div>

              {/* Simp */}
              <div
                className="px-3 py-3 flex items-center justify-center"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ff00ff",
                  fontSize: "0.65rem",
                }}
              >
                {(entry.simp_stat || 0).toFixed(1)}
              </div>

              {/* Total */}
              <div
                className="px-3 py-3 flex items-center justify-center"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ffff00",
                  fontSize: "0.65rem",
                  textShadow: "0 0 5px #ffff00",
                }}
              >
                {Math.floor(entry.total_power || 0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading indicator */}
      {hasMore && (
        <div
          ref={observerTarget}
          className="flex justify-center py-4"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ffff",
            fontSize: "0.55rem",
          }}
        >
          LOADING MORE...
        </div>
      )}

      {!hasMore && displayedEntries.length > 0 && (
        <div
          className="text-center py-4 text-gray-500"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: "0.55rem",
          }}
        >
          END OF LEADERBOARD
        </div>
      )}

      {/* User Rank Summary */}
      {userRank.entry && (
        <div
          className="mt-6 pt-4 border-t-2"
          style={{ borderColor: "#ff00ff" }}
        >
          <div
            className="p-4 rounded"
            style={{ backgroundColor: "rgba(255, 0, 255, 0.1)" }}
          >
            <div className="flex justify-between items-center flex-wrap gap-4">
              {/* Rank */}
              <div className="flex items-center gap-3">
                <span
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: "#ff00ff",
                    fontSize: "0.7rem",
                  }}
                >
                  RANK
                </span>
                <div
                  className="px-4 py-2 rounded font-bold"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor: userRank.rank
                      ? getRankColor(userRank.rank)
                      : "#666",
                    color: "#000",
                    fontSize: "0.75rem",
                  }}
                >
                  {userRank.rank ? `#${userRank.rank}` : "UNRANKED"}
                </div>
              </div>

              {/* Player Info */}
              <div className="flex items-center gap-3">
                {userRank.entry.avatar_url ? (
                  <img
                    src={userRank.entry.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      fontSize: "0.6rem",
                      color: "#ff00ff",
                    }}
                  >
                    ?
                  </div>
                )}
                <div className="flex flex-col">
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: "#00ffff",
                      fontSize: "0.65rem",
                    }}
                  >
                    @{userRank.entry.username}
                  </span>
                  <div className="flex gap-2 mt-1">
                    <span
                      className="px-2 py-0.5 rounded text-[10px]"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        backgroundColor: "#ff00ff",
                        color: "#000",
                      }}
                    >
                      CHAOS: {(userRank.entry.chaos_stat || 0).toFixed(1)}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px]"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        backgroundColor: "#ff00ff",
                        color: "#000",
                      }}
                    >
                      SIMP: {(userRank.entry.simp_stat || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Power */}
              <div
                className="px-4 py-2 rounded font-bold"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  backgroundColor: "#ffff00",
                  color: "#000",
                  fontSize: "0.7rem",
                }}
              >
                {Math.floor(userRank.entry.total_power || 0)} POWER
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No entries */}
      {leaderboard.length === 0 && !userEntry && (
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

      {/* Stats Info */}
      <div className="mt-4 p-3 rounded bg-black/30 border border-gray-800">
        <p
          className="text-gray-500 text-[10px] font-mono"
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          CHAOS: Higher = Better gacha drop rates (1% per point, max 50%) |
          SIMP: Higher = Better upgrade success rates (1% per point, max 50%)
        </p>
      </div>
    </div>
  );
}
