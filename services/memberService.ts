
import { supabase } from '../lib/supabaseClient';
import { Member, CharacterClass, Branch } from '../types';
import { CLASS_CONFIG, CLASSES } from '../constants';

// Helper to map DB Thai class names to App English keys
const mapClassFromDB = (dbClass: string): CharacterClass => {
  if (!dbClass) return 'Ironclan';
  
  const normalized = dbClass.trim();
  
  // 1. Try to find match in Thai names from constants
  const foundKey = CLASSES.find(key => CLASS_CONFIG[key].th === normalized);
  if (foundKey) return foundKey;

  // 2. Try English match
  const foundKeyEn = CLASSES.find(key => CLASS_CONFIG[key].en.toLowerCase() === normalized.toLowerCase());
  if (foundKeyEn) return foundKeyEn;

  // 3. Fallback logic for variations
  if (normalized.includes('บลัด')) return 'Bloodstorm';
  if (normalized.includes('ไอรอน')) return 'Ironclan';
  if (normalized.includes('เซเลส')) return 'Celestune';
  if (normalized.includes('ซิล')) return 'Sylph';
  if (normalized.includes('นูมิ')) return 'Numina';
  if (normalized.includes('ไนท์')) return 'Nightwalker';

  return 'Ironclan'; // Default
};

// Helper to map App English keys to DB Thai names (for writing)
const mapToDB = (member: Partial<Member>) => {
  return {
    name: member.name,
    class: member.class ? CLASS_CONFIG[member.class].en : undefined,
    power: member.power,
    // Note: Party is usually updated via dedicated function, but we can map it if it exists
    party: member.party,
    party_2: member.party2
  };
};

// Helper to determine table name from branch
const getTableName = (branch: string): string => {
  switch (branch) {
    case 'Inferno-2': return 'member_2';
    case 'Inferno-3': return 'member_3';
    case 'Inferno-1': 
    default: return 'member_1';
  }
};

// Helper to parse composite ID "Branch:RealID" -> { branch, id }
const parseCompositeId = (compositeId: string) => {
  const parts = compositeId.split(':');
  if (parts.length === 2) {
    return { branch: parts[0] as Branch, id: parts[1] };
  }
  // Fallback for old/import IDs that might not have prefix
  return { branch: 'Inferno-1' as Branch, id: compositeId };
};


// Helper to map DB columns to App types
const mapFromDB = (row: any, branch: Branch): Member => ({
  id: `${branch}:${row.id}`, 
  name: row.name || 'Unknown',
  class: mapClassFromDB(row.class),
  power: row.power || 0,
  branch: branch,
  status: 'Active',
  joinDate: new Date().toISOString().split('T')[0],
  leaveCount: 0,
  warLeaveCount: 0,
  generalLeaveCount: 0,
  party: row.party || null, // 20:00
  party2: row.party_2 || null, // 20:30
  posParty: row.pos_party ?? null,
  posParty2: row.pos_party_2 ?? null,
});

