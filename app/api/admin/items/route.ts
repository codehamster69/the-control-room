import { createClient, createAdminClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

// Valid rarities
const VALID_RARITIES = [
  "Mythic",
  "Legendary",
  "Epic",
  "Rare",
  "Uncommon",
  "Common",
];

// GET - Fetch all items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { data, error } = await adminSupabase
      .from("items")
      .select("*")
      .order("rarity", { ascending: false });

    if (error) {
      console.error("Error fetching items:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error("Error in GET items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, rarity, score_value, image_url } = body;

    if (!name || !rarity || score_value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Normalize rarity to match valid values
    const normalizedRarity =
      rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();

    if (!VALID_RARITIES.includes(normalizedRarity)) {
      return NextResponse.json(
        {
          error: `Rarity must be one of: ${VALID_RARITIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await adminSupabase
      .from("items")
      .insert({
        name: String(name),
        rarity: normalizedRarity,
        score_value: parseInt(String(score_value)),
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating item:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
      message: "Item created successfully",
    });
  } catch (error) {
    console.error("Error in POST items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update existing item
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, rarity, score_value, image_url } = body;

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Build update object with explicit types
    const updateData: { name?: string; rarity?: string; score_value?: number; image_url?: string | null } = {};

    if (name !== undefined) {
      updateData.name = String(name);
    }

    if (rarity) {
      const normalizedRarity =
        rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
      if (!VALID_RARITIES.includes(normalizedRarity)) {
        return NextResponse.json(
          {
            error: `Rarity must be one of: ${VALID_RARITIES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updateData.rarity = normalizedRarity;
    }

    if (score_value !== undefined) {
      updateData.score_value = parseInt(String(score_value));
    }

    if (image_url !== undefined) {
      updateData.image_url = image_url;
    }

    const { data, error } = await adminSupabase
      .from("items")
      .update(updateData)
      .eq("id", String(id))
      .select()
      .single();

    if (error) {
      console.error("Error updating item:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
      message: "Item updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete item
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const { error } = await adminSupabase
      .from("items")
      .delete()
      .eq("id", String(id));

    if (error) {
      console.error("Error deleting item:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

