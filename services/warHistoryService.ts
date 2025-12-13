
import { supabase } from '../lib/supabaseClient';
import { WarEvent, Branch, WarResult, SubParty } from '../types';

const getTableName = (branch: Branch) => {
  switch (branch) {
    case 'Inferno-2': return 'war_history_2';
    case 'Inferno-3': return 'war_history_3';
    case 'Inferno-1': 
    default: return 'war_history_1';
  }
};

const mapFromDB = (row: any, branch: Branch): WarEvent => {
  const result: WarResult = {
    outcome: row.outcome || 'Victory',
    opponent: row.opponent || '',
    ourScore: row.our_score || 0,
    enemyScore: row.enemy_score || 0,
  };

  return {
    id: `${branch}:${row.id}`,
    date: row.date,
    branch: branch,
    subParties: row.party_snapshot || [],
    groups: [], // Legacy field, not stored in history anymore
    result: result
  };
};

export const warHistoryService = {
  // --- FETCH ALL ---
  async getAll(): Promise<WarEvent[]> {
    if (!supabase) return [];

    const fetchTable = async (branch: Branch) => {
      const table = getTableName(branch);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        return [];
      }
      return (data || []).map(row => mapFromDB(row, branch));
    };

    const [h1, h2, h3] = await Promise.all([
      fetchTable('Inferno-1'),
      fetchTable('Inferno-2'),
      fetchTable('Inferno-3')
    ]);

    // Combine and sort by date descending
    return [...h1, ...h2, ...h3].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  // --- CREATE ---
  async create(branch: Branch, date: string, snapshotParties: SubParty[]): Promise<WarEvent> {
    const table = getTableName(branch);
    
    const payload = {
      date: date,
      party_snapshot: snapshotParties,
      opponent: '',
      outcome: 'Victory',
      our_score: 0,
      enemy_score: 0
    };

    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return mapFromDB(data, branch);
  },

  // --- UPDATE RESULT ---
  async updateResult(compositeId: string, result: WarResult): Promise<void> {
    const parts = compositeId.split(':');
    const branch = (parts.length === 2 && parts[0].startsWith('Inferno')) ? parts[0] as Branch : 'Inferno-1';
    const dbId = parseInt(parts[1], 10);
    const table = getTableName(branch);

    const payload = {
      opponent: result.opponent,
      outcome: result.outcome,
      our_score: result.ourScore,
      enemy_score: result.enemyScore
    };

    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', dbId);

    if (error) throw error;
  },

  // --- DELETE ---
  async delete(compositeId: string): Promise<void> {
    const parts = compositeId.split(':');
    const branch = (parts.length === 2 && parts[0].startsWith('Inferno')) ? parts[0] as Branch : 'Inferno-1';
    const dbId = parseInt(parts[1], 10);
    const table = getTableName(branch);

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', dbId);

    if (error) throw error;
  }
};
