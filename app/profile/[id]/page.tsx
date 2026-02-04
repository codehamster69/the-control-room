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
}

interface InventoryItem extends Item {
  quantity: number;
}

const rarityOrder = { Legendary: 0, Rare: 1, Common: 2 };
const rarityColors = {
  Legendary: "#ffff00",
  Rare: "#00ffff",
  Common: "#ff00ff",
};

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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

        // Load the profile being viewed
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, instagram_username, avatar_url, is_instagram_verified, created_at",
          )
          .eq("id", profileId)
          .single();

        if (profileError || !profileData) {
          setError("User not found");
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Load user's stats from leaderboard view (calculates power from inventory)
        const { data: statsData } = await supabase
          .from("leaderboard")
          .select("chaos_stat, simp_stat, item_power, total_power")
          .eq("id", profileId)
          .single();

        if (statsData) {
          setProfile((prev: any) => ({
            ...prev,
            ...statsData,
            power_stat: statsData.total_power || 0,
          }));
        }

        // Load user's inventory
        const { data: allItems } = await supabase.from("items").select("*");

        const { data: userInventory } = await supabase
          .from("inventory")
          .select("*")
          .eq("user_id", profileId);

        const inventoryMap = new Map(
          userInventory?.map((inv) => [inv.item_id, inv.quantity]) || [],
        );

        const combinedItems = (allItems || [])
          .filter((item: Item) => inventoryMap.has(item.id))
          .map((item: Item) => ({
            ...item,
            quantity: inventoryMap.get(item.id) || 0,
          }));

        combinedItems.sort((a: any, b: any) => {
          const rarityDiff =
            rarityOrder[a.rarity as keyof typeof rarityOrder] -
            rarityOrder[b.rarity as keyof typeof rarityOrder];
          return rarityDiff === 0 ? a.name.localeCompare(b.name) : rarityDiff;
        });

        setInventory(combinedItems);
      } catch (err) {
        setError("Failed to load profile");
        console.error(err);
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
          className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1 mb-4"
          style={{
            boxShadow: "0 0 20px rgba(255, 0, 255, 0.3)",
          }}
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
          className="text-2xl mb-2"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#00ffff",
            textShadow: "0 0 10px #00ffff",
          }}
        >
          @{profile.instagram_username}
        </h1>

        {profile.is_instagram_verified && (
          <div
            className="px-3 py-1 text-xs"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              backgroundColor: "#00ff00",
              color: "#050505",
            }}
          >
            ✓ VERIFIED
          </div>
        )}
      </div>

      {/* User Stats */}
      {profile.chaos_stat !== undefined && (
        <div className="flex gap-4 mb-8">
          <div
            className="px-4 py-2 rounded"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              backgroundColor: "rgba(255, 0, 255, 0.2)",
              color: "#ff00ff",
              fontSize: "0.7rem",
            }}
          >
            CHAOS: {(profile.chaos_stat || 0).toFixed(1)}
          </div>
          <div
            className="px-4 py-2 rounded"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              backgroundColor: "rgba(0, 255, 255, 0.2)",
              color: "#00ffff",
              fontSize: "0.7rem",
            }}
          >
            POWER: {Math.floor(profile.total_power || 0)}
          </div>
          <div
            className="px-4 py-2 rounded"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              backgroundColor: "rgba(255, 255, 0, 0.2)",
              color: "#ffff00",
              fontSize: "0.7rem",
            }}
          >
            SIMP: {(profile.simp_stat || 0).toFixed(1)}
          </div>
        </div>
      )}

      {/* Inventory */}
      <div
        className="mb-8"
        style={{
          borderColor: "#ff00ff",
          borderWidth: "2px",
          borderStyle: "solid",
          padding: "1rem",
        }}
      >
        <h2
          className="text-xl mb-4"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
          }}
        >
          INVENTORY ({inventory.length} items)
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {inventory.map((item) => (
              <div
                key={item.id}
                className="relative overflow-hidden border-2 p-3 flex flex-col items-center"
                style={{
                  borderColor:
                    rarityColors[item.rarity as keyof typeof rarityColors],
                  backgroundColor: "rgba(255, 0, 255, 0.1)",
                  boxShadow: `0 0 10px ${rarityColors[item.rarity as keyof typeof rarityColors]}`,
                }}
              >
                {/* Item Icon */}
                <div className="w-full h-16 flex items-center justify-center mb-2">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div
                      className="text-3xl"
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
                </div>

                {/* Item Name */}
                <div
                  className="text-center text-xs mb-1"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color:
                      rarityColors[item.rarity as keyof typeof rarityColors],
                    fontSize: "0.5rem",
                  }}
                >
                  {item.name}
                </div>

                {/* Quantity */}
                <div
                  className="absolute top-1 right-1 px-1.5 py-0.5 text-xs font-bold"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    backgroundColor:
                      rarityColors[item.rarity as keyof typeof rarityColors],
                    color: "#050505",
                    fontSize: "0.5rem",
                  }}
                >
                  x{item.quantity}
                </div>

                {/* Rarity */}
                <div
                  className="text-xs"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color:
                      rarityColors[item.rarity as keyof typeof rarityColors],
                    fontSize: "0.4rem",
                  }}
                >
                  {item.rarity.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
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
