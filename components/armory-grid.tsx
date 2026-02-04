"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface Item {
  id: string;
  name: string;
  rarity: string;
  score_value: number;
  image_url: string;
}

interface InventoryItem extends Item {
  quantity: number;
  isUnlocked: boolean;
  upgrade_level?: number;
}

interface LeaderboardData {
  chaos_stat: number;
  simp_stat: number;
  power_stat: number;
  item_power: number;
  total_power: number;
}

type FilterType = "all" | "owned" | "not-owned";

// Expanded rarities - displayed from Common to Mythic (ascending power)
const rarities = [
  { name: "Common", color: "#9ca3af", bg: "rgba(156, 163, 175, 0.15)" },
  { name: "Uncommon", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
  { name: "Rare", color: "#00ffff", bg: "rgba(0, 255, 255, 0.15)" },
  { name: "Epic", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" },
  { name: "Legendary", color: "#ffff00", bg: "rgba(255, 255, 0, 0.15)" },
  { name: "Mythic", color: "#ff0080", bg: "rgba(255, 0, 128, 0.15)" },
];

const rarityOrder: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
};

export function ArmoryGrid() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<LeaderboardData | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadInventory = async () => {
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

      const { data: userStatsProfile } = await supabase
        .from("leaderboard")
        .select("chaos_stat, simp_stat, item_power, total_power")
        .eq("id", user.id)
        .single();

      if (userStatsProfile) {
        setUserStats({
          chaos_stat: userStatsProfile.chaos_stat || 0,
          simp_stat: userStatsProfile.simp_stat || 0,
          power_stat: userStatsProfile.total_power || 0,
          item_power: userStatsProfile.item_power || 0,
          total_power: userStatsProfile.total_power || 0,
        });
      }

      const { data: allItems } = await supabase.from("items").select("*");

      const { data: userInventory } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id);

      const { data: upgrades } = await supabase
        .from("item_upgrades")
        .select("*")
        .eq("user_id", user.id);

      const inventoryMap = new Map(
        userInventory?.map((inv) => [inv.item_id, inv]) || [],
      );

      const upgradeMap = new Map(
        upgrades?.map((up) => [
          `${up.item_id}_${up.user_id}`,
          up.upgrade_level,
        ]) || [],
      );

      const combinedItems = (allItems || []).map((item: Item) => {
        const inv = inventoryMap.get(item.id);
        const upgradeLevel = upgradeMap.get(`${item.id}_${user.id}`) || 0;
        return {
          ...item,
          quantity: inv?.quantity || 0,
          isUnlocked: !!inv,
          upgrade_level: upgradeLevel,
        };
      });

      combinedItems.sort((a, b) => {
        const rarityDiff =
          (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
        return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
      });

      setItems(combinedItems);
      setFilteredItems(combinedItems);
      setLoading(false);
    };

    loadInventory();
  }, []);

  useEffect(() => {
    let filtered = items;

    if (filter === "owned") {
      filtered = filtered.filter((item) => item.isUnlocked);
    } else if (filter === "not-owned") {
      filtered = filtered.filter((item) => !item.isUnlocked);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.rarity.toLowerCase().includes(query),
      );
    }

    setFilteredItems(filtered);
  }, [filter, searchQuery, items]);

  // Group items by rarity
  const itemsByRarity = rarities
    .map((rarity) => ({
      ...rarity,
      items: filteredItems.filter(
        (item) => item.rarity.toLowerCase() === rarity.name.toLowerCase(),
      ),
    }))
    .filter((rarity) => rarity.items.length > 0);

  const getUpgradeChance = (rarity: string, currentLevel: number): number => {
    const baseChance =
      rarity === "Mythic"
        ? 0.95 - currentLevel * 0.08
        : rarity === "Legendary"
          ? 0.9 - currentLevel * 0.08
          : rarity === "Epic"
            ? 0.85 - currentLevel * 0.07
            : rarity === "Rare"
              ? 0.75 - currentLevel * 0.06
              : rarity === "Uncommon"
                ? 0.65 - currentLevel * 0.05
                : 0.55 - currentLevel * 0.04;
    const simpBonus = (userStats?.simp_stat || 0) * 0.001;
    return Math.min(baseChance + simpBonus, 0.98);
  };

  const getPowerBoost = (basePower: number, upgradeLevel: number): number => {
    return Math.floor(basePower * (1 + upgradeLevel * 0.2));
  };

  const handleUpgrade = async (item: InventoryItem) => {
    if (!item.isUnlocked || item.quantity < 2) {
      setUpgradeResult({
        success: false,
        message: "Need at least 2 copies to upgrade!",
      });
      return;
    }

    const chance = getUpgradeChance(item.rarity, item.upgrade_level || 0);
    const roll = Math.random();

    setUpgrading(true);
    setUpgradeResult(null);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUpgrading(false);
      return;
    }

    if (roll < chance) {
      const newLevel = (item.upgrade_level || 0) + 1;
      const oldPower = getPowerBoost(item.score_value, item.upgrade_level || 0);
      const newPower = getPowerBoost(item.score_value, newLevel);
      const powerIncrease = newPower - oldPower;

      const { data: inv } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .eq("item_id", item.id)
        .single();

      if (inv) {
        await supabase
          .from("inventory")
          .update({ quantity: inv.quantity - 1 })
          .eq("id", inv.id);
      }

      const { data: existingUpgrade } = await supabase
        .from("item_upgrades")
        .select("*")
        .eq("user_id", user.id)
        .eq("item_id", item.id)
        .single();

      if (existingUpgrade) {
        await supabase
          .from("item_upgrades")
          .update({ upgrade_level: newLevel })
          .eq("id", existingUpgrade.id);
      } else {
        await supabase
          .from("item_upgrades")
          .insert([
            { user_id: user.id, item_id: item.id, upgrade_level: newLevel },
          ]);
      }

      const { data: profile2 } = await supabase
        .from("profiles")
        .select("id, simp_stat")
        .eq("id", user.id)
        .single();

      if (profile2) {
        await supabase
          .from("profiles")
          .update({ simp_stat: (profile2.simp_stat || 0) + 0.5 })
          .eq("id", profile2.id);
      }

      setUpgradeResult({
        success: true,
        message: `UPGRADE SUCCESS! +${powerIncrease} ITEM POWER`,
      });

      setUserStats((prev) =>
        prev ? { ...prev, simp_stat: (prev.simp_stat || 0) + 0.5 } : null,
      );

      refreshInventory(user.id);
    } else {
      const { data: inv } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .eq("item_id", item.id)
        .single();

      if (inv && inv.quantity > 1) {
        await supabase
          .from("inventory")
          .update({ quantity: inv.quantity - 1 })
          .eq("id", inv.id);
      } else {
        await supabase.from("inventory").delete().eq("id", inv.id);
      }

      const { data: profile3 } = await supabase
        .from("profiles")
        .select("id, simp_stat, chaos_stat")
        .eq("id", user.id)
        .single();

      if (profile3) {
        await supabase
          .from("profiles")
          .update({
            simp_stat: (profile3.simp_stat || 0) + 0.2,
            chaos_stat: (profile3.chaos_stat || 0) + 0.3,
          })
          .eq("id", profile3.id);
      }

      setUpgradeResult({
        success: false,
        message: "UPGRADE FAILED! (+0.2 SIMP, +0.3 CHAOS)",
      });

      setUserStats((prev) =>
        prev
          ? {
              ...prev,
              simp_stat: (prev.simp_stat || 0) + 0.2,
              chaos_stat: (prev.chaos_stat || 0) + 0.3,
            }
          : null,
      );

      refreshInventory(user.id);
    }

    setUpgrading(false);
    setSelectedItem(null);
  };

  const refreshInventory = async (userId: string) => {
    const { data: userInventory } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", userId);

    const { data: upgrades } = await supabase
      .from("item_upgrades")
      .select("*")
      .eq("user_id", userId);

    const inventoryMap = new Map(
      userInventory?.map((inv) => [inv.item_id, inv]) || [],
    );

    const upgradeMap = new Map(
      upgrades?.map((up) => [
        `${up.item_id}_${up.user_id}`,
        up.upgrade_level,
      ]) || [],
    );

    const updatedItems = items.map((item) => {
      const inv = inventoryMap.get(item.id);
      return {
        ...item,
        quantity: inv?.quantity || 0,
        isUnlocked: !!inv,
        upgrade_level: upgradeMap.get(`${item.id}_${userId}`) || 0,
      };
    });

    updatedItems.sort((a, b) => {
      const rarityDiff =
        (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
      return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
    });

    setItems(updatedItems);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          LOADING ARMORY...
        </div>
      </div>
    );
  }

  const simpBonusPercent = ((userStats?.simp_stat || 0) * 0.1).toFixed(1);
  const ownedCount = items.filter((i) => i.isUnlocked).length;
  const totalCount = items.length;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex justify-between items-center flex-wrap gap-4">
        <h1
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
            fontSize: "1.2rem",
          }}
        >
          ARMORY
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

      {/* Stats Bar */}
      <div className="mb-3 flex gap-2 flex-wrap text-[10px]">
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 0, 255, 0.2)",
            color: "#ff00ff",
          }}
        >
          SIMP: {(userStats?.simp_stat || 0).toFixed(1)} (+{simpBonusPercent}%
          SUCCESS)
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 0, 255, 0.2)",
            color: "#ff00ff",
          }}
        >
          CHAOS: {(userStats?.chaos_stat || 0).toFixed(1)}
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 255, 0, 0.2)",
            color: "#ffff00",
          }}
        >
          POWER: {userStats?.total_power || 0}
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(0, 255, 255, 0.2)",
            color: "#00ffff",
          }}
        >
          ITEMS: {ownedCount}/{totalCount}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex border-2" style={{ borderColor: "#333" }}>
          {(["all", "owned", "not-owned"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 text-[10px] transition-colors"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                backgroundColor:
                  filter === f ? "rgba(255, 0, 255, 0.3)" : "transparent",
                color: filter === f ? "#ff00ff" : "#666",
                borderColor: "#333",
                borderWidth: "1px",
              }}
            >
              {f === "all" ? "ALL" : f === "owned" ? "OWNED" : "NOT"}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="SEARCH..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-2 py-1 text-[10px] bg-black border-2"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            borderColor: "#333",
            color: "#00ffff",
          }}
        />
      </div>

      {/* Upgrade Info */}
      <div
        className="mb-3 p-2 rounded border-2"
        style={{
          borderColor: "#00ffff",
          backgroundColor: "rgba(0, 255, 255, 0.1)",
        }}
      >
        <p
          className="text-[9px]"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ffff",
          }}
        >
          Click owned items to upgrade. Need 2+ copies. +20% power per level.
        </p>
      </div>

      {/* Upgrade Result */}
      {upgradeResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-3 px-3 py-1.5 rounded text-xs ${
            upgradeResult.success ? "bg-green-900/50" : "bg-red-900/50"
          }`}
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: upgradeResult.success ? "#00ff00" : "#ff0000",
          }}
        >
          {upgradeResult.message}
        </motion.div>
      )}

      {/* Selected Item Panel */}
      {selectedItem && selectedItem.isUnlocked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-3 p-3 rounded border-2"
          style={{
            borderColor: "#ffff00",
            backgroundColor: "rgba(255, 255, 0, 0.1)",
          }}
        >
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ffff00",
                  fontSize: "0.6rem",
                }}
              >
                UPGRADE {selectedItem.name.toUpperCase()}?
              </h3>
              <p
                className="text-[10px] mt-1"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#00ffff",
                }}
              >
                Lv.{selectedItem.upgrade_level || 0} → Lv.
                {(selectedItem.upgrade_level || 0) + 1}
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: "#ff00ff",
                }}
              >
                {Math.round(
                  getUpgradeChance(
                    selectedItem.rarity,
                    selectedItem.upgrade_level || 0,
                  ) * 100,
                )}
                % SUCCESS | x{selectedItem.quantity} OWNED
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-2 py-1.5 text-[10px]"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  backgroundColor: "#444",
                  color: "#fff",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => handleUpgrade(selectedItem)}
                disabled={upgrading || selectedItem.quantity < 2}
                className="px-2 py-1.5 text-[10px] disabled:opacity-50"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  backgroundColor: upgrading ? "#666" : "#ffff00",
                  color: "#000",
                }}
              >
                {upgrading ? "..." : "UPGRADE"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Items Grouped by Rarity */}
      {itemsByRarity.map((rarity) => (
        <div key={rarity.name} className="mb-4">
          {/* Rarity Header */}
          <div
            className="mb-2 px-3 py-1 rounded border"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              borderColor: rarity.color,
              backgroundColor: rarity.bg,
              color: rarity.color,
              fontSize: "0.55rem",
            }}
          >
            {rarity.name} ({rarity.items.length})
          </div>

          {/* Items Grid for this Rarity */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {rarity.items.map((item) => (
              <div
                key={item.id}
                className={`relative overflow-hidden border-2 cursor-pointer transition-all ${
                  selectedItem?.id === item.id ? "ring-2 ring-yellow-400" : ""
                }`}
                style={{
                  padding: "8px",
                  borderColor:
                    selectedItem?.id === item.id
                      ? "#ffff00"
                      : item.isUnlocked
                        ? rarity.color
                        : "#333333",
                  backgroundColor: item.isUnlocked
                    ? rarity.bg
                    : "rgba(20, 20, 20, 0.8)",
                  boxShadow: item.isUnlocked
                    ? `0 0 8px ${rarity.color}`
                    : "none",
                  opacity: upgrading ? 0.5 : 1,
                }}
                onClick={() => setSelectedItem(item.isUnlocked ? item : null)}
              >
                {/* Item Icon */}
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-2">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        filter: item.isUnlocked
                          ? "none"
                          : "grayscale(100%) brightness(0.4)",
                      }}
                    />
                  ) : (
                    <div
                      className="text-3xl"
                      style={{
                        color: item.isUnlocked ? rarity.color : "#444444",
                      }}
                    >
                      □
                    </div>
                  )}
                </div>

                {/* Item Name */}
                <div
                  className="text-center text-[8px] truncate px-1"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: item.isUnlocked ? rarity.color : "#555555",
                  }}
                >
                  {item.name}
                </div>

                {/* Quantity / Status Row */}
                <div className="flex justify-between items-center mt-2 px-1">
                  <span
                    className="text-[9px]"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: item.isUnlocked ? "#cccccc" : "#444444",
                    }}
                  >
                    {item.isUnlocked ? `x${item.quantity}` : "x0"}
                  </span>
                  {(item.upgrade_level || 0) > 0 && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        backgroundColor: "#ffff00",
                        color: "#000",
                      }}
                    >
                      +{item.upgrade_level}
                    </span>
                  )}
                </div>

                {/* Upgradeable Indicator */}
                {item.isUnlocked && item.quantity >= 2 && (
                  <div
                    className="absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: "#ffff00" }}
                  />
                )}

                {/* Power Badge */}
                <div
                  className="text-[7px] text-center mt-1"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: item.isUnlocked ? rarity.color : "#444444",
                  }}
                >
                  {item.score_value} POWER
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {itemsByRarity.length === 0 && (
        <div className="text-center py-8">
          <p
            style={{
              fontFamily: "'Press Start 2P', cursive",
              color: "#666",
              fontSize: "0.6rem",
            }}
          >
            NO ITEMS FOUND
          </p>
        </div>
      )}

      {/* Info */}
      <p
        className="mt-3 text-[8px] text-gray-500 text-center"
        style={{ fontFamily: "'Press Start 2P', cursive" }}
      >
        {filter === "not-owned"
          ? "Not in inventory yet"
          : "Click owned items to upgrade (needs 2+ copies)"}
      </p>
    </div>
  );
}
