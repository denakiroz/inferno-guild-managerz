
import { supabase } from '../lib/supabaseClient';
import { RegularWar, Branch } from '../types';

export const regularWarService = {
  // --- FETCH ALL ---
  async getAll(): Promise<RegularWar[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('regular_war_history')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error("Error fetching regular wars:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id.toString(),
      branch: row.branch as Branch,
      date: row.date,
      opponent: row.opponent,
      outcome: row.outcome,
      images: row.images || [] // Expecting JSONB array of strings
    }));
  },

  // --- CREATE ---
  async create(war: RegularWar): Promise<RegularWar> {
    if (!supabase) throw new Error("No database connection");

    // Prepare payload
    // Note: Storing Base64 images in JSONB is fine for small scale/prototypes.
    // For large scale, consider Supabase Storage Buckets.
    const payload = {
      branch: war.branch,
      date: war.date,
      opponent: war.opponent,
      outcome: war.outcome,
      images: war.images
    };

    const { data, error } = await supabase
      .from('regular_war_history')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id.toString(),
      branch: data.branch,
      date: data.date,
      opponent: data.opponent,
      outcome: data.outcome,
      images: data.images || []
    };
  },

  // --- DELETE ---
  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error("No database connection");

    const { error } = await supabase
      .from('regular_war_history')
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) throw error;
  }
};
