"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// Berry icon component
const BerryIcon = ({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <img
    src="/berry.png"
    alt="Berry"
    width={size}
    height={size}
    className={`inline-block ${className}`}
    style={{
      verticalAlign: "middle",
      marginTop: "-2px",
      filter: "drop-shadow(0 0 2px rgba(255, 200, 0, 0.8))",
    }}
  />
);

interface EconomyState {
  token_balance: number;
  current_items_owned: number;
  total_power: number;
  monthly_power_gain: number;
  bot_accumulated_progress: number;
  bot_running_until: number | null;
  last_free_run_at: number | null;
  bot_items_per_hour_level: number;
  bot_runtime_level: number;
  satellite_level: number;
}

interface BotStatus {
  effective_rate: number;
  accumulated_progress: number;
  is_running: boolean;
  progress_percent: number;
  remaining_minutes: number;
  free_run_available: boolean;
  cooldown_remaining: number;
}

interface UpgradeStatus {
  bot_level: number;
  bot_max_level: number;
  bot_upgrade_cost: number;
  bot_items_per_hour: number;
  bot_cost_per_hour: number;
  bot_progress_percent: number;

  runtime_level: number;
  runtime_max_level: number;
  runtime_upgrade_cost: number;
  max_runtime_minutes: number;
  runtime_progress_percent: number;

  satellite_level: number;
  satellite_max_level: number;
  satellite_upgrade_cost: number;
  satellite_bonus_bp: number;
  satellite_progress_percent: number;

  cost_per_hour_level: number;
  cost_per_hour_max_level: number;
  cost_per_hour_upgrade_cost: number;
  cost_per_hour_current: number;
  cost_per_hour_progress_percent: number;

  token_balance: number;
}

interface CollectedItem {
  id: string;
  name: string;
  rarity: string;
  score_value: number;
}

interface CollectResult {
  items: number;
  total_power_gained: number;
  items_received: CollectedItem[];
}

export function HuntBotPanel() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [economyState, setEconomyState] = useState<EconomyState | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<CollectResult | null>(
    null,
  );
  const [hunting, setHunting] = useState(false);
  const [huntMode, setHuntMode] = useState<"free" | "paid">("free");
  const [paidTokens, setPaidTokens] = useState(30);
  const [activeTab, setActiveTab] = useState<"hunt" | "upgrades">("hunt");
  const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus | null>(
    null,
  );
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const response = await fetch("/api/economy/status");

      const result = await response.json();

      if (result.success) {
        setEconomyState(result.data.user_state);
        setBotStatus(result.data.bot);
        setUpgradeStatus(result.data.upgrades);
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleStartFreeHunt = async () => {
    setHunting(true);
    try {
      const response = await fetch("/api/economy/hunt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_type: "free" }),
      });
      const result = await response.json();
      if (result.success) {
        await loadStatus();
      } else {
        alert(result.error || "Failed to start hunt");
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setHunting(false);
    }
  };

  const handleStartPaidHunt = async () => {
    setHunting(true);
    try {
      const response = await fetch("/api/economy/hunt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_type: "paid",
          runtime_minutes: paidRuntimeMinutes,
        }),
      });
      const result = await response.json();
      if (result.success) {
        await loadStatus();
      } else {
        alert(result.error || "Failed to start paid hunt");
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setHunting(false);
    }
  };

  const handleUpgrade = async (
    upgradeType: "bot" | "runtime" | "satellite" | "cost",
  ) => {
    setUpgrading(upgradeType);
    try {
      const response = await fetch("/api/economy/upgrades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgrade_type: upgradeType }),
      });
      const result = await response.json();
      if (result.success) {
        // Wait a bit before reloading status to ensure database update is complete
        await new Promise((resolve) => setTimeout(resolve, 500));
        await loadStatus();
      } else {
        alert(result.error || "Upgrade failed");
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setUpgrading(null);
    }
  };

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const response = await fetch("/api/economy/hunt/collect", {
        method: "POST",
      });
      const result = await response.json();
      if (result.success) {
        setCollectResult({
          items: result.items_granted || 0,
          total_power_gained: result.total_power_gained || 0,
          items_received: result.items_received || [],
        });
        loadStatus();
      } else {
        alert(result.error || "Failed to collect items");
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setCollecting(false);
    }
  };

  const getRarityColor = (rarity: string): string => {
    const colors: Record<string, string> = {
      Common: "#9ca3af",
      Uncommon: "#22c55e",
      Rare: "#00ffff",
      Epic: "#a855f7",
      Legendary: "#ffff00",
      Mythic: "#ff0080",
    };
    return colors[rarity] || "#9ca3af";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-cyan-400 font-mono animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (!economyState || !botStatus) {
    return (
      <div className="flex items-center justify-center min-h-[200px] flex-col gap-2">
        <div className="text-red-400 font-mono">
          Failed to load economy data
        </div>
        <button
          onClick={loadStatus}
          className="px-3 py-1 text-xs bg-gray-800 border border-gray-600 rounded hover:bg-gray-700"
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          RETRY
        </button>
      </div>
    );
  }

  const now = Date.now();
  const canCollect =
    economyState.bot_running_until && economyState.bot_running_until <= now;
  const isRunning =
    economyState.bot_running_until !== null &&
    economyState.bot_running_until > now;
  const maxRuntime = upgradeStatus?.max_runtime_minutes || 15;
  const costPerHour = upgradeStatus?.bot_cost_per_hour || 120;
  const itemsPerHour = upgradeStatus?.bot_items_per_hour || 15;

  const maxTokens = Math.floor((maxRuntime / 60) * costPerHour);

  const calculateRuntimeFromTokens = (tokens: number): number => {
    return Math.floor((tokens / costPerHour) * 60);
  };

  const paidRuntimeMinutes = calculateRuntimeFromTokens(paidTokens);

  const effectivePaidTokens = Math.min(
    paidTokens,
    maxTokens > 0 ? maxTokens : paidTokens,
  );
  const effectivePaidRuntimeMinutes =
    calculateRuntimeFromTokens(effectivePaidTokens);

  return (
    <div className="p-4">
      <div className="flex mb-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab("hunt")}
          className={`flex-1 py-2 text-xs ${activeTab === "hunt" ? "border-b-2 border-cyan-400 text-cyan-400" : "text-gray-500"}`}
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          HUNT
        </button>
        <button
          onClick={() => setActiveTab("upgrades")}
          className={`flex-1 py-2 text-xs ${activeTab === "upgrades" ? "border-b-2 border-yellow-400 text-yellow-400" : "text-gray-500"}`}
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          UPGRADES
        </button>
      </div>

      {activeTab === "hunt" ? (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div
              className="p-2 rounded border"
              style={{
                borderColor: "#ffc800",
                backgroundColor: "rgba(255, 200, 0, 0.1)",
              }}
            >
              <div
                className="text-[10px] text-gray-400"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                BERRIES
              </div>
              <div
                className="text-sm"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ffc800",
                }}
              >
                <BerryIcon size={16} /> {economyState.token_balance}
              </div>
            </div>
            <div
              className="p-2 rounded border"
              style={{
                borderColor: "#00ffff",
                backgroundColor: "rgba(0, 255, 255, 0.1)",
              }}
            >
              <div
                className="text-[10px] text-gray-400"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                ITEMS
              </div>
              <div
                className="text-sm"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#00ffff",
                }}
              >
                📦 {economyState.current_items_owned}
              </div>
            </div>
            <div
              className="p-2 rounded border"
              style={{
                borderColor: "#ff00ff",
                backgroundColor: "rgba(255, 0, 255, 0.1)",
              }}
            >
              <div
                className="text-[10px] text-gray-400"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                TOTAL POWER
              </div>
              <div
                className="text-sm"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ff00ff",
                }}
              >
                ⚡ {economyState.total_power}
              </div>
            </div>
            <div
              className="p-2 rounded border"
              style={{
                borderColor: "#ffff00",
                backgroundColor: "rgba(255, 255, 0, 0.1)",
              }}
            >
              <div
                className="text-[10px] text-gray-400"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                MONTHLY POWER
              </div>
              <div
                className="text-sm"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ffff00",
                }}
              >
                📅 {economyState.monthly_power_gain}
              </div>
            </div>
          </div>

          <div
            className="mb-4 p-4 rounded border-2"
            style={{
              borderColor: isRunning ? "#00ff00" : "#333",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
            }}
          >
            <h3
              className="text-sm mb-3"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: isRunning ? "#00ff00" : "#666",
              }}
            >
              {isRunning ? "🔴 HUNT IN PROGRESS" : "⚪ HUNT BOT IDLE"}
            </h3>
            {isRunning && economyState.bot_running_until ? (
              <div>
                <div className="mb-2">
                  <div
                    className="flex justify-between text-xs mb-1"
                    style={{ fontFamily: "'Press Start 2P', cursive" }}
                  >
                    <span style={{ color: "#00ff00" }}>Progress</span>
                    <span style={{ color: "#00ff00" }}>
                      {Math.floor(
                        ((now -
                          (economyState.bot_running_until -
                            paidRuntimeMinutes * 60 * 1000)) /
                          (paidRuntimeMinutes * 60 * 1000)) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.floor(((now - (economyState.bot_running_until - paidRuntimeMinutes * 60 * 1000)) / (paidRuntimeMinutes * 60 * 1000)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
                <p
                  className="text-xs text-gray-400"
                  style={{ fontFamily: "'Press Start 2P', cursive" }}
                >
                  {Math.max(
                    0,
                    Math.ceil(
                      (economyState.bot_running_until - now) / (60 * 1000),
                    ),
                  )}{" "}
                  min remaining
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p
                  className="text-xs text-gray-500 mb-2"
                  style={{ fontFamily: "'Press Start 2P', cursive" }}
                >
                  Bot is ready to hunt
                </p>
                <p
                  className="text-[10px] text-gray-600 bg-accent p-2 rounded-sm"
                  style={{ fontFamily: "'Press Start 2P', cursive" }}
                >
                  Free: 15m, 5h cooldown | Paid: <BerryIcon size={12} />
                  {" " + upgradeStatus?.cost_per_hour_current}/hr, max{" "}
                  {maxRuntime}m
                </p>
              </div>
            )}
          </div>

          {!isRunning && !canCollect && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setHuntMode("free")}
                className={`flex-1 py-2 text-xs rounded ${huntMode === "free" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400"}`}
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                FREE
              </button>
              <button
                onClick={() => setHuntMode("paid")}
                className={`flex-1 py-2 text-xs rounded ${huntMode === "paid" ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400"}`}
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                PAID
              </button>
            </div>
          )}

          {huntMode === "paid" && !isRunning && !canCollect && (
            <div className="mb-3 p-3 rounded bg-gray-900/50">
              <div
                className="flex justify-between text-xs mb-2"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                <span className="text-gray-400">Berries to Spend</span>
                <span className="text-black bg-orange-400 py-1 px-2 rounded">
                  <BerryIcon size={12} />
                  {" " + paidTokens}
                </span>
              </div>
              <input
                type="range"
                min="30"
                max={Math.min(economyState.token_balance, maxTokens)}
                step="1"
                value={paidTokens}
                onChange={(e) => setPaidTokens(parseInt(e.target.value))}
                className="w-full accent-yellow-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>
                  30 <BerryIcon size={10} /> (min)
                </span>
                <span>
                  Max: {Math.min(economyState.token_balance, maxTokens)}{" "}
                  <BerryIcon size={10} />
                </span>
              </div>
              <div
                className="text-center mt-2 text-xs"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                <span className="text-yellow-400">
                  Runtime: {paidRuntimeMinutes} min
                </span>
                <span className="text-gray-500 ml-2">
                  (Cost: <BerryIcon size={12} />
                  {costPerHour}/hr, max {maxRuntime}m)
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {canCollect ? (
              <button
                onClick={handleCollect}
                disabled={collecting}
                className="w-full py-3 text-sm"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  backgroundColor: collecting ? "#444" : "#00ff00",
                  color: "#000",
                }}
              >
                {collecting ? "COLLECTING..." : "COLLECT ITEMS"}
              </button>
            ) : isRunning ? (
              <button
                disabled
                className="w-full py-3 text-sm opacity-50"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  backgroundColor: "#333",
                  color: "#666",
                }}
              >
                HUNT IN PROGRESS...
              </button>
            ) : huntMode === "free" ? (
              botStatus.free_run_available ? (
                <button
                  onClick={handleStartFreeHunt}
                  disabled={hunting}
                  className="w-full py-3 text-sm"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor: hunting ? "#444" : "#00ffff",
                    color: "#000",
                  }}
                >
                  {hunting ? "STARTING..." : "START FREE HUNT (15m)"}
                </button>
              ) : (
                <div
                  className="text-center py-3 rounded border"
                  style={{
                    borderColor: "#333",
                    backgroundColor: "rgba(255, 0, 0, 0.1)",
                  }}
                >
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: "#ff0000",
                    }}
                  >
                    COOLDOWN:{" "}
                    {Math.ceil((botStatus.cooldown_remaining || 0) / 60)} MIN
                  </p>
                </div>
              )
            ) : (
              <button
                onClick={handleStartPaidHunt}
                disabled={
                  hunting ||
                  economyState.token_balance < 30 ||
                  effectivePaidRuntimeMinutes <= 0
                }
                className="w-full py-3 text-sm"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  backgroundColor:
                    hunting ||
                    economyState.token_balance < 30 ||
                    effectivePaidRuntimeMinutes <= 0
                      ? "#444"
                      : "#ffc800",
                  color: "#000",
                }}
              >
                {hunting
                  ? "STARTING..."
                  : `START PAID HUNT (${effectivePaidRuntimeMinutes}m)`}
              </button>
            )}
          </div>

          <AnimatePresence>
            {collectResult && collectResult.items > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-4 p-3 rounded"
                style={{
                  backgroundColor: "rgba(0, 255, 0, 0.1)",
                  border: "2px solid #00ff00",
                }}
              >
                <p
                  className="text-sm text-center mb-3"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: "#00ff00",
                  }}
                >
                  +{collectResult.items} ITEMS COLLECTED!
                </p>
                <p
                  className="text-xs text-center mb-3"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: "#ffff00",
                  }}
                >
                  +{collectResult.total_power_gained} POWER
                </p>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {collectResult.items_received.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex justify-between items-center p-2 rounded bg-black/30"
                    >
                      <span
                        className="text-xs"
                        style={{
                          fontFamily: "'Press Start 2P', cursive",
                          color: getRarityColor(item.rarity),
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        className="text-[10px] text-gray-400"
                        style={{ fontFamily: "'Press Start 2P', cursive" }}
                      >
                        {item.rarity} | +{item.score_value} PWR
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setCollectResult(null)}
                  className="w-full mt-3 py-2 text-xs rounded"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor: "#00ff00",
                    color: "#000",
                  }}
                >
                  AWESOME!
                </button>
              </motion.div>
            )}

            {collectResult && collectResult.items === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-4 p-3 rounded text-center"
                style={{
                  backgroundColor: "rgba(255, 165, 0, 0.1)",
                  border: "2px solid #ffa500",
                }}
              >
                <p
                  className="text-sm"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: "#ffa500",
                  }}
                >
                  NO ITEMS THIS TIME
                </p>
                <p
                  className="text-[10px] text-gray-400 mt-2"
                  style={{ fontFamily: "'Press Start 2P', cursive" }}
                >
                  Progress accumulated. Keep hunting!
                </p>
                <button
                  onClick={() => setCollectResult(null)}
                  className="w-full mt-3 py-2 text-xs rounded"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor: "#ffa500",
                    color: "#000",
                  }}
                >
                  OK
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p
            className="mt-4 text-[8px] text-gray-500 text-center"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            Free: 15m, 5h cooldown | Paid: <BerryIcon size={10} />
            {costPerHour}/hr, up to {maxRuntime}m max
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {upgradeStatus ? (
            <>
              <div
                className="p-3 rounded border"
                style={{
                  borderColor: "#00ffff",
                  backgroundColor: "rgba(0, 255, 255, 0.05)",
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4
                      className="text-xs"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#00ffff",
                      }}
                    >
                      BOT SPEED (Lv.{upgradeStatus?.bot_level || 0}/
                      {upgradeStatus?.bot_max_level || 45})
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Current: {itemsPerHour} items/hr
                    </p>
                    <p className="text-[9px] text-gray-500">
                      Cost: <BerryIcon size={10} />
                      {costPerHour}/hr | Next: {itemsPerHour + 1} items/hr
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpgrade("bot")}
                    disabled={
                      upgrading === "bot" ||
                      economyState.token_balance <
                        (upgradeStatus?.bot_upgrade_cost || 100)
                    }
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      backgroundColor:
                        economyState.token_balance <
                        (upgradeStatus?.bot_upgrade_cost || 100)
                          ? "#333"
                          : "#00ffff",
                      color:
                        economyState.token_balance <
                        (upgradeStatus?.bot_upgrade_cost || 100)
                          ? "#666"
                          : "#000",
                    }}
                  >
                    {upgrading === "bot" ? (
                      "..."
                    ) : (
                      <>
                        UPGRADE <BerryIcon size={10} />
                        {" " + upgradeStatus?.bot_upgrade_cost || 100}
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[8px] mb-1">
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#666",
                      }}
                    >
                      Progress
                    </span>
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#00ffff",
                      }}
                    >
                      {upgradeStatus?.bot_progress_percent || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500"
                      style={{
                        width: `${upgradeStatus?.bot_progress_percent || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="p-3 rounded border"
                style={{
                  borderColor: "#ff00ff",
                  backgroundColor: "rgba(255, 0, 255, 0.05)",
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4
                      className="text-xs"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#ff00ff",
                      }}
                    >
                      MAX RUNTIME (Lv.{upgradeStatus?.runtime_level || 0}/
                      {upgradeStatus?.runtime_max_level || 100})
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Current: {maxRuntime} min max
                    </p>
                    <p className="text-[9px] text-gray-500">
                      Base: 15 min | Max: 1440 min (24h)
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpgrade("runtime")}
                    disabled={
                      upgrading === "runtime" ||
                      maxRuntime >= 1440 ||
                      economyState.token_balance <
                        (upgradeStatus?.runtime_upgrade_cost || 150)
                    }
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      backgroundColor:
                        maxRuntime >= 1440 ||
                        economyState.token_balance <
                          (upgradeStatus?.runtime_upgrade_cost || 150)
                          ? "#333"
                          : "#ff00ff",
                      color:
                        maxRuntime >= 1440 ||
                        economyState.token_balance <
                          (upgradeStatus?.runtime_upgrade_cost || 150)
                          ? "#666"
                          : "#000",
                    }}
                  >
                    {maxRuntime >= 1440 ? (
                      "MAXED"
                    ) : upgrading === "runtime" ? (
                      "..."
                    ) : (
                      <>
                        UPGRADE <BerryIcon size={10} />
                        {" " + upgradeStatus?.runtime_upgrade_cost || 150}
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[8px] mb-1">
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#666",
                      }}
                    >
                      Progress
                    </span>
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#ff00ff",
                      }}
                    >
                      {upgradeStatus?.runtime_progress_percent || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-pink-500 transition-all duration-500"
                      style={{
                        width: `${upgradeStatus?.runtime_progress_percent || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="p-3 rounded border"
                style={{
                  borderColor: "#ffff00",
                  backgroundColor: "rgba(255, 255, 0, 0.05)",
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4
                      className="text-xs"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#ffff00",
                      }}
                    >
                      SATELLITE (Lv.{upgradeStatus?.satellite_level || 0}/
                      {upgradeStatus?.satellite_max_level || 1000})
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Current: +
                      {((upgradeStatus?.satellite_bonus_bp || 0) / 100).toFixed(
                        2,
                      )}
                      % rare drops
                    </p>
                    <p className="text-[9px] text-gray-500">
                      Base: 0% | +0.03% per level
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpgrade("satellite")}
                    disabled={
                      upgrading === "satellite" ||
                      economyState.token_balance <
                        (upgradeStatus?.satellite_upgrade_cost || 500)
                    }
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      backgroundColor:
                        economyState.token_balance <
                        (upgradeStatus?.satellite_upgrade_cost || 500)
                          ? "#333"
                          : "#ffff00",
                      color:
                        economyState.token_balance <
                        (upgradeStatus?.satellite_upgrade_cost || 500)
                          ? "#666"
                          : "#000",
                    }}
                  >
                    {upgrading === "satellite" ? (
                      "..."
                    ) : (
                      <>
                        UPGRADE <BerryIcon size={10} />
                        {" " + upgradeStatus?.satellite_upgrade_cost || 500}
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[8px] mb-1">
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#666",
                      }}
                    >
                      Progress
                    </span>
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#ffff00",
                      }}
                    >
                      {upgradeStatus?.satellite_progress_percent || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 transition-all duration-500"
                      style={{
                        width: `${upgradeStatus?.satellite_progress_percent || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="p-3 rounded border"
                style={{
                  borderColor: "#00ff00",
                  backgroundColor: "rgba(0, 255, 0, 0.05)",
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4
                      className="text-xs"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#00ff00",
                      }}
                    >
                      COST/HOUR (Lv.{upgradeStatus?.cost_per_hour_level || 0}/
                      {upgradeStatus?.cost_per_hour_max_level || 100})
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Current: {upgradeStatus?.cost_per_hour_current || 120}
                      <BerryIcon size={10} />
                      /hr
                    </p>
                    <p className="text-[9px] text-gray-500">
                      Base: 120
                      <BerryIcon size={10} />
                      /hr | Min: 60
                      <BerryIcon size={10} />
                      /hr
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpgrade("cost")}
                    disabled={
                      upgrading === "cost" ||
                      (upgradeStatus?.cost_per_hour_current || 120) <= 60 ||
                      economyState.token_balance <
                        (upgradeStatus?.cost_per_hour_upgrade_cost || 200)
                    }
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      backgroundColor:
                        (upgradeStatus?.cost_per_hour_current || 120) <= 60 ||
                        economyState.token_balance <
                          (upgradeStatus?.cost_per_hour_upgrade_cost || 200)
                          ? "#333"
                          : "#00ff00",
                      color:
                        (upgradeStatus?.cost_per_hour_current || 120) <= 60 ||
                        economyState.token_balance <
                          (upgradeStatus?.cost_per_hour_upgrade_cost || 200)
                          ? "#666"
                          : "#000",
                    }}
                  >
                    {(upgradeStatus?.cost_per_hour_current || 120) <= 60 ? (
                      "MAXED"
                    ) : upgrading === "cost" ? (
                      "..."
                    ) : (
                      <>
                        UPGRADE <BerryIcon size={10} />
                        {" " + upgradeStatus?.cost_per_hour_upgrade_cost || 200}
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[8px] mb-1">
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#666",
                      }}
                    >
                      Progress
                    </span>
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        color: "#00ff00",
                      }}
                    >
                      {upgradeStatus?.cost_per_hour_progress_percent || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{
                        width: `${upgradeStatus?.cost_per_hour_progress_percent || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p
                className="text-gray-400 font-mono text-xs"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                LOADING UPGRADES...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
