-- Fix RLS policy for inventory to allow reading all inventories
-- This allows users to see other players' inventories on their profile pages

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can read own inventory" ON inventory;

-- Create new policy that allows everyone to read all inventories
CREATE POLICY "Users can read all inventories" ON inventory FOR SELECT USING (true);

-- Keep the update policy restrictive (users can only update their own)
-- This policy should already exist, but we'll recreate it to be sure
DROP POLICY IF EXISTS "Users can update own inventory" ON inventory;
CREATE POLICY "Users can update own inventory" ON inventory FOR UPDATE USING (auth.uid() = user_id);
