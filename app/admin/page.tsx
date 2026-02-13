"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  name: string;
  description?: string;
  rarity: string;
  score_value: number;
  image_url: string | null;
  created_at: string;
}

interface CommunityLink {
  id: string;
  name: string;
  url: string;
  icon_emoji: string;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// New rarities
const rarities = [
  { value: "Mythic", color: "#ff0080", label: "MYTHIC" },
  { value: "Legendary", color: "#ffff00", label: "LEGENDARY" },
  { value: "Epic", color: "#a855f7", label: "EPIC" },
  { value: "Rare", color: "#00ffff", label: "RARE" },
  { value: "Uncommon", color: "#22c55e", label: "UNCOMMON" },
  { value: "Common", color: "#9ca3af", label: "COMMON" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [communityLinks, setCommunityLinks] = useState<CommunityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "links">("items");

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    rarity: string;
    score_value: number;
    image_url: string;
  }>({
    name: "",
    description: "",
    rarity: "Common",
    score_value: 10,
    image_url: "",
  });

  const [linkFormData, setLinkFormData] = useState<{
    name: string;
    url: string;
    icon_emoji: string;
    description: string;
  }>({
    name: "",
    url: "",
    icon_emoji: "🔗",
    description: "",
  });

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isEditingLink, setIsEditingLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const checkAdmin = async () => {
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
    fetchCommunityLinks();
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

  const fetchCommunityLinks = async () => {
    try {
      const response = await fetch("/api/admin/community-links");
      if (!response.ok) {
        throw new Error("Failed to fetch community links");
      }
      const data = await response.json();
      setCommunityLinks(data.links || []);
    } catch (err) {
      console.error("Failed to fetch community links:", err);
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
        description: "",
        rarity: "Common",
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

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint = "/api/admin/community-links";
      const method = isEditingLink ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...linkFormData,
          ...(isEditingLink && { id: isEditingLink }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save link");
      }

      setSuccess(
        isEditingLink
          ? "Link updated successfully"
          : "Link created successfully",
      );
      setIsEditingLink(null);

      setLinkFormData({
        name: "",
        url: "",
        icon_emoji: "🔗",
        description: "",
      });

      fetchCommunityLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Item) => {
    setFormData({
      name: item.name,
      description: item.description || "",
      rarity: item.rarity,
      score_value: item.score_value || 10,
      image_url: item.image_url || "",
    });
    setIsEditing(item.id);
  };

  const handleEditLink = (link: CommunityLink) => {
    setLinkFormData({
      name: link.name,
      url: link.url,
      icon_emoji: link.icon_emoji || "🔗",
      description: link.description || "",
    });
    setIsEditingLink(link.id);
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

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link?")) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/community-links?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete link");
      }

      setSuccess("Link deleted successfully");
      fetchCommunityLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    const r = rarities.find((r) => r.value === rarity);
    return r ? r.color : "#9ca3af";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div
          className="text-cyan-400 font-mono text-sm sm:text-base animate-pulse"
          style={{ fontFamily: '"Press Start 2P", cursive' }}
        >
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
      className="bg-[#050505] text-white p-3 sm:p-4"
      style={{ fontFamily: '"Press Start 2P", cursive' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505] flex justify-between items-center mb-4 sm:mb-6 border-b border-gray-800 pb-3">
        <h1 className="text-base sm:text-lg" style={{ color: "#ff00ff" }}>
          ADMIN
        </h1>
        <Link
          href="/"
          className="px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs border-2 hover:bg-gray-900 transition"
          style={{ borderColor: "#00ffff" }}
        >
          BACK
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("items")}
          className="flex-1 px-2 sm:px-4 py-2 text-[10px] sm:text-sm border-2 transition"
          style={{
            borderColor: activeTab === "items" ? "#ffff00" : "#333",
            backgroundColor:
              activeTab === "items" ? "rgba(255, 255, 0, 0.1)" : "transparent",
            color: activeTab === "items" ? "#ffff00" : "#666",
          }}
        >
          ITEMS
        </button>
        <button
          onClick={() => setActiveTab("links")}
          className="flex-1 px-2 sm:px-4 py-2 text-[10px] sm:text-sm border-2 transition"
          style={{
            borderColor: activeTab === "links" ? "#00ff00" : "#333",
            backgroundColor:
              activeTab === "links" ? "rgba(0, 255, 0, 0.1)" : "transparent",
            color: activeTab === "links" ? "#00ff00" : "#666",
          }}
        >
          LINKS
        </button>
      </div>

      {error && (
        <div
          className="mb-4 p-2 border-2 text-sm"
          style={{ borderColor: "#ff0000", color: "#ff0000" }}
        >
          ERROR: {error}
        </div>
      )}
      {success && (
        <div
          className="mb-4 p-2 border-2 text-sm"
          style={{ borderColor: "#00ff00", color: "#00ff00" }}
        >
          {success}
        </div>
      )}

      {activeTab === "items" && (
        <div className="space-y-4">
          <div>
            <div
              className="border-2 p-3 sm:p-4"
              style={{ borderColor: "#ffff00" }}
            >
              <h2
                className="text-sm sm:text-base mb-3 sm:mb-4"
                style={{ color: "#ffff00" }}
              >
                {isEditing ? "EDIT_ITEM" : "NEW_ITEM"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    NAME
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    DESCRIPTION
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Item description..."
                    rows={2}
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    IMAGE
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
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
                        className="w-16 h-16 object-cover border-2"
                        style={{ borderColor: "#00ff00" }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, image_url: "" })
                        }
                        className="text-red-400 text-xs mt-1 hover:underline block"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    RARITY
                  </label>
                  <select
                    value={formData.rarity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rarity: e.target.value,
                      })
                    }
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  >
                    {rarities.map((rarity) => (
                      <option key={rarity.value} value={rarity.value}>
                        {rarity.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    SCORE VALUE
                  </label>
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
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gray-900 border-2 p-2 hover:bg-gray-800 transition disabled:opacity-50 text-xs sm:text-sm"
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
                          description: "",
                          rarity: "Common",
                          score_value: 10,
                          image_url: "",
                        });
                      }}
                      className="flex-1 bg-gray-900 border-2 p-2 hover:bg-gray-800 transition text-xs sm:text-sm"
                      style={{ borderColor: "#ff00ff" }}
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div>
            <div
              className="border-2 p-3 sm:p-4"
              style={{ borderColor: "#ff00ff" }}
            >
              <h2
                className="text-sm sm:text-base mb-3 sm:mb-4"
                style={{ color: "#ff00ff" }}
              >
                ITEMS ({items.length})
              </h2>

              <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
                {items.length === 0 ? (
                  <p style={{ color: "#ff00ff" }}>NO_ITEMS</p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="border-2 p-2 sm:p-3 hover:bg-gray-900 transition"
                      style={{ borderColor: getRarityColor(item.rarity) }}
                    >
                      <div className="flex gap-2 sm:gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-10 h-10 sm:w-12 sm:h-12 object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <h3
                                className="font-bold text-xs sm:text-sm truncate"
                                style={{ color: getRarityColor(item.rarity) }}
                              >
                                {item.name}
                              </h3>
                            </div>
                            <div className="text-[10px] sm:text-xs ml-2 text-right shrink-0">
                              <span
                                style={{ color: getRarityColor(item.rarity) }}
                              >
                                {item.rarity.toUpperCase()}
                              </span>
                              <br />
                              <span className="text-gray-400">
                                SV:{item.score_value}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1 sm:gap-2 mt-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="flex-1 text-[10px] sm:text-xs bg-gray-900 border-2 p-1 hover:bg-gray-800 transition"
                              style={{ borderColor: "#00ffff" }}
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="flex-1 text-[10px] sm:text-xs bg-gray-900 border-2 p-1 hover:bg-gray-800 transition"
                              style={{ borderColor: "#ff0000" }}
                            >
                              DEL
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
      )}

      {activeTab === "links" && (
        <div className="space-y-4">
          <div>
            <div
              className="border-2 p-3 sm:p-4"
              style={{ borderColor: "#00ff00" }}
            >
              <h2
                className="text-sm sm:text-base mb-3 sm:mb-4"
                style={{ color: "#00ff00" }}
              >
                {isEditingLink ? "EDIT_LINK" : "NEW_LINK"}
              </h2>

              <form
                onSubmit={handleLinkSubmit}
                className="space-y-3 sm:space-y-4"
              >
                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    NAME
                  </label>
                  <input
                    type="text"
                    value={linkFormData.name}
                    onChange={(e) =>
                      setLinkFormData({ ...linkFormData, name: e.target.value })
                    }
                    required
                    placeholder="Group name"
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    URL
                  </label>
                  <input
                    type="url"
                    value={linkFormData.url}
                    onChange={(e) =>
                      setLinkFormData({ ...linkFormData, url: e.target.value })
                    }
                    required
                    placeholder="https://..."
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    ICON
                  </label>
                  <input
                    type="text"
                    value={linkFormData.icon_emoji}
                    onChange={(e) =>
                      setLinkFormData({
                        ...linkFormData,
                        icon_emoji: e.target.value,
                      })
                    }
                    placeholder="🔗"
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm mb-1 sm:mb-2">
                    DESC
                  </label>
                  <textarea
                    value={linkFormData.description}
                    onChange={(e) =>
                      setLinkFormData({
                        ...linkFormData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Description..."
                    rows={2}
                    className="w-full bg-gray-900 border-2 p-2 text-white text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gray-900 border-2 p-2 hover:bg-gray-800 transition disabled:opacity-50 text-xs sm:text-sm"
                    style={{ borderColor: "#00ffff" }}
                  >
                    {isEditingLink ? "UPDATE" : "CREATE"}
                  </button>
                  {isEditingLink && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingLink(null);
                        setLinkFormData({
                          name: "",
                          url: "",
                          icon_emoji: "🔗",
                          description: "",
                        });
                      }}
                      className="flex-1 bg-gray-900 border-2 p-2 hover:bg-gray-800 transition text-xs sm:text-sm"
                      style={{ borderColor: "#ff00ff" }}
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div>
            <div
              className="border-2 p-3 sm:p-4"
              style={{ borderColor: "#00ffff" }}
            >
              <h2
                className="text-sm sm:text-base mb-3 sm:mb-4"
                style={{ color: "#00ffff" }}
              >
                LINKS ({communityLinks.length})
              </h2>

              <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
                {communityLinks.length === 0 ? (
                  <p style={{ color: "#00ffff" }}>NO_LINKS</p>
                ) : (
                  communityLinks.map((link) => (
                    <div
                      key={link.id}
                      className="border-2 p-2 sm:p-3 hover:bg-gray-900 transition"
                      style={{
                        borderColor: link.is_active ? "#00ff00" : "#666",
                      }}
                    >
                      <div className="flex gap-2 sm:gap-3 items-center">
                        <div
                          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl bg-gray-800 border-2 shrink-0"
                          style={{ borderColor: "#333" }}
                        >
                          {link.icon_emoji || "🔗"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <h3
                                className="font-bold text-xs sm:text-sm truncate"
                                style={{
                                  color: link.is_active ? "#00ff00" : "#666",
                                }}
                              >
                                {link.name}
                              </h3>
                              <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                                {link.url}
                              </p>
                            </div>
                            <div className="text-[10px] sm:text-xs ml-2 text-right shrink-0">
                              <span
                                style={{
                                  color: link.is_active ? "#00ff00" : "#ff0000",
                                }}
                              >
                                {link.is_active ? "ACTIVE" : "OFF"}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1 sm:gap-2 mt-2">
                            <button
                              onClick={() => handleEditLink(link)}
                              className="flex-1 text-[10px] sm:text-xs bg-gray-900 border-2 p-1 hover:bg-gray-800 transition"
                              style={{ borderColor: "#00ffff" }}
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              className="flex-1 text-[10px] sm:text-xs bg-gray-900 border-2 p-1 hover:bg-gray-800 transition"
                              style={{ borderColor: "#ff0000" }}
                            >
                              DEL
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
      )}
    </div>
  );
}
