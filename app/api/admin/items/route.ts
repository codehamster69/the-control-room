import { createClient, createAdminClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

// GET - Fetch all items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
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

    // Fetch items using admin client (bypasses RLS)
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

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
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

    // Capitalize rarity to match database constraint
    const capitalizedRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
    if (!['Common', 'Rare', 'Legendary'].includes(capitalizedRarity)) {
      return NextResponse.json(
        { error: "Rarity must be Common, Rare, or Legendary" },
        { status: 400 }
      );
    }

    // Insert item using admin client (bypasses RLS)
    const { data, error } = await adminSupabase
      .from("items")
      .insert({
        name,
        rarity: capitalizedRarity,
        score_value: parseInt(score_value),
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

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
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
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Capitalize rarity to match database constraint
    const capitalizedRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
    if (!['Common', 'Rare', 'Legendary'].includes(capitalizedRarity)) {
      return NextResponse.json(
        { error: "Rarity must be Common, Rare, or Legendary" },
        { status: 400 }
      );
    }

    // Update item using admin client (bypasses RLS)
    const { data, error } = await adminSupabase
      .from("items")
      .update({
        name,
        rarity: capitalizedRarity,
        score_value: parseInt(score_value),
        image_url: image_url || null,
      })
      .eq("id", id)
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

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
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
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Delete item using admin client (bypasses RLS)
    const { error } = await adminSupabase
      .from("items")
      .delete()
      .eq("id", id);

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

