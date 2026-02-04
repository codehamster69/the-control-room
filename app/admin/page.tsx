"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  name: string;
  description?: string;
  rarity: "common" | "rare" | "legendary";
  weight?: number;
  score_value: number;
  image_url: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    rarity: "common" | "rare" | "legendary";
    score_value: number;
    image_url: string;
  }>({
    name: "",
    rarity: "common",
    score_value: 10,
    image_url: "",
  });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const checkAdmin = async () => {
      // Try to fetch items - if unauthorized, will redirect
      try {
        const response = await fetch("/api/admin/items");
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.push("/");
            return;
          }
          throw new Error("Failed to check admin status");
        }

        const data = await response.json();
        setItems(data.items || []);
        setIsAdmin(true);
      } catch (err) {
        router.push("/");
        return;
      }

      setLoading(false);
    };

    checkAdmin();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/admin/items");
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      setError("Failed to fetch items");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("bucket", "item-images");
      formDataUpload.append("path", filePath);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      setFormData({ ...formData, image_url: data.url });
      setSuccess("Image uploaded successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint = "/api/admin/items";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          ...(isEditing && { id: isEditing }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save item");
      }

      setSuccess(
        isEditing ? "Item updated successfully" : "Item created successfully",
      );
      setIsEditing(null);

      setFormData({
        name: "",
        rarity: "common",
        score_value: 10,
        image_url: "",
      });

      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Item) => {
    setFormData({
      name: item.name,
      rarity: item.rarity,
      score_value: item.score_value || item.weight || 10,
      image_url: item.image_url || "",
    });
    setIsEditing(item.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/items?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete item");
      }

      setSuccess("Item deleted successfully");
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const rarityColors = {
    common: "#ff00ff",
    rare: "#00ffff",
    legendary: "#ffff00",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-2xl animate-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div
      className="min-h-screen bg-black text-white p-6"
      style={{ fontFamily: '"Press Start 2P", cursive' }}
    >
      <div
        className="flex justify-between items-center mb-8 border-2"
        style={{ borderColor: "#ff00ff" }}
      >
        <h1 className="text-2xl p-4" style={{ color: "#ff00ff" }}>
          [ADMIN_PANEL]
        </h1>
        <Link
          href="/"
          className="px-4 py-2 border-2 hover:bg-gray-900 transition"
          style={{ borderColor: "#00ffff" }}
        >
          BACK TO HOME
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="border-2 p-4" style={{ borderColor: "#ffff00" }}>
            <h2 className="text-xl mb-4" style={{ color: "#ffff00" }}>
              {isEditing ? "EDIT_ITEM" : "NEW_ITEM"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-2">NAME</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full bg-gray-900 border-2 p-2 text-white"
                  style={{ borderColor: "#00ffff" }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2">IMAGE</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full bg-gray-900 border-2 p-2 text-white text-sm"
                  style={{ borderColor: "#00ffff" }}
                />
                {uploading && (
                  <p className="text-yellow-400 text-xs mt-1">Uploading...</p>
                )}
                {formData.image_url && (
                  <div className="mt-2">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-20 h-20 object-cover border-2"
                      style={{ borderColor: "#00ff00" }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, image_url: "" })
                      }
                      className="text-red-400 text-xs mt-1 hover:underline"
                    >
                      Remove image
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm mb-2">RARITY</label>
                <select
                  value={formData.rarity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rarity: e.target.value as "common" | "rare" | "legendary",
                    })
                  }
                  className="w-full bg-gray-900 border-2 p-2 text-white"
                  style={{ borderColor: "#00ffff" }}
                >
                  <option value="common">COMMON</option>
                  <option value="rare">RARE</option>
                  <option value="legendary">LEGENDARY</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2">SCORE VALUE</label>
                <input
                  type="number"
                  value={formData.score_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      score_value: parseInt(e.target.value),
                    })
                  }
                  min="1"
                  required
                  className="w-full bg-gray-900 border-2 p-2 text-white"
                  style={{ borderColor: "#00ffff" }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gray-900 border-2 p-2 hover:bg-gray-800 transition disabled:opacity-50"
                  style={{ borderColor: "#00ffff" }}
                >
                  {isEditing ? "UPDATE" : "CREATE"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(null);
                      setFormData({
                        name: "",
                        rarity: "common",
                        score_value: 10,
                        image_url: "",
                      });
                    }}
                    className="flex-1 bg-gray-900 border-2 p-2 hover:bg-gray-800 transition"
                    style={{ borderColor: "#ff00ff" }}
                  >
                    CANCEL
                  </button>
                )}
              </div>
            </form>

            {error && (
              <div
                className="mt-4 p-2 border-2 text-sm"
                style={{ borderColor: "#ff0000", color: "#ff0000" }}
              >
                ERROR: {error}
              </div>
            )}
            {success && (
              <div
                className="mt-4 p-2 border-2 text-sm"
                style={{ borderColor: "#00ff00", color: "#00ff00" }}
              >
                {success}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="border-2 p-4" style={{ borderColor: "#ff00ff" }}>
            <h2 className="text-xl mb-4" style={{ color: "#ff00ff" }}>
              ITEMS_DATABASE
            </h2>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {items.length === 0 ? (
                <p style={{ color: "#ff00ff" }}>NO_ITEMS_FOUND</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="border-2 p-3 hover:bg-gray-900 transition"
                    style={{ borderColor: rarityColors[item.rarity] }}
                  >
                    <div className="flex gap-4">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-16 h-16 object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3
                              className="font-bold text-sm"
                              style={{ color: rarityColors[item.rarity] }}
                            >
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="text-xs mt-1 text-gray-400">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="text-xs ml-4 text-right">
                            <span style={{ color: rarityColors[item.rarity] }}>
                              {item.rarity.toUpperCase()}
                            </span>
                            <br />
                            <span className="text-gray-400">
                              SV:{item.score_value || item.weight}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="flex-1 text-xs bg-gray-900 border-2 p-1 hover:bg-gray-800 transition"
                            style={{ borderColor: "#00ffff" }}
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex-1 text-xs bg-gray-900 border-2 p-1 hover:bg-gray-800 transition"
                            style={{ borderColor: "#ff0000" }}
                          >
                            DELETE
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
