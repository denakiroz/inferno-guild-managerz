
import { supabase } from '../lib/supabaseClient';
import { Branch, PartyGroup } from '../types';

const getTableName = (branch: Branch) => {
  switch (branch) {
    case 'Inferno-2': return 'group_2';
    case 'Inferno-3': return 'group_3';
    case 'Inferno-1': 
    default: return 'group_1';
  }
};

export const groupService = {
  // --- FETCH ALL GROUPS FOR ALL BRANCHES ---
  async getAllByBranch(branch: Branch): Promise<PartyGroup[]> {
    if (!supabase) return [];
    
    const table = getTableName(branch);
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('order_by', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id.toString(),
      name: row.name,
      // Convert "1,3,7" string from DB to number array [1, 3, 7]
      subPartyIds: row.group ? row.group.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n)) : [],
      color: row.color,
      order_by: row.order_by || 0
    }));
  },

  // --- CREATE GROUP ---
  async create(branch: Branch, group: Omit<PartyGroup, 'id'>): Promise<PartyGroup> {
    const table = getTableName(branch);
    
    // Convert array [1, 3, 7] to string "1,3,7" for DB
    const groupString = group.subPartyIds.join(',');

    const payload = {
      name: group.name,
      color: group.color,
      group: groupString,
      order_by: group.order_by || 0
    };

    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id.toString(),
      name: data.name,
      subPartyIds: group.subPartyIds,
      color: data.color,
      order_by: data.order_by
    };
  },

  // --- UPDATE ORDER ---
  async updateOrder(branch: Branch, items: { id: string; order_by: number }[]): Promise<void> {
     const table = getTableName(branch);
     const updates = items.map(item => 
        supabase.from(table).update({ order_by: item.order_by }).eq('id', parseInt(item.id))
     );
     await Promise.all(updates);
  },

  // --- DELETE GROUP ---
  async delete(branch: Branch, groupId: string): Promise<void> {
    const table = getTableName(branch);
    
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', parseInt(groupId, 10));

    if (error) throw error;
  }
};
