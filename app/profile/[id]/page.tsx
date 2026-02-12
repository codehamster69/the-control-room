"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  name: string;
  rarity: string;
  image_url: string;
  score_value: number;
}

interface InventoryItem extends Item {
  quantity: number;
}

interface CollectionItem extends Item {
  collectionQuantity: number;
  isUnlocked: boolean;
}

const rarityOrder: Record<string, number> = {
  Mythic: 0,
  Legendary: 1,
  Epic: 2,
  Rare: 3,
  Uncommon: 4,
  Common: 5,
};

const rarityColors: Record<string, string> = {
  Mythic: "#ff0080",
  Legendary: "#ffff00",
  Epic: "#a855f7",
  Rare: "#00ffff",
  Uncommon: "#22c55e",
  Common: "#9ca3af",
};

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [huntBotStats, setHuntBotStats] = useState({
    botLevel: 0,
    runtimeLevel: 0,
    satelliteLevel: 0,
  });
  const [ranks, setRanks] = useState({
    globalRank: null as number | null,
    monthlyRank: null as number | null,
  });
  const [activeTab, setActiveTab] = useState<"inventory" | "collection">(
    "inventory",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Check if current user is authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/");
          return;
        }

        // Check if current user is verified
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("is_instagram_verified")
          .eq("id", user.id)
          .single();

        if (!currentProfile?.is_instagram_verified) {
          router.push("/");
          return;
        }

        // Load the profile being viewed with all stats
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            `
            id, 
            instagram_username, 
            avatar_url, 
            created_at,
            total_power,
            monthly_power_gain,
            total_items_collected,
            current_items_owned,
            bot_items_per_hour_level,
            bot_runtime_level,
            satellite_level,
            inventory,
            collection_history
          `,
          )
          .eq("id", profileId)
          .single();

        if (profileError || !profileData) {
          setError("User not found");
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Load hunt bot stats
        setHuntBotStats({
          botLevel: profileData.bot_items_per_hour_level || 0,
          runtimeLevel: profileData.bot_runtime_level || 0,
          satelliteLevel: profileData.satellite_level || 0,
        });

        // Load user's ranks
        const { data: globalRankData } = await supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("is_instagram_verified", true)
          .gt("total_power", profileData.total_power || 0);

        const { data: monthlyRankData } = await supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("is_instagram_verified", true)
          .gt("monthly_power_gain", profileData.monthly_power_gain || 0);

        setRanks({
          globalRank: (globalRankData?.length || 0) + 1,
          monthlyRank: (monthlyRankData?.length || 0) + 1,
        });

        // Load all items
        const { data: allItems } = await supabase.from("items").select("*");

        // Parse inventory and collection from JSON
        const inventoryData = (profileData as any)?.inventory || {};
        const collectionHistoryData =
          (profileData as any)?.collection_history || {};

        const inventoryMap = new Map(
          Object.entries(inventoryData).map(([itemId, quantity]) => [
            itemId,
            quantity as number,
          ]),
        );

        const collectionMap = new Map(
          Object.entries(collectionHistoryData).map(([itemId, quantity]) => [
            itemId,
            quantity as number,
          ]),
        );

        // Build inventory
        const inventoryItems = (allItems || [])
          .filter((item: Item) => inventoryMap.has(item.id))
          .map((item: Item) => ({
            ...item,
            quantity: inventoryMap.get(item.id) || 0,
          }));

        inventoryItems.sort((a: any, b: any) => {
          const rarityDiff =
            (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
          return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
        });

        setInventory(inventoryItems);

        // Build collection history
        const collectionItems = (allItems || [])
          .filter((item: Item) => collectionMap.has(item.id))
          .map((item: Item) => ({
            ...item,
            collectionQuantity: collectionMap.get(item.id) || 0,
            isUnlocked: inventoryMap.has(item.id),
          }));

        collectionItems.sort((a: any, b: any) => {
          const rarityDiff =
            (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
          return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
        });

        setCollection(collectionItems);
      } catch (err) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <h1
          className="text-2xl mb-4"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
          }}
        >
          ERROR
        </h1>
        <p className="text-gray-400 font-mono mb-6">
          {error || "User not found"}
        </p>
        <Link
          href="/"
          className="px-6 py-3 text-sm"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#ff00ff",
            color: "#050505",
          }}
        >
          BACK TO HOME
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <Link
          href="/"
          className="px-4 py-2 text-sm"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "#ff00ff",
            color: "#050505",
          }}
        >
          ← BACK
        </Link>
      </div>

      {/* Profile Info */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1 mb-4 cursor-pointer hover:scale-105 transition-transform"
          style={{
            boxShadow: "0 0 25px rgba(255, 0, 255, 0.4)",
          }}
          onClick={() =>
            profile.instagram_username &&
            window.open(
              `https://instagram.com/${profile.instagram_username}`,
              "_blank",
            )
          }
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.instagram_username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full rounded-full bg-black flex items-center justify-center"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ff00ff",
              }}
            >
              ?
            </div>
          )}
        </div>

        <h1
          className="text-xl mb-3 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ffff",
            textShadow: "0 0 10px #00ffff",
          }}
        >
          @{profile.instagram_username}
        </h1>

        {/* Instagram Button - Cozy Style */}
        {profile.instagram_username && (
          <a
            href={`https://instagram.com/${profile.instagram_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-4 py-2 rounded-full text-xs mb-4 hover:scale-105 transition-all"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              background:
                "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              color: "#ffffff",
              boxShadow: "0 4px 15px rgba(220, 39, 67, 0.4)",
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            <span className="group-hover:underline">
              @{profile.instagram_username}
            </span>
          </a>
        )}
      </div>

      {/* Power & Rank Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-2xl mx-auto">
        <div
          className="px-3 py-3 rounded text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 0, 255, 0.2)",
            border: "1px solid #ff00ff",
            color: "#ff00ff",
          }}
        >
          <div className="text-[10px] mb-1 opacity-70">TOTAL PWR</div>
          <div className="text-sm">{Math.floor(profile.total_power || 0)}</div>
        </div>
        <div
          className="px-3 py-3 rounded text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(0, 255, 0, 0.2)",
            border: "1px solid #00ff00",
            color: "#00ff00",
          }}
        >
          <div className="text-[10px] mb-1 opacity-70">MONTHLY PWR</div>
          <div className="text-sm">
            {Math.floor(profile.monthly_power_gain || 0)}
          </div>
        </div>
        <div
          className="px-3 py-3 rounded text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(255, 255, 0, 0.2)",
            border: "1px solid #ffff00",
            color: "#ffff00",
          }}
        >
          <div className="text-[10px] mb-1 opacity-70">GLOBAL RANK</div>
          <div className="text-sm">#{ranks.globalRank || "-"}</div>
        </div>
        <div
          className="px-3 py-3 rounded text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor: "rgba(0, 255, 255, 0.2)",
            border: "1px solid #00ffff",
            color: "#00ffff",
          }}
        >
          <div className="text-[10px] mb-1 opacity-70">MONTHLY RANK</div>
          <div className="text-sm">#{ranks.monthlyRank || "-"}</div>
        </div>
      </div>

      {/* Hunt Bot Stats */}
      <div
        className="mb-6 p-4 rounded max-w-2xl mx-auto"
        style={{
          backgroundColor: "rgba(255, 0, 255, 0.1)",
          border: "2px solid #ff00ff",
        }}
      >
        <h3
          className="text-sm mb-3 text-center"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
          }}
        >
          🤖 HUNT BOT STATS
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div
              className="text-[10px] mb-1"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#666",
              }}
            >
              BOT LVL
            </div>
            <div
              className="text-lg"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#00ffff",
              }}
            >
              {huntBotStats.botLevel}
            </div>
          </div>
          <div className="text-center">
            <div
              className="text-[10px] mb-1"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#666",
              }}
            >
              RUNTIME LVL
            </div>
            <div
              className="text-lg"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ffff00",
              }}
            >
              {huntBotStats.runtimeLevel}
            </div>
          </div>
          <div className="text-center">
            <div
              className="text-[10px] mb-1"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#666",
              }}
            >
              SATELLITE LVL
            </div>
            <div
              className="text-lg"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ff0080",
              }}
            >
              {huntBotStats.satelliteLevel}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex justify-center gap-2 mb-4 max-w-2xl mx-auto">
        <button
          onClick={() => setActiveTab("inventory")}
          className="flex-1 py-2 text-xs transition-all"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor:
              activeTab === "inventory"
                ? "rgba(255, 0, 255, 0.3)"
                : "rgba(255, 0, 255, 0.1)",
            border: "2px solid #ff00ff",
            color: activeTab === "inventory" ? "#ff00ff" : "#666",
          }}
        >
          📦 INVENTORY ({inventory.length})
        </button>
        <button
          onClick={() => setActiveTab("collection")}
          className="flex-1 py-2 text-xs transition-all"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            backgroundColor:
              activeTab === "collection"
                ? "rgba(255, 255, 0, 0.3)"
                : "rgba(255, 255, 0, 0.1)",
            border: "2px solid #ffff00",
            color: activeTab === "collection" ? "#ffff00" : "#666",
          }}
        >
          🏆 COLLECTION ({collection.length})
        </button>
      </div>

      {/* Inventory / Collection Display */}
      <div
        className="mb-8 max-w-2xl mx-auto"
        style={{
          borderColor: activeTab === "inventory" ? "#ff00ff" : "#ffff00",
          borderWidth: "2px",
          borderStyle: "solid",
          padding: "1rem",
        }}
      >
        {activeTab === "inventory" ? (
          <>
            <h2
              className="text-lg mb-4 text-center"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ff00ff",
              }}
            >
              CURRENTLY OWNED
            </h2>
            {inventory.length === 0 ? (
              <p
                className="text-gray-500 font-mono text-center py-8"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  fontSize: "0.75rem",
                }}
              >
                NO ITEMS YET
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  inventory.reduce(
                    (acc, item) => {
                      if (!acc[item.rarity]) acc[item.rarity] = [];
                      acc[item.rarity].push(item);
                      return acc;
                    },
                    {} as Record<string, InventoryItem[]>,
                  ),
                )
                  .sort(
                    (a, b) =>
                      (rarityOrder[a[0]] ?? 999) - (rarityOrder[b[0]] ?? 999),
                  )
                  .map(([rarity, items]) => (
                    <div key={rarity}>
                      <h3
                        className="text-sm mb-3 px-2 py-1 rounded"
                        style={{
                          fontFamily: "'Press Start 2P', cursive",
                          color: rarityColors[rarity] || "#666",
                          backgroundColor:
                            `${rarityColors[rarity]}20` || "#66666620",
                          borderLeft: `4px solid ${rarityColors[rarity] || "#666"}`,
                        }}
                      >
                        {rarity.toUpperCase()} ({items.length})
                      </h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="relative overflow-hidden border-2 p-2 flex flex-col items-center"
                            style={{
                              borderColor: rarityColors[item.rarity] || "#666",
                              backgroundColor: "rgba(255, 0, 255, 0.1)",
                              boxShadow: `0 0 8px ${rarityColors[item.rarity] || "#666"}`,
                            }}
                          >
                            <div className="w-full h-12 flex items-center justify-center mb-1">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              ) : (
                                <div
                                  className="text-2xl"
                                  style={{
                                    color: rarityColors[item.rarity] || "#666",
                                  }}
                                >
                                  □
                                </div>
                              )}
                            </div>
                            <div
                              className="text-center text-[8px] mb-1 truncate w-full"
                              style={{
                                fontFamily: "'Press Start 2P', cursive",
                                color: rarityColors[item.rarity] || "#666",
                              }}
                            >
                              {item.name}
                            </div>
                            <div
                              className="absolute top-1 right-1 px-1 py-0.5 text-[8px]"
                              style={{
                                fontFamily: "'Press Start 2P', cursive",
                                backgroundColor:
                                  rarityColors[item.rarity] || "#666",
                                color: "#050505",
                              }}
                            >
                              x{item.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h2
              className="text-lg mb-4 text-center"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ffff00",
              }}
            >
              ALL-TIME COLLECTION
            </h2>
            {collection.length === 0 ? (
              <p
                className="text-gray-500 font-mono text-center py-8"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  fontSize: "0.75rem",
                }}
              >
                NO ITEMS COLLECTED YET
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  collection.reduce(
                    (acc, item) => {
                      if (!acc[item.rarity]) acc[item.rarity] = [];
                      acc[item.rarity].push(item);
                      return acc;
                    },
                    {} as Record<string, CollectionItem[]>,
                  ),
                )
                  .sort(
                    (a, b) =>
                      (rarityOrder[a[0]] ?? 999) - (rarityOrder[b[0]] ?? 999),
                  )
                  .map(([rarity, items]) => (
                    <div key={rarity}>
                      <h3
                        className="text-sm mb-3 px-2 py-1 rounded"
                        style={{
                          fontFamily: "'Press Start 2P', cursive",
                          color: rarityColors[rarity] || "#666",
                          backgroundColor:
                            `${rarityColors[rarity]}20` || "#66666620",
                          borderLeft: `4px solid ${rarityColors[rarity] || "#666"}`,
                        }}
                      >
                        {rarity.toUpperCase()} ({items.length})
                      </h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="relative overflow-hidden border-2 p-2 flex flex-col items-center"
                            style={{
                              borderColor: rarityColors[item.rarity] || "#666",
                              backgroundColor: item.isUnlocked
                                ? "rgba(255, 0, 255, 0.1)"
                                : "rgba(100, 100, 100, 0.2)",
                              boxShadow: item.isUnlocked
                                ? `0 0 8px ${rarityColors[item.rarity] || "#666"}`
                                : "none",
                              opacity: item.isUnlocked ? 1 : 0.7,
                            }}
                          >
                            <div className="w-full h-12 flex items-center justify-center mb-1">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="max-w-full max-h-full object-contain"
                                  style={{
                                    filter: item.isUnlocked
                                      ? "none"
                                      : "grayscale(100%)",
                                  }}
                                />
                              ) : (
                                <div
                                  className="text-2xl"
                                  style={{
                                    color: rarityColors[item.rarity] || "#666",
                                    filter: item.isUnlocked
                                      ? "none"
                                      : "grayscale(100%)",
                                  }}
                                >
                                  □
                                </div>
                              )}
                            </div>
                            <div
                              className="text-center text-[8px] mb-1 truncate w-full"
                              style={{
                                fontFamily: "'Press Start 2P', cursive",
                                color: rarityColors[item.rarity] || "#666",
                              }}
                            >
                              {item.name}
                            </div>
                            <div className="flex justify-between w-full items-center">
                              <span
                                className="text-[8px]"
                                style={{
                                  fontFamily: "'Press Start 2P', cursive",
                                  color: item.isUnlocked
                                    ? rarityColors[item.rarity]
                                    : "#666",
                                }}
                              >
                                x{item.collectionQuantity}
                              </span>
                              {!item.isUnlocked && (
                                <span
                                  className="text-[7px] px-1 rounded"
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
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        className="text-center"
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