export const memberService = {
  
  // --- FETCH ALL ---
  async getAll(): Promise<Member[]> {
    if (!supabase) throw new Error("ไม่พบการตั้งค่าฐานข้อมูล");

    console.log("Fetching from all member tables...");

    try {
      const [res1, res2, res3] = await Promise.all([
        supabase.from('member_1').select('*').order('power', { ascending: false }),
        supabase.from('member_2').select('*').order('power', { ascending: false }),
        supabase.from('member_3').select('*').order('power', { ascending: false })
      ]);

      const members1 = (res1.data || []).map(row => mapFromDB(row, 'Inferno-1'));
      const members2 = (res2.data || []).map(row => mapFromDB(row, 'Inferno-2'));
      const members3 = (res3.data || []).map(row => mapFromDB(row, 'Inferno-3'));

      const allMembers = [...members1, ...members2, ...members3];
      
      return allMembers;
    } catch (error) {
      console.error("Supabase Error:", error);
      throw error;
    }
  },

  // --- CREATE ---
  async create(member: Member): Promise<Member> {
    if (!supabase) throw new Error("ไม่ได้เชื่อมต่อฐานข้อมูล");

    const tableName = getTableName(member.branch);
    const payload = mapToDB(member);

    const { data, error } = await supabase
      .from(tableName)
      .insert([payload])
      .select()
      .single();
      
    if (error) throw error;
    return mapFromDB(data, member.branch);
  },

  // --- UPDATE ---
  async update(member: Member): Promise<Member> {
    if (!supabase) throw new Error("ไม่ได้เชื่อมต่อฐานข้อมูล");

    const { branch, id: dbId } = parseCompositeId(member.id);
    const tableName = getTableName(branch); 

    const payload = mapToDB(member);

    const { data, error } = await supabase
      .from(tableName)
      .update(payload)
      .eq('id', dbId)
      .select()
      .single();
      
    if (error) throw error;
    return mapFromDB(data, branch);
  },

  // --- UPDATE PARTY ASSIGNMENT ---
  async updateParty(
  compositeId: string,
  partyId: number | null,
  timeSlot: '20:00' | '20:30',
  pos: number | null
): Promise<void> {
  const { branch, id: dbId } = parseCompositeId(compositeId);
  const tableName = getTableName(branch);

  const partyCol = timeSlot === '20:30' ? 'party_2' : 'party';
  const posCol   = timeSlot === '20:30' ? 'pos_party_2' : 'pos_party';

  const { error } = await supabase
    .from(tableName)
    .update({
      [partyCol]: partyId,
      [posCol]: pos
    })
    .eq('id', dbId);

  if (error) throw error;
}
,

  // --- DELETE ---
  async delete(compositeId: string): Promise<void> {
    if (!supabase) throw new Error("ไม่ได้เชื่อมต่อฐานข้อมูล");

    const { branch, id: dbId } = parseCompositeId(compositeId);
    const tableName = getTableName(branch);

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', dbId);
      
    if (error) throw error;
  },
  async bulkUpsertByName(members: Member[]): Promise<void> {
  if (!supabase) throw new Error("ไม่ได้เชื่อมต่อฐานข้อมูล");

  const grouped: Record<string, Member[]> = {};
  members.forEach(m => {
    grouped[m.branch] = grouped[m.branch] || [];
    grouped[m.branch].push(m);
  });

  for (const branch of Object.keys(grouped)) {
    const table = getTableName(branch);

    const { data: existing, error } = await supabase
      .from(table)
      .select('id, name');

    if (error) throw error;

    const map = new Map<string, number>();
    existing?.forEach((r: any) =>
      map.set(r.name.toLowerCase(), r.id)
    );

    for (const m of grouped[branch]) {
      const payload = mapToDB(m);
      const foundId = map.get(m.name.toLowerCase());

      if (foundId) {
        await supabase
          .from(table)
          .update(payload)
          .eq('id', foundId);
      } else {
        await supabase
          .from(table)
          .insert(payload);
      }
    }
  }
},async replaceByBranches(members: Member[]): Promise<void> {
  if (!supabase) throw new Error("ไม่ได้เชื่อมต่อฐานข้อมูล");

  // group by branch
  const grouped: Record<string, Member[]> = {};
  members.forEach(m => {
    grouped[m.branch] = grouped[m.branch] || [];
    grouped[m.branch].push(m);
  });

  const branches: Branch[] = ['Inferno-1', 'Inferno-2', 'Inferno-3'];

  for (const branch of branches) {
    const list = grouped[branch] || [];

    // ✅ ถ้าไม่มีข้อมูลในชีตนั้น -> ไม่ลบ ไม่ insert
    if (list.length === 0) continue;

    const table = getTableName(branch);

    // 1) delete all rows in that branch table
    // Supabase ต้องมี filter เสมอ: ใช้ gt('id', 0) เป็นการลบทั้งหมดที่ id > 0
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .gt('id', 0);

    if (delErr) throw delErr;

    // 2) insert new rows
    const payloads = list.map(m => mapToDB(m)); // mapToDB เดิมของคุณใช้ได้

    const { error: insErr } = await supabase
      .from(table)
      .insert(payloads);

    if (insErr) throw insErr;
  }
}
};
