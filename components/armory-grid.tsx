"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Berry icon component
const BerryIcon = ({ size = 16 }: { size?: number }) => (
  <img
    src="/berry.png"
    alt="Berry"
    width={size}
    height={size}
    className="inline-block"
    style={{ verticalAlign: "middle", marginTop: "-2px" }}
  />
);

interface Item {
  id: string;
  name: string;
  description?: string;
  rarity: string;
  score_value: number;
  image_url: string;
}

interface InventoryItem extends Item {
  quantity: number;
  isUnlocked: boolean;
  wasCollected?: boolean;
  collectionQuantity?: number;
}

interface UserStats {
  total_items_collected: number;
  current_items_owned: number;
  token_balance: number;
  total_power: number;
  monthly_power_gain: number;
}

type FilterType = "all" | "owned" | "not-owned" | "collection" | "sell";

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
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredItem, setHoveredItem] = useState<InventoryItem | null>(null);
  const [selectedItemForDialog, setSelectedItemForDialog] =
    useState<InventoryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [sellMode, setSellMode] = useState<"individual" | "category" | "all">(
    "individual",
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sellAmount, setSellAmount] = useState(1);
  const [selling, setSelling] = useState(false);
  const [sellResult, setSellResult] = useState<{
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
        .select(
          "is_instagram_verified, total_items_collected, token_balance, total_power, monthly_power_gain",
        )
        .eq("id", user.id)
        .single();

      if (!profile?.is_instagram_verified) {
        router.push("/");
        return;
      }

      setUserStats({
        total_items_collected: profile.total_items_collected || 0,
        current_items_owned: 0,
        token_balance: profile.token_balance || 0,
        total_power: profile.total_power || 0,
        monthly_power_gain: profile.monthly_power_gain || 0,
      });

      const { data: allItems } = await supabase.from("items").select("*");
      const { data: profileData } = await supabase
        .from("profiles")
        .select("inventory, collection_history")
        .eq("id", user.id)
        .single();

      const inventoryData = (profileData as any)?.inventory || {};
      const collectionHistoryData =
        (profileData as any)?.collection_history || {};

      const inventoryMap = new Map(
        Object.entries(inventoryData).map(([itemId, quantity]) => [
          itemId,
          { item_id: itemId, quantity: quantity as number },
        ]),
      );
      const collectionHistoryMap = new Map(
        Object.entries(collectionHistoryData).map(([itemId, quantity]) => [
          itemId,
          quantity as number,
        ]),
      );

      const combinedItems = (allItems || []).map((item: Item) => {
        const inv = inventoryMap.get(item.id);
        const collectionQty = collectionHistoryMap.get(item.id) || 0;
        return {
          ...item,
          quantity: inv?.quantity || 0,
          isUnlocked: !!inv,
          wasCollected: collectionQty > 0,
          collectionQuantity: collectionQty,
        };
      });

      combinedItems.sort((a, b) => {
        const rarityDiff =
          (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
        return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
      });

      const ownedCount = combinedItems.filter((i) => i.isUnlocked).length;
      setUserStats((prev) =>
        prev ? { ...prev, current_items_owned: ownedCount } : null,
      );

      setItems(combinedItems);
      setFilteredItems(combinedItems);
      setLoading(false);
    };

    loadInventory();
  }, []);

  useEffect(() => {
    let filtered = items;
    if (filter === "owned")
      filtered = filtered.filter((item) => item.isUnlocked);
    else if (filter === "not-owned")
      filtered = filtered.filter((item) => !item.isUnlocked);
    else if (filter === "collection")
      filtered = filtered.filter(
        (item) => item.wasCollected || item.isUnlocked,
      );
    else if (filter === "sell")
      filtered = filtered.filter((item) => item.isUnlocked);

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

  const itemsByRarity = rarities
    .map((rarity) => ({
      ...rarity,
      items: filteredItems.filter(
        (item) => item.rarity.toLowerCase() === rarity.name.toLowerCase(),
      ),
    }))
    .filter((rarity) => rarity.items.length > 0);

  // Sell value is same as item power (score_value)
  const getSellValue = (item: InventoryItem): number => {
    return item.score_value || 10;
  };

  const getTotalSellValue = (): number => {
    if (sellMode === "individual" && selectedItemId) {
      const item = items.find((i) => i.id === selectedItemId);
      if (!item) return 0;
      return getSellValue(item) * Math.min(sellAmount, item.quantity);
    }
    if (sellMode === "category" && selectedCategory) {
      const categoryItems = items.filter(
        (i) =>
          i.isUnlocked &&
          i.rarity.toLowerCase() === selectedCategory.toLowerCase(),
      );
      return categoryItems.reduce(
        (total, item) => total + getSellValue(item) * item.quantity,
        0,
      );
    }
    if (sellMode === "all") {
      return items
        .filter((i) => i.isUnlocked)
        .reduce((total, item) => total + getSellValue(item) * item.quantity, 0);
    }
    return 0;
  };

  const handleSell = async () => {
    let sell_mode: string;
    let category: string | undefined;
    let quantity: number | undefined;
    let item_id: string | undefined;

    if (sellMode === "individual" && selectedItemId) {
      sell_mode = "quantity";
      item_id = selectedItemId;
      quantity = sellAmount;
    } else if (sellMode === "category" && selectedCategory) {
      sell_mode = "category";
      category = selectedCategory;
    } else if (sellMode === "all") {
      sell_mode = "all";
    } else {
      setSellResult({ success: false, message: "Please select what to sell" });
      return;
    }

    setSelling(true);
    setSellResult(null);

    try {
      const response = await fetch("/api/economy/items/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sell_mode, category, quantity, item_id }),
      });

      const result = await response.json();

      if (result.success) {
        setSellResult({
          success: true,
          message: `Sold ${result.items_sold} items for ${result.tokens_earned} berries!`,
        });
        setSellAmount(1);
        setSelectedItemId(null);
        setSelectedCategory(null);
        refreshInventory();
      } else {
        setSellResult({
          success: false,
          message: result.error || "Sell failed",
        });
      }
    } catch (error) {
      setSellResult({ success: false, message: "Network error" });
    } finally {
      setSelling(false);
    }
  };

  const refreshInventory = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "inventory, total_items_collected, token_balance, total_power, monthly_power_gain",
      )
      .eq("id", user.id)
      .single();

    const inventoryData = profile?.inventory || {};
    const inventoryMap = new Map(
      Object.entries(inventoryData).map(([itemId, quantity]) => [
        itemId,
        { item_id: itemId, quantity: quantity as number },
      ]),
    );
    const updatedItems = items.map((item) => {
      const inv = inventoryMap.get(item.id);
      return { ...item, quantity: inv?.quantity || 0, isUnlocked: !!inv };
    });

    const ownedCount = updatedItems.filter((i) => i.isUnlocked).length;
    setUserStats((prev) =>
      prev
        ? {
            ...prev,
            current_items_owned: ownedCount,
            token_balance: profile?.token_balance || prev.token_balance,
            total_power: profile?.total_power || prev.total_power,
            monthly_power_gain:
              profile?.monthly_power_gain || prev.monthly_power_gain,
          }
        : null,
    );
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

  const ownedCount = items.filter((i) => i.isUnlocked).length;
  const totalCount = items.length;
  const collectionCount = items.filter(
    (i) => i.wasCollected || i.isUnlocked,
  ).length;
  const totalSellValue = getTotalSellValue();

  return (
    <div className="p-4 md:p-6">
      <div className="sticky top-0 z-50 bg-[#050505] mb-4 flex justify-between items-center flex-wrap gap-4">
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

      <div className="mb-3 flex gap-2 flex-wrap text-[10px]">
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 200, 0, 0.2)",
            color: "#ffc800",
          }}
        >
          <BerryIcon size={14} /> {userStats?.token_balance || 0} BERRIES
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(0, 255, 255, 0.2)",
            color: "#00ffff",
          }}
        >
          📦 {ownedCount}/{totalCount} OWNED
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 255, 0, 0.2)",
            color: "#ffff00",
          }}
        >
          🏆 {collectionCount}/{totalCount} COLLECTED
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 0, 255, 0.2)",
            color: "#ff00ff",
          }}
        >
          ⚡ {userStats?.total_power || 0} TOTAL PWR
        </div>
        <div
          className="px-2 py-1 rounded"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(0, 255, 0, 0.2)",
            color: "#00ff00",
          }}
        >
          📅 {userStats?.monthly_power_gain || 0} MONTHLY PWR
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex border-2" style={{ borderColor: "#333" }}>
          {(
            ["all", "owned", "not-owned", "collection", "sell"] as FilterType[]
          ).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                if (f === "sell") {
                  setSellMode("individual");
                  setSelectedItemId(null);
                  setSelectedCategory(null);
                }
              }}
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
              {f === "all"
                ? "ALL"
                : f === "owned"
                  ? "OWNED"
                  : f === "not-owned"
                    ? "NOT"
                    : f === "collection"
                      ? "COLLECTION"
                      : "SELL"}
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

      {filter === "sell" && (
        <div
          className="mb-4 p-4 rounded border-2"
          style={{
            borderColor: "#00ff00",
            backgroundColor: "rgba(0, 255, 0, 0.1)",
          }}
        >
          <h3
            className="text-sm mb-3"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              color: "#00ff00",
            }}
          >
            SELL ITEMS
          </h3>

          <div className="mb-3">
            <label
              className="text-xs text-gray-400 block mb-2"
              style={{ fontFamily: "'Press Start 2P', cursive" }}
            >
              SELL MODE:
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { mode: "individual", label: "🎯 INDIVIDUAL" },
                  { mode: "category", label: "📦 BY CATEGORY" },
                  { mode: "all", label: "💰 ALL ITEMS" },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSellMode(mode);
                    if (mode === "all") {
                      setSelectedItemId(null);
                      setSelectedCategory(null);
                    }
                  }}
                  className="px-3 py-1.5 text-[10px] transition-colors"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor:
                      sellMode === mode
                        ? "rgba(0, 255, 0, 0.3)"
                        : "rgba(0, 0, 0, 0.5)",
                    color: sellMode === mode ? "#00ff00" : "#666",
                    border: "1px solid",
                    borderColor: sellMode === mode ? "#00ff00" : "#333",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sellMode === "individual" && (
            <div className="mb-3">
              <label
                className="text-xs text-gray-400 block mb-2"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                SELECT ITEM:
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-700 rounded p-2">
                {items.filter((i) => i.isUnlocked).length === 0 ? (
                  <p className="text-xs text-gray-500">No items to sell</p>
                ) : (
                  items
                    .filter((i) => i.isUnlocked)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setSellAmount(1);
                        }}
                        className={`flex justify-between items-center px-2 py-1.5 cursor-pointer ${selectedItemId === item.id ? "bg-green-900/50" : "hover:bg-gray-800"}`}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <span
                          className="text-xs truncate"
                          style={{
                            fontFamily: "'Press Start 2P', cursive",
                            color:
                              selectedItemId === item.id ? "#00ff00" : "#ccc",
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          className="text-xs"
                          style={{
                            fontFamily: "'Press Start 2P', cursive",
                            color: "#ffc800",
                          }}
                        >
                          x{item.quantity} ({item.score_value}{" "}
                          <BerryIcon size={10} /> ea)
                        </span>
                      </div>
                    ))
                )}
              </div>
              {selectedItemId && (
                <div className="mt-2">
                  <label
                    className="text-xs text-gray-400 block mb-1"
                    style={{ fontFamily: "'Press Start 2P', cursive" }}
                  >
                    Amount to sell: {sellAmount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max={
                      items.find((i) => i.id === selectedItemId)?.quantity || 1
                    }
                    step="1"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(parseInt(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#00ff00" }}
                  />
                </div>
              )}
            </div>
          )}

          {sellMode === "category" && (
            <div className="mb-3">
              <label
                className="text-xs text-gray-400 block mb-2"
                style={{ fontFamily: "'Press Start 2P', cursive" }}
              >
                SELECT CATEGORY:
              </label>
              <div className="flex flex-wrap gap-2">
                {rarities.map((rarity) => {
                  const categoryItems = items.filter(
                    (i) =>
                      i.isUnlocked &&
                      i.rarity.toLowerCase() === rarity.name.toLowerCase(),
                  );
                  const totalQuantity = categoryItems.reduce(
                    (sum, i) => sum + i.quantity,
                    0,
                  );
                  return (
                    <button
                      key={rarity.name}
                      onClick={() => setSelectedCategory(rarity.name)}
                      className="px-3 py-1.5 text-[10px] transition-colors"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        backgroundColor:
                          selectedCategory === rarity.name
                            ? `${rarity.color}40`
                            : "rgba(0, 0, 0, 0.5)",
                        color:
                          selectedCategory === rarity.name
                            ? rarity.color
                            : "#666",
                        border: "1px solid",
                        borderColor:
                          selectedCategory === rarity.name
                            ? rarity.color
                            : "#333",
                      }}
                    >
                      {rarity.name} (x{totalQuantity})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="p-3 rounded mb-3"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid #00ff00",
            }}
          >
            <p
              className="text-xs"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#00ff00",
              }}
            >
              YOU&apos;LL RECEIVE:{" "}
              <span className="text-lg">
                {totalSellValue} <BerryIcon size={14} />
              </span>
            </p>
          </div>

          {sellResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-3 px-3 py-1.5 rounded text-xs ${sellResult.success ? "bg-green-900/50" : "bg-red-900/50"}`}
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: sellResult.success ? "#00ff00" : "#ff0000",
              }}
            >
              {sellResult.message}
            </motion.div>
          )}

          <button
            onClick={handleSell}
            disabled={selling || totalSellValue === 0}
            className="w-full py-3 text-sm disabled:opacity-50"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              backgroundColor:
                totalSellValue === 0 || selling ? "#444" : "#00ff00",
              color: totalSellValue === 0 ? "#888" : "#000",
            }}
          >
            {selling ? "SELLING..." : "SELL ITEMS"}
          </button>
        </div>
      )}

      {filter === "collection" && (
        <div
          className="mb-3 p-2 rounded border-2"
          style={{
            borderColor: "#ffff00",
            backgroundColor: "rgba(255, 255, 0, 0.1)",
          }}
        >
          <p
            className="text-[9px]"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              color: "#ffff00",
            }}
          >
            Showing all items ever collected (including sold items). Collection
            progress: {collectionCount}/{totalCount}
          </p>
        </div>
      )}

      {itemsByRarity.map((rarity) => (
        <div key={rarity.name} className="mb-4">
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
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {rarity.items.map((item) => (
              <div
                key={item.id}
                className={`relative overflow-hidden border-2 cursor-pointer transition-all ${selectedItemId === item.id && filter === "sell" ? "ring-2 ring-green-400" : ""}`}
                style={{
                  padding: "8px",
                  borderColor: (
                    filter === "collection"
                      ? item.wasCollected || item.isUnlocked
                      : item.isUnlocked
                  )
                    ? rarity.color
                    : "#333333",
                  backgroundColor: (
                    filter === "collection"
                      ? item.wasCollected || item.isUnlocked
                      : item.isUnlocked
                  )
                    ? rarity.bg
                    : "rgba(20, 20, 20, 0.8)",
                  boxShadow: (
                    filter === "collection"
                      ? item.wasCollected || item.isUnlocked
                      : item.isUnlocked
                  )
                    ? `0 0 8px ${rarity.color}`
                    : "none",
                }}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => {
                  if (
                    filter === "sell" &&
                    sellMode === "individual" &&
                    item.isUnlocked
                  ) {
                    setSelectedItemId(item.id);
                    setSellAmount(1);
                  } else {
                    setSelectedItemForDialog(item);
                    setIsDialogOpen(true);
                  }
                }}
              >
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-2">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        filter: (
                          filter === "collection"
                            ? item.wasCollected || item.isUnlocked
                            : item.isUnlocked
                        )
                          ? "none"
                          : "grayscale(100%) brightness(0.4)",
                      }}
                    />
                  ) : (
                    <div
                      className="text-3xl"
                      style={{
                        color: (
                          filter === "collection"
                            ? item.wasCollected || item.isUnlocked
                            : item.isUnlocked
                        )
                          ? rarity.color
                          : "#444444",
                      }}
                    >
                      □
                    </div>
                  )}
                </div>
                <div
                  className="text-center text-[8px] truncate px-1"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: (
                      filter === "collection"
                        ? item.wasCollected || item.isUnlocked
                        : item.isUnlocked
                    )
                      ? rarity.color
                      : "#555555",
                  }}
                >
                  {item.name}
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <span
                    className="text-[9px]"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: (
                        filter === "collection"
                          ? item.wasCollected || item.isUnlocked
                          : item.isUnlocked
                      )
                        ? "#cccccc"
                        : "#444444",
                    }}
                  >
                    {filter === "collection" && item.wasCollected
                      ? `x${item.collectionQuantity || 0}`
                      : item.isUnlocked
                        ? `x${item.quantity}`
                        : "x0"}
                  </span>
                  {filter === "collection" &&
                    item.wasCollected &&
                    !item.isUnlocked && (
                      <span
                        className="text-[7px] px-1 py-0.5 rounded"
                        style={{
                          fontFamily: "'Press Start 2P', cursive",
                          backgroundColor: "#666",
                          color: "#fff",
                        }}
                      >
                        SOLD
                      </span>
                    )}
                </div>
                <div
                  className="text-[7px] text-center mt-1"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: (
                      filter === "collection"
                        ? item.wasCollected || item.isUnlocked
                        : item.isUnlocked
                    )
                      ? rarity.color
                      : "#444444",
                  }}
                >
                  {item.score_value} POWER
                </div>
                {hoveredItem?.id === item.id && item.description && (
                  <div
                    className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded border z-10"
                    style={{
                      borderColor: rarity.color,
                      backgroundColor: "rgba(0, 0, 0, 0.95)",
                      fontFamily: "'Press Start 2P', cursive",
                      fontSize: "0.55rem",
                      color: "#fff",
                    }}
                  >
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {itemsByRarity.length === 0 && (
        <div className="text-center py-8">
          <p
            style={{
              fontFamily: "'Press Start 2P', cursive",
              color: "#666",
              fontSize: "0.6rem",
            }}
          >
            {filter === "collection"
              ? "NO ITEMS COLLECTED YET"
              : filter === "sell"
                ? "NO ITEMS TO SELL"
                : "NO ITEMS FOUND"}
          </p>
        </div>
      )}

      <p
        className="mt-3 text-[8px] text-gray-500 text-center"
        style={{ fontFamily: "'Press Start 2P', cursive" }}
      >
        {filter === "not-owned"
          ? "Not in inventory yet"
          : filter === "collection"
            ? "Hover over items to see descriptions"
            : filter === "sell"
              ? "Select items to sell them for berries"
              : "Your item collection"}
      </p>

      {/* Item Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="border-2 max-w-sm"
          style={{
            borderColor: selectedItemForDialog
              ? rarities.find(
                  (r) =>
                    r.name.toLowerCase() ===
                    selectedItemForDialog.rarity.toLowerCase(),
                )?.color || "#666"
              : "#666",
            backgroundColor: "rgba(5, 5, 5, 0.98)",
          }}
        >
          {selectedItemForDialog && (
            <>
              <DialogHeader>
                <DialogTitle
                  className="text-center text-lg"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color:
                      rarities.find(
                        (r) =>
                          r.name.toLowerCase() ===
                          selectedItemForDialog.rarity.toLowerCase(),
                      )?.color || "#fff",
                  }}
                >
                  {selectedItemForDialog.name}
                </DialogTitle>
                <DialogDescription
                  className="text-center text-xs"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: "#666",
                  }}
                >
                  {selectedItemForDialog.rarity} ITEM
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center gap-4 py-4">
                {/* Item Image */}
                <div
                  className="w-32 h-32 flex items-center justify-center rounded border-2"
                  style={{
                    borderColor:
                      rarities.find(
                        (r) =>
                          r.name.toLowerCase() ===
                          selectedItemForDialog.rarity.toLowerCase(),
                      )?.color || "#666",
                    backgroundColor:
                      rarities.find(
                        (r) =>
                          r.name.toLowerCase() ===
                          selectedItemForDialog.rarity.toLowerCase(),
                      )?.bg || "rgba(0,0,0,0.5)",
                    boxShadow: `0 0 20px ${
                      rarities.find(
                        (r) =>
                          r.name.toLowerCase() ===
                          selectedItemForDialog.rarity.toLowerCase(),
                      )?.color || "#666"
                    }40`,
                  }}
                >
                  {selectedItemForDialog.image_url ? (
                    <img
                      src={selectedItemForDialog.image_url}
                      alt={selectedItemForDialog.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div
                      className="text-6xl"
                      style={{
                        color:
                          rarities.find(
                            (r) =>
                              r.name.toLowerCase() ===
                              selectedItemForDialog.rarity.toLowerCase(),
                          )?.color || "#666",
                      }}
                    >
                      □
                    </div>
                  )}
                </div>

                {/* Power */}
                <div
                  className="px-4 py-2 rounded"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor: "#ff00ff",
                    color: "#000",
                    fontSize: "0.7rem",
                  }}
                >
                  ⚡ {selectedItemForDialog.score_value} POWER
                </div>

                {/* Description */}
                {selectedItemForDialog.description && (
                  <p
                    className="text-center text-xs px-2"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      color: "#ccc",
                      lineHeight: "1.6",
                    }}
                  >
                    {selectedItemForDialog.description}
                  </p>
                )}

                {/* Quantity Info */}
                <div className="flex gap-4 text-[10px]">
                  <div
                    className="px-3 py-1 rounded"
                    style={{
                      fontFamily: "'Press Start 2P', cursive",
                      backgroundColor: selectedItemForDialog.isUnlocked
                        ? "rgba(0, 255, 255, 0.2)"
                        : "rgba(100, 100, 100, 0.2)",
                      color: selectedItemForDialog.isUnlocked
                        ? "#00ffff"
                        : "#666",
                    }}
                  >
                    OWNED: x{selectedItemForDialog.quantity}
                  </div>
                  {selectedItemForDialog.wasCollected && (
                    <div
                      className="px-3 py-1 rounded"
                      style={{
                        fontFamily: "'Press Start 2P', cursive",
                        backgroundColor: "rgba(255, 255, 0, 0.2)",
                        color: "#ffff00",
                      }}
                    >
                      COLLECTED: x{selectedItemForDialog.collectionQuantity}
                    </div>
                  )}
                </div>

                {/* Sell Value */}
                <div
                  className="text-[10px] text-gray-500"
                  style={{ fontFamily: "'Press Start 2P', cursive" }}
                >
                  SELL VALUE: {selectedItemForDialog.score_value}{" "}
                  <BerryIcon size={10} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
