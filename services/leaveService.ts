
import { supabase } from '../lib/supabaseClient';
import { LeaveRequest, Branch } from '../types';

const getTableName = (branch: string) => {
  if (branch === 'Inferno-2') return 'leave_2';
  if (branch === 'Inferno-3') return 'leave_3';
  return 'leave_1';
};

const getMemberColumn = (branch: string) => {
  if (branch === 'Inferno-2') return 'member_2';
  if (branch === 'Inferno-3') return 'member_3';
  return 'member_1';
};

// Helper to parse composite member ID
const parseMemberId = (compositeId: string): number => {
  if (!compositeId) return 0;
  
  // Case 1: Standard DB ID "Inferno-1:123"
  if (compositeId.includes(':')) {
     const parts = compositeId.split(':');
     return parseInt(parts[1], 10);
  }
  
  // Case 2: Imported ID "imp-Inferno-1-123"
  if (compositeId.startsWith('imp-')) {
     const parts = compositeId.split('-');
     const lastPart = parts[parts.length - 1];
     return parseInt(lastPart, 10);
  }

  // Case 3: Raw ID string "123"
  return parseInt(compositeId, 10);
};

export const leaveService = {
  async getAll(): Promise<LeaveRequest[]> {
    if (!supabase) return [];

    const fetchTable = async (branch: Branch) => {
      const table = getTableName(branch);
      const memberCol = getMemberColumn(branch);
      
      const { data, error } = await supabase
        .from(table)
        .select(`id, date_time, ${memberCol}`);

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: `${branch}:${row.id}`, // Composite ID for Leave
        memberId: `${branch}:${row[memberCol]}`, // Reconstruct Composite Member ID
        warDate: row.date_time ? row.date_time.split('T')[0] : '',
        reason: '', // DB schema doesn't have reason
        timestamp: row.date_time || new Date().toISOString(),
        recordedBy: 'System'
      }));
    };

    const [l1, l2, l3] = await Promise.all([
      fetchTable('Inferno-1'),
      fetchTable('Inferno-2'),
      fetchTable('Inferno-3')
    ]);

    return [...l1, ...l2, ...l3];
  },

  async create(memberId: string, branch: Branch, warDate: string): Promise<LeaveRequest> {
    const table = getTableName(branch);
    const memberCol = getMemberColumn(branch);
    const dbMemberId = parseMemberId(memberId);

    if (isNaN(dbMemberId)) {
        throw new Error("Invalid Member ID for Leave Request");
    }

    // Prepare payload
    const payload = {
      date_time: warDate,
      [memberCol]: dbMemberId
    };

    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return {
      id: `${branch}:${data.id}`,
      memberId: memberId,
      warDate: data.date_time ? data.date_time.split('T')[0] : warDate,
      reason: '',
      timestamp: data.date_time || new Date().toISOString(),
      recordedBy: 'System'
    };
  },

  async delete(compositeId: string): Promise<void> {
    const parts = compositeId.split(':');
    
    // Determine branch and raw DB ID
    const branch = (parts.length === 2 && parts[0].startsWith('Inferno')) 
      ? parts[0] as Branch 
      : 'Inferno-1';
      
    const rawId = parts.length === 2 ? parts[1] : compositeId;
    
    // Ensure DB ID is an integer
    const dbId = parseInt(rawId, 10);

    const table = getTableName(branch);

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', dbId);

    if (error) throw error;
  }
};
