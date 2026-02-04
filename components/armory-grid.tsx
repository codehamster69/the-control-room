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

const rarityOrder = { Legendary: 0, Rare: 1, Common: 2 };
const rarityColors = {
  Legendary: "#ffff00",
  Rare: "#00ffff",
  Common: "#ff00ff",
};

export function ArmoryGrid() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<LeaderboardData | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
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

      // Load user's stats from leaderboard view (calculates power from inventory)
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
          rarityOrder[a.rarity as keyof typeof rarityOrder] -
          rarityOrder[b.rarity as keyof typeof rarityOrder];
        return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
      });

      setItems(combinedItems);
      setLoading(false);
    };

    loadInventory();
  }, []);

  // Calculate upgrade success chance based on SIMP stat (very gradual bonus)
  const getUpgradeChance = (rarity: string, currentLevel: number): number => {
    const baseChance =
      rarity === "Legendary"
        ? 0.8 - currentLevel * 0.1
        : rarity === "Rare"
          ? 0.7 - currentLevel * 0.08
          : 0.6 - currentLevel * 0.05;
    const simpBonus = (userStats?.simp_stat || 0) * 0.001; // 0.1% per SIMP point (very gradual)
    return Math.min(baseChance + simpBonus, 0.95); // Max 95%
  };

  // Calculate power boost from upgrade
  const getPowerBoost = (basePower: number, upgradeLevel: number): number => {
    return Math.floor(basePower * (1 + upgradeLevel * 0.2)); // 20% per level
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

    // Simulate upgrade animation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUpgrading(false);
      return;
    }

    if (roll < chance) {
      // Success!
      const newLevel = (item.upgrade_level || 0) + 1;

      // Calculate power increase from the upgrade
      const oldPower = getPowerBoost(item.score_value, item.upgrade_level || 0);
      const newPower = getPowerBoost(item.score_value, newLevel);
      const powerIncrease = newPower - oldPower;

      // Consume one item
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

      // Update or create upgrade record
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

      // Increment SIMP stat on successful upgrade (very gradual)
      const { data: profile2 } = await supabase
        .from("profiles")
        .select("id, simp_stat")
        .eq("id", user.id)
        .single();

      if (profile2) {
        await supabase
          .from("profiles")
          .update({ simp_stat: (profile2.simp_stat || 0) + 0.5 }) // +0.5 SIMP for upgrade (gradual)
          .eq("id", profile2.id);
      }

      setUpgradeResult({
        success: true,
        message: `UPGRADE SUCCESS! +${powerIncrease} ITEM POWER`,
      });

      // Update local state
      setUserStats((prev) =>
        prev ? { ...prev, simp_stat: (prev.simp_stat || 0) + 0.5 } : null,
      );

      // Refresh inventory
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

      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) {
            const inv = inventoryMap.get(item.id);
            return {
              ...i,
              quantity: inv?.quantity || 0,
              upgrade_level: upgradeMap.get(`${item.id}_${user.id}`) || 0,
            };
          }
          return i;
        }),
      );
    } else {
      // Failed - consume one item anyway
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

      // Still get +0.2 SIMP for trying (very gradual)
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
            chaos_stat: (profile3.chaos_stat || 0) + 0.3, // +0.3 CHAOS for failure (gradual)
          })
          .eq("id", profile3.id);
      }

      setUpgradeResult({
        success: false,
        message: "UPGRADE FAILED! (+0.2 SIMP, +0.3 CHAOS)",
      });

      // Update local state
      setUserStats((prev) =>
        prev
          ? {
              ...prev,
              simp_stat: (prev.simp_stat || 0) + 0.2,
              chaos_stat: (prev.chaos_stat || 0) + 0.3,
            }
          : null,
      );

      // Refresh inventory
      const { data: userInventory } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id);

      const inventoryMap = new Map(
        userInventory?.map((inv) => [inv.item_id, inv]) || [],
      );

      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) {
            const inv = inventoryMap.get(item.id);
            return { ...i, quantity: inv?.quantity || 0 };
          }
          return i;
        }),
      );
    }

    setUpgrading(false);
    setSelectedItem(null);
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

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex justify-between items-center flex-wrap gap-4">
        <h1
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 10px #ff00ff, 0 0 20px #00ffff",
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

      {/* User Stats */}
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
      </div>

      {/* Upgrade Info Note */}
      <div
        className="mb-3 p-3 rounded border-2"
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
            lineHeight: "1.6",
          }}
        >
          💡 UPGRADE INFO: Each upgrade level adds +20% to item's base power.
          Need 2+ copies to upgrade. Success chance decreases with level.
          Upgrading increases SIMP stat!
        </p>
      </div>

      {/* Upgrade Result Message */}
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

      {/* Selected Item Upgrade Panel */}
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
                % SUCCESS
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

      {/* Items Grid - Larger boxes */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={`relative overflow-hidden border cursor-pointer transition-all ${
              selectedItem?.id === item.id ? "ring-1 ring-yellow-400" : ""
            }`}
            style={{
              borderWidth: "3px",
              padding: "8px",
              borderColor:
                selectedItem?.id === item.id
                  ? "#ffff00"
                  : item.isUnlocked
                    ? rarityColors[item.rarity as keyof typeof rarityColors]
                    : "#333333",
              backgroundColor: item.isUnlocked
                ? "rgba(255, 0, 255, 0.1)"
                : "rgba(0, 0, 0, 0.3)",
              boxShadow: item.isUnlocked
                ? `0 0 6px ${rarityColors[item.rarity as keyof typeof rarityColors]}`
                : "none",
              opacity: upgrading ? 0.5 : 1,
            }}
            onClick={() => setSelectedItem(item.isUnlocked ? item : null)}
          >
            {/* Item Icon */}
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-2">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    filter: item.isUnlocked
                      ? "none"
                      : "grayscale(100%) opacity(0.3)",
                  }}
                />
              ) : (
                <div
                  className="text-3xl"
                  style={{
                    color: item.isUnlocked
                      ? rarityColors[item.rarity as keyof typeof rarityColors]
                      : "#444444",
                  }}
                >
                  □
                </div>
              )}
            </div>

            {/* Item Name - Truncated */}
            <div
              className="text-center text-[9px] truncate px-1"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: item.isUnlocked
                  ? rarityColors[item.rarity as keyof typeof rarityColors]
                  : "#555555",
              }}
            >
              {item.name}
            </div>

            {/* Row: Quantity + Upgrade Level */}
            <div className="flex justify-between items-center mt-2 px-1">
              {item.isUnlocked && (
                <span className="text-[9px] text-gray-300">
                  x{item.quantity}
                </span>
              )}
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

            {/* Upgradeable indicator */}
            {item.isUnlocked && item.quantity >= 2 && (
              <div
                className="absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#ffff00" }}
              />
            )}

            {/* Rarity */}
            <div
              className="text-[8px] text-center mt-1"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: rarityColors[item.rarity as keyof typeof rarityColors],
              }}
            >
              {item.rarity}
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <p
        className="mt-3 text-[8px] text-gray-500 text-center"
        style={{ fontFamily: "'Press Start 2P', cursive" }}
      >
        Click to upgrade (needs 2+ copies)
      </p>
    </div>
  );
}
