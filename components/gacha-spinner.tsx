"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Item {
  id: string;
  name: string;
  rarity: string;
  image_url: string;
  score_value: number;
}

interface LeaderboardData {
  chaos_stat: number;
  simp_stat: number;
  power_stat: number;
  item_power: number;
  total_power: number;
}

// Expanded rarities with colors
const rarityColors: Record<string, string> = {
  Mythic: "#ff0080",
  Legendary: "#ffff00",
  Epic: "#a855f7",
  Rare: "#00ffff",
  Uncommon: "#22c55e",
  Common: "#9ca3af",
};

// Drop rates (Chaos bonus adds to these)
const rarityWeights: Record<string, number> = {
  Mythic: 0.01, // 1%
  Legendary: 0.03, // 3%
  Epic: 0.07, // 7%
  Rare: 0.15, // 15%
  Uncommon: 0.25, // 25%
  Common: 0.49, // 49%
};

const CHAOS_MAX = 50;
const SIMP_MAX = 50;
const COOLDOWN_HOURS = 3;

export function GachaSpinner() {
  const [items, setItems] = useState<Item[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Item | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [nextSpinTime, setNextSpinTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<LeaderboardData | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [isSpinDisabled, setIsSpinDisabled] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const isChaosMaxed = (userStats?.chaos_stat || 0) >= CHAOS_MAX;
  const isSimpMaxed = (userStats?.simp_stat || 0) >= SIMP_MAX;

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_instagram_verified")
        .eq("id", user.id)
        .single();

      if (!profile?.is_instagram_verified) {
        router.push("/");
        return;
      }

      const { data: leaderboard } = await supabase
        .from("leaderboard")
        .select("chaos_stat, simp_stat, item_power, total_power")
        .eq("id", user.id)
        .single();

      if (leaderboard) {
        setUserStats({
          ...leaderboard,
          power_stat: leaderboard.total_power || 0,
        });
      }

      const { data: allItems } = await supabase
        .from("items")
        .select("*")
        .order("rarity");

      setItems(allItems || []);

      const { data: gacha } = await supabase
        .from("gacha_logs")
        .select("last_spin_timestamp")
        .eq("user_id", user.id)
        .maybeSingle();

      if (gacha && gacha.last_spin_timestamp) {
        const lastSpinMs = new Date(gacha.last_spin_timestamp).getTime();
        const nextSpinMs = lastSpinMs + COOLDOWN_HOURS * 60 * 60 * 1000;
        const nowMs = Date.now();

        if (nowMs < nextSpinMs) {
          setCanSpin(false);
          setNextSpinTime(new Date(nextSpinMs));
        }
      }

      setLoading(false);
    };

    loadData();
  }, []);

  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!nextSpinTime) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const nowMs = Date.now();
      const diff = Math.max(0, nextSpinTime.getTime() - nowMs);

      if (diff <= 0) {
        setCanSpin(true);
        setNextSpinTime(null);
        setCountdown("");
        setIsSpinDisabled(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    };

    updateCountdown();
    countdownIntervalRef.current = window.setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [nextSpinTime]);

  const getDropChance = (rarity: string): number => {
    const baseChance = rarityWeights[rarity] || 0;
    const chaosBonus = (userStats?.chaos_stat || 0) * 0.01;
    const adjustedChance = Math.min(baseChance + chaosBonus, baseChance * 2);
    return adjustedChance;
  };

  const selectItem = (): Item | null => {
    if (items.length === 0) return null;

    const pools: Record<string, Item[]> = {
      Mythic: items.filter((i) => i.rarity === "Mythic"),
      Legendary: items.filter((i) => i.rarity === "Legendary"),
      Epic: items.filter((i) => i.rarity === "Epic"),
      Rare: items.filter((i) => i.rarity === "Rare"),
      Uncommon: items.filter((i) => i.rarity === "Uncommon"),
      Common: items.filter((i) => i.rarity === "Common"),
    };

    const roll = Math.random();

    // Calculate cumulative chances with Chaos bonus
    const mythicChance = getDropChance("Mythic");
    const legendaryChance = getDropChance("Legendary");
    const epicChance = getDropChance("Epic");
    const rareChance = getDropChance("Rare");
    const uncommonChance = getDropChance("Uncommon");
    const commonChance =
      1 -
      mythicChance -
      legendaryChance -
      epicChance -
      rareChance -
      uncommonChance;

    let selectedRarity: string;

    if (roll < mythicChance) {
      selectedRarity = "Mythic";
    } else if (roll < mythicChance + legendaryChance) {
      selectedRarity = "Legendary";
    } else if (roll < mythicChance + legendaryChance + epicChance) {
      selectedRarity = "Epic";
    } else if (
      roll <
      mythicChance + legendaryChance + epicChance + rareChance
    ) {
      selectedRarity = "Rare";
    } else if (
      roll <
      mythicChance + legendaryChance + epicChance + rareChance + uncommonChance
    ) {
      selectedRarity = "Uncommon";
    } else {
      selectedRarity = "Common";
    }

    const pool = pools[selectedRarity] || [];

    if (pool.length === 0) {
      return items[Math.floor(Math.random() * items.length)];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  };

  const runLoadingAnimation = (targetItem: Item, onComplete: () => void) => {
    setSpinning(true);
    setResult(null);

    animationRef.current = setTimeout(() => {
      setResult(targetItem);
      setSpinning(false);
      onComplete();
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  const handleSpin = async () => {
    if (!canSpin || spinning || isSpinDisabled) return;
    setIsSpinDisabled(true);

    const selectedItemObj = selectItem();

    if (!selectedItemObj) {
      console.error("Failed to select an item");
      setIsSpinDisabled(false);
      return;
    }

    runLoadingAnimation(selectedItemObj, async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existing } = await supabase
          .from("inventory")
          .select("*")
          .eq("user_id", user.id)
          .eq("item_id", selectedItemObj.id)
          .maybeSingle();

        const isDuplicate = !!existing;
        const chaosIncrement = isDuplicate ? 0.05 : 0.1;

        if (existing) {
          await supabase
            .from("inventory")
            .update({ quantity: existing.quantity + 1 })
            .eq("id", existing.id);
        } else {
          await supabase.from("inventory").insert([
            {
              user_id: user.id,
              item_id: selectedItemObj.id,
              quantity: 1,
            },
          ]);
        }

        const { data: gacha } = await supabase
          .from("gacha_logs")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (gacha) {
          await supabase
            .from("gacha_logs")
            .update({ last_spin_timestamp: new Date().toISOString() })
            .eq("id", gacha.id);
        } else {
          await supabase.from("gacha_logs").insert([
            {
              user_id: user.id,
              last_spin_timestamp: new Date().toISOString(),
            },
          ]);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, chaos_stat")
          .eq("id", user.id)
          .single();

        if (profile) {
          const currentChaos = parseFloat(
            profile.chaos_stat?.toString() || "0",
          );
          const newChaos = Math.min(currentChaos + chaosIncrement, CHAOS_MAX);

          await supabase
            .from("profiles")
            .update({
              chaos_stat: newChaos,
            })
            .eq("id", profile.id);

          setUserStats((prev) =>
            prev
              ? {
                  ...prev,
                  chaos_stat: newChaos,
                }
              : null,
          );
        } else {
          await supabase.from("profiles").insert([
            {
              id: user.id,
              username:
                user.user_metadata?.full_name || user.email || "Unknown",
              chaos_stat: Math.min(chaosIncrement, CHAOS_MAX),
              simp_stat: 0,
            },
          ]);

          setUserStats((prev) =>
            prev
              ? { ...prev, chaos_stat: Math.min(chaosIncrement, CHAOS_MAX) }
              : {
                  chaos_stat: Math.min(chaosIncrement, CHAOS_MAX),
                  simp_stat: 0,
                  power_stat: 0,
                  item_power: 0,
                  total_power: Math.min(chaosIncrement, CHAOS_MAX),
                },
          );
        }

        setCanSpin(false);
        const nowMs = Date.now();
        const nextSpinMs = nowMs + COOLDOWN_HOURS * 60 * 60 * 1000;
        setNextSpinTime(new Date(nextSpinMs));

        const { data: updatedLeaderboard } = await supabase
          .from("leaderboard")
          .select("chaos_stat, simp_stat, item_power, total_power")
          .eq("id", user.id)
          .single();

        if (updatedLeaderboard) {
          setUserStats({
            ...updatedLeaderboard,
            power_stat: updatedLeaderboard.total_power || 0,
          });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          LOADING GACHA...
        </div>
      </div>
    );
  }

  const chaosBonusPercent = ((userStats?.chaos_stat || 0) * 1).toFixed(0);

  // Get chaos bonus for display
  const getChaosBonusText = () => {
    if (isChaosMaxed) return " (MAX)";
    return ` (+${chaosBonusPercent}% DROP)`;
  };

  // Get CHAOS increment based on rarity
  const getChaosIncrement = (rarity: string, isDuplicate: boolean) => {
    if (isDuplicate) return 0.05;
    switch (rarity) {
      case "Mythic":
        return 0.5;
      case "Legendary":
        return 0.3;
      case "Epic":
        return 0.2;
      case "Rare":
        return 0.15;
      case "Uncommon":
        return 0.12;
      default:
        return 0.1;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
      <h1
        style={{
          fontFamily: "'Press Start 2P', cursive",
          color: "#ff00ff",
          textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
          fontSize: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        DAILY GACHAPON
      </h1>

      <div className="mb-4 flex gap-4 text-xs">
        <div
          className="px-3 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: isChaosMaxed
              ? "rgba(0, 255, 0, 0.3)"
              : "rgba(255, 0, 255, 0.2)",
            color: isChaosMaxed ? "#00ff00" : "#ff00ff",
          }}
        >
          CHAOS: {(userStats?.chaos_stat || 0).toFixed(1)}
          {isChaosMaxed ? " (MAX)" : ` (+${chaosBonusPercent}% DROP)`}
        </div>
        <div
          className="px-3 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: isSimpMaxed
              ? "rgba(0, 255, 0, 0.3)"
              : "rgba(255, 0, 255, 0.2)",
            color: isSimpMaxed ? "#00ff00" : "#ff00ff",
          }}
        >
          SIMP: {(userStats?.simp_stat || 0).toFixed(1)}
          {isSimpMaxed && " (MAX)"}
        </div>
      </div>

      <div className="w-full max-w-md mb-6 flex justify-center">
        <div
          className="relative bg-black/80 rounded-xl border-4 flex items-center justify-center"
          style={{
            borderColor: result
              ? rarityColors[result.rarity] || "#00ffff"
              : "#00ffff",
            width: "300px",
            height: "450px",
            boxShadow: result
              ? `0 0 40px ${rarityColors[result.rarity]}, inset 0 0 30px ${rarityColors[result.rarity]}20`
              : "0 0 20px #00ffff50",
          }}
        >
          {spinning && (
            <motion.div
              className="flex flex-col items-center justify-center"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <div
                className="text-6xl"
                style={{
                  color: "#00ffff",
                  textShadow: "0 0 20px #00ffff",
                }}
              >
                ◆
              </div>
            </motion.div>
          )}

          {result && !spinning && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="flex flex-col items-center justify-center p-8"
            >
              {result.image_url ? (
                <img
                  src={result.image_url}
                  alt={result.name}
                  className="w-32 h-32 object-contain mb-4"
                />
              ) : (
                <div
                  className="text-6xl mb-4"
                  style={{
                    color: rarityColors[result.rarity] || "#00ffff",
                  }}
                >
                  □
                </div>
              )}
              <div
                className="text-lg text-center px-4"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: rarityColors[result.rarity] || "#00ffff",
                  textShadow: `0 0 20px ${rarityColors[result.rarity]}`,
                }}
              >
                {result.name}
              </div>
              <div
                className="text-xs mt-2"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: rarityColors[result.rarity] || "#00ffff",
                }}
              >
                {result.rarity.toUpperCase()}
              </div>
            </motion.div>
          )}

          {!spinning && !result && (
            <div
              className="text-center px-8"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#00ffff",
                fontSize: "0.8rem",
              }}
            >
              PRESS SPIN TO START
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4 text-center"
          >
            <p
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: rarityColors[result.rarity] || "#00ffff",
                textShadow: `0 0 20px ${rarityColors[result.rarity]}`,
                fontSize: "1rem",
                marginBottom: "0.5rem",
              }}
            >
              YOU GOT: {result.name.toUpperCase()}!
            </p>
            <p
              className="text-sm"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#00ffff",
              }}
            >
              +{getChaosIncrement(result.rarity, false)} CHAOS
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleSpin}
        disabled={!canSpin || spinning || isSpinDisabled}
        className="px-6 py-3 text-lg font-bold disabled:opacity-50"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          backgroundColor:
            canSpin && !spinning && !isSpinDisabled ? "#00ffff" : "#444444",
          color:
            canSpin && !spinning && !isSpinDisabled ? "#050505" : "#999999",
        }}
      >
        {spinning
          ? "SPINNING..."
          : !canSpin && countdown
            ? "COOLDOWN"
            : canSpin
              ? "SPIN NOW"
              : "LOCKED"}
      </button>

      {!canSpin && countdown && (
        <div
          className="mt-6 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ffff00",
            textShadow: "0 0 10px #ffff00",
          }}
        >
          <p className="text-xs mb-2">NEXT SPIN IN:</p>
          <p className="text-3xl tracking-widest">{countdown}</p>
        </div>
      )}

      <button
        onClick={() => router.push("/")}
        className="mt-6 px-4 py-2 text-xs"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          backgroundColor: "#ff00ff",
          color: "#050505",
        }}
      >
        BACK
      </button>

      <p
        className="mt-4 text-[10px] text-gray-500 text-center max-w-md"
        style={{ fontFamily: "'Press Start 2P', cursive" }}
      >
        CHAOS: +1% per point (max 50%) | DROP: Mythic 1%, Legendary 3%, Epic 7%,
        Rare 15%, Uncommon 25%, Common 49%
      </p>
    </div>
  );
}
