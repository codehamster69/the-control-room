"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
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

const rarityColors = {
  Legendary: "#ffff00",
  Rare: "#00ffff",
  Common: "#ff00ff",
};

const rarityWeights = {
  Legendary: 0.05, // 5% base chance
  Rare: 0.2, // 20% base chance
  Common: 0.75, // 75% base chance
};

export function GachaSpinner() {
  const [items, setItems] = useState<Item[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Item | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [nextSpinTime, setNextSpinTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<LeaderboardData | null>(null);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState<string>("");
  const trainRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Format time remaining as HH:MM:SS (using UTC for consistency)
  const formatTimeRemaining = (targetTime: Date) => {
    const nowMs = Date.now(); // Use UTC timestamp
    const diff = Math.max(0, targetTime.getTime() - nowMs);

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

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

      // Load user's leaderboard stats (Chaos/Simp, Power calculated from inventory)
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

      // Initialize displayItems with first item as placeholder
      if (allItems && allItems.length > 0) {
        setDisplayItems([allItems[0]]);
      }

      const { data: gacha } = await supabase
        .from("gacha_logs")
        .select("last_spin_timestamp")
        .eq("user_id", user.id)
        .maybeSingle();

      if (gacha && gacha.last_spin_timestamp) {
        // Parse the timestamp and handle timezone correctly
        // The database stores UTC, but we want to show user's local time
        const lastSpinDate = new Date(gacha.last_spin_timestamp);

        // Get the timezone offset in milliseconds for the user's local timezone
        // getTimezoneOffset() returns minutes, positive for behind UTC
        const tzOffsetMs = lastSpinDate.getTimezoneOffset() * 60 * 1000;

        // Adjust the timestamp to show when it happened in user's local time
        const lastSpinLocalMs = lastSpinDate.getTime() - tzOffsetMs;
        const nextSpinLocalMs = lastSpinLocalMs + 24 * 60 * 60 * 1000;

        // Current time in local timezone
        const nowLocalMs = Date.now();

        if (nowLocalMs < nextSpinLocalMs) {
          setCanSpin(false);
          setNextSpinTime(new Date(nextSpinLocalMs));
        }
      }

      setLoading(false);
    };

    loadData();
  }, []);

  // Real-time countdown effect
  useEffect(() => {
    // Clear any existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!nextSpinTime) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      // Use native UTC timestamp for consistent comparison
      const nowMs = Date.now();
      const diff = Math.max(0, nextSpinTime.getTime() - nowMs);

      if (diff <= 0) {
        setCanSpin(true);
        setNextSpinTime(null);
        setCountdown("");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    };

    // Update immediately
    updateCountdown();

    // Update every second
    countdownIntervalRef.current = window.setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [nextSpinTime]);

  // Calculate drop chance based on Chaos stat (very gradual bonus)
  const getDropChance = (rarity: string): number => {
    const baseChance = rarityWeights[rarity as keyof typeof rarityWeights];
    const chaosBonus = (userStats?.chaos_stat || 0) * 0.001; // 0.1% per Chaos point (very gradual)
    const adjustedChance = Math.min(baseChance + chaosBonus, baseChance * 2);
    return adjustedChance;
  };

  // Select item based on Chaos-adjusted weights
  const selectItem = (): Item | null => {
    if (items.length === 0) return null;

    const legendary = items.filter((i) => i.rarity === "Legendary");
    const rare = items.filter((i) => i.rarity === "Rare");
    const common = items.filter((i) => i.rarity === "Common");

    const roll = Math.random();
    let selectedRarity: string;

    const legendaryChance = getDropChance("Legendary");
    const rareChance = getDropChance("Rare");
    const commonChance = 1 - legendaryChance - rareChance;

    if (roll < legendaryChance) {
      selectedRarity = "Legendary";
    } else if (roll < legendaryChance + rareChance) {
      selectedRarity = "Rare";
    } else {
      selectedRarity = "Common";
    }

    const pool =
      selectedRarity === "Legendary"
        ? legendary
        : selectedRarity === "Rare"
          ? rare
          : common;

    // Fallback to any item if pool is empty
    if (pool.length === 0) {
      return items[Math.floor(Math.random() * items.length)];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Slot machine animation effect (vertical scrolling)
  const runTrainAnimation = (targetItem: Item, onComplete: () => void) => {
    setSpinning(true);
    setResult(null);

    // Create a vertical slot machine reel
    const reelLength = 60; // Total items in the reel
    const shuffledItems = [...items].sort(() => Math.random() - 0.5);

    // Build the reel with random items
    let reel: Item[] = [];
    for (let i = 0; i < reelLength; i++) {
      reel.push(shuffledItems[i % shuffledItems.length]);
    }

    // Place the target item near the end
    const targetIndex = reelLength - 6 - Math.floor(Math.random() * 3);
    reel[targetIndex] = targetItem;

    setDisplayItems(reel);
    setCurrentIndex(0);

    // Animate through the reel with slot machine physics
    let step = 0;
    const animateStep = () => {
      step++;
      setCurrentIndex(step);

      if (step < reelLength) {
        // Slot machine speed curve: fast spin, then dramatic slowdown
        let delay;
        if (step < 10) {
          // Quick acceleration
          delay = 150 - step * 10;
        } else if (step > reelLength - 15) {
          // Dramatic deceleration at the end
          const remaining = reelLength - step;
          delay = 50 + (15 - remaining) * 60;
        } else {
          // Fast spinning in the middle
          delay = 40;
        }
        animationRef.current = setTimeout(animateStep, delay);
      } else {
        // Animation complete - show result
        setResult(targetItem);
        setSpinning(false);
        onComplete();
      }
    };

    animationRef.current = setTimeout(animateStep, 150);
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  const handleSpin = async () => {
    if (!canSpin || spinning) return;

    const selectedItemObj = selectItem();

    if (!selectedItemObj) {
      console.error("Failed to select an item");
      return;
    }

    runTrainAnimation(selectedItemObj, async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if user has this item
        const { data: existing } = await supabase
          .from("inventory")
          .select("*")
          .eq("user_id", user.id)
          .eq("item_id", selectedItemObj.id)
          .maybeSingle();

        let chaosIncrement = 0.5; // Gradual increase: 0.5 per spin

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

        // Update gacha log
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

        // Update user's Chaos stat in profiles table
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, chaos_stat")
          .eq("id", user.id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({
              chaos_stat: (profile.chaos_stat || 0) + chaosIncrement,
            })
            .eq("id", profile.id);

          setUserStats((prev) =>
            prev
              ? {
                  ...prev,
                  chaos_stat: (prev.chaos_stat || 0) + chaosIncrement,
                }
              : null,
          );
        } else {
          await supabase.from("profiles").insert([
            {
              id: user.id,
              username:
                user.user_metadata?.full_name || user.email || "Unknown",
              chaos_stat: chaosIncrement,
              simp_stat: 0,
              power_stat: 0,
            },
          ]);

          setUserStats((prev) =>
            prev
              ? { ...prev, chaos_stat: chaosIncrement }
              : {
                  chaos_stat: chaosIncrement,
                  simp_stat: 0,
                  power_stat: 0,
                  item_power: 0,
                  total_power: chaosIncrement,
                },
          );
        }

        setCanSpin(false);
        // Set next spin time using native UTC timestamp
        const nowMs = Date.now();
        const nextSpinMs = nowMs + 24 * 60 * 60 * 1000;
        setNextSpinTime(new Date(nextSpinMs));
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

  const chaosBonusPercent = ((userStats?.chaos_stat || 0) * 0.1).toFixed(1);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
      <h1
        style={{
          fontFamily: "'Press Start 2P', cursive",
          color: "#ff00ff",
          textShadow: "0 0 10px #ff00ff, 0 0 20px #00ffff",
          fontSize: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        DAILY GACHAPON
      </h1>

      {/* User Stats */}
      <div className="mb-4 flex gap-4 text-xs">
        <div
          className="px-3 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 0, 255, 0.2)",
            color: "#ff00ff",
          }}
        >
          CHAOS: {(userStats?.chaos_stat || 0).toFixed(1)} (+{chaosBonusPercent}
          % DROP)
        </div>
        <div
          className="px-3 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 0, 255, 0.2)",
            color: "#ff00ff",
          }}
        >
          SIMP: {userStats?.simp_stat || 0}
        </div>
      </div>

      {/* Slot Machine Container */}
      <div className="w-full max-w-md mb-6 flex justify-center">
        {/* Single vertical slot reel */}
        <div
          className="relative bg-black/80 rounded-xl border-4"
          style={{
            borderColor: result
              ? rarityColors[result.rarity as keyof typeof rarityColors]
              : "#00ffff",
            width: "300px",
            height: "450px",
            boxShadow: result
              ? `0 0 40px ${rarityColors[result.rarity as keyof typeof rarityColors]}, inset 0 0 30px ${rarityColors[result.rarity as keyof typeof rarityColors]}20`
              : "0 0 20px #00ffff50",
          }}
        >
          {/* Selection window indicator */}
          <div
            className="absolute left-4 right-4 border-4 border-yellow-400 rounded-lg pointer-events-none z-20"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: "150px",
              boxShadow: "0 0 20px #ffff00, inset 0 0 20px #ffff0030",
            }}
          />

          {/* Scrolling items container */}
          <div
            ref={trainRef}
            className="relative overflow-hidden h-full"
            style={{ padding: "130px 0" }}
          >
            {!spinning ? (
              // Static placeholder when not spinning
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] h-36 flex flex-col items-center justify-center "
                style={{
                  borderColor: displayItems[0]
                    ? rarityColors[
                        displayItems[0].rarity as keyof typeof rarityColors
                      ]
                    : "#00ffff",
                  backgroundColor: "rgba(0, 0, 0, 0.95)",
                  boxShadow: displayItems[0]
                    ? `0 0 30px ${rarityColors[displayItems[0].rarity as keyof typeof rarityColors]}`
                    : "0 0 30px #00ffff",
                }}
              >
                {displayItems[0]?.image_url ? (
                  <img
                    src={displayItems[0].image_url}
                    alt={displayItems[0].name}
                    className="w-20 h-20 object-contain mb-2"
                  />
                ) : (
                  <div
                    className="text-4xl mb-2"
                    style={{
                      color: displayItems[0]
                        ? rarityColors[
                            displayItems[0].rarity as keyof typeof rarityColors
                          ]
                        : "#00ffff",
                    }}
                  >
                    ?
                  </div>
                )}
                <div
                  className="text-sm text-center px-2"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: displayItems[0]
                      ? rarityColors[
                          displayItems[0].rarity as keyof typeof rarityColors
                        ]
                      : "#00ffff",
                  }}
                >
                  {displayItems[0]?.name || "SPIN TO WIN"}
                </div>
              </div>
            ) : (
              // Animated scrolling items during spin
              <motion.div
                className="absolute left-4 right-4"
                animate={{
                  y: -currentIndex * 152,
                }}
                transition={{
                  duration: 0.05,
                  ease: "linear",
                }}
                style={{ top: 0 }}
              >
                {displayItems.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="w-full h-36 flex flex-col items-center justify-center mb-4"
                    style={{
                      borderColor:
                        rarityColors[item.rarity as keyof typeof rarityColors],
                      backgroundColor: "rgba(0, 0, 0, 0.95)",
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-20 h-20 object-contain mb-2"
                      />
                    ) : (
                      <div
                        className="text-4xl mb-2"
                        style={{
                          color:
                            rarityColors[
                              item.rarity as keyof typeof rarityColors
                            ],
                        }}
                      >
                        □
                      </div>
                    )}
                    <div
                      className="text-sm text-center px-2 truncate w-full"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color:
                          rarityColors[
                            item.rarity as keyof typeof rarityColors
                          ],
                      }}
                    >
                      {item.name}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Result Text */}
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
                color: rarityColors[result.rarity as keyof typeof rarityColors],
                textShadow: `0 0 20px ${rarityColors[result.rarity as keyof typeof rarityColors]}`,
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
              +{result.rarity === "Legendary" ? 2 : 1} CHAOS
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin Button */}
      <button
        onClick={handleSpin}
        disabled={!canSpin || spinning}
        className="px-6 py-3 text-lg font-bold disabled:opacity-50"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          backgroundColor: canSpin && !spinning ? "#00ffff" : "#444444",
          color: canSpin && !spinning ? "#050505" : "#999999",
        }}
      >
        {spinning ? "SPINNING..." : canSpin ? "SPIN NOW" : "LOCKED"}
      </button>

      {/* Real-time Countdown */}
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

      {/* Back Button */}
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

      {/* Info */}
      <p
        className="mt-4 text-[10px] text-gray-500 text-center max-w-md"
        style={{ fontFamily: "'Press Start 2P', cursive" }}
      >
        CHAOS increases drop rates (1% per point, max 50%) | SIMP increases
        upgrade success rates | Get +2 CHAOS on duplicate items, +1 on new items
      </p>
    </div>
  );
}
