
import { Member, LeaveRequest, WarEvent, SubParty, CharacterClass, GameEvent, WarPlan } from './types';

export const BRANCHES = ['Inferno-1', 'Inferno-2', 'Inferno-3'] as const;

export const CLASSES: CharacterClass[] = [
  'Ironclan', 'Bloodstorm', 'Celestune', 'Sylph', 'Numina', 'Nightwalker'
];

export const CLASS_CONFIG: Record<CharacterClass, { display: string; en: string; th: string }> = {
  Ironclan: { display: 'Ironclan', en: 'Ironclan', th: 'ไอรอนแคลด' },
  Bloodstorm: { display: 'Bloodstorm', en: 'Bloodstorm', th: 'บลัดสตรอม' },
  Celestune: { display: 'Celestune', en: 'Celestune', th: 'เซเลสทูน' },
  Sylph: { display: 'Sylph', en: 'Sylph', th: 'ซิลฟ์' },
  Numina: { display: 'Numina', en: 'Numina', th: 'นูมินา' },
  Nightwalker: { display: 'Nightwalker', en: 'Nightwalker', th: 'ไนท์เวคเกอร์' }
};

export const GROUP_COLORS = [
  { name: 'เทา', bg: 'bg-zinc-100', text: 'text-zinc-800', border: 'border-zinc-200' },
  { name: 'แดง', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  { name: 'ฟ้า', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { name: 'เขียว', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  { name: 'เหลือง', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  { name: 'ม่วง', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  { name: 'ฟ้าคราม', bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'l1', memberId: 'm-2', warDate: '2023-11-04', reason: 'ธุระครอบครัว', timestamp: '2023-11-01T10:00:00Z', recordedBy: 'Admin' },
  { id: 'l2', memberId: 'm-5', warDate: '2023-11-04', reason: 'ทำงานล่วงเวลา', timestamp: '2023-11-02T14:30:00Z', recordedBy: 'Admin' },
];

export const MOCK_GAME_EVENTS: GameEvent[] = [
  { id: 'e1', title: 'ประชุมเจ้าหน้าที่', date: '2023-11-05', type: 'Meeting' },
  { id: 'e2', title: 'ล่าบอสโลก', date: '2023-11-12', type: 'Activity' },
];

export const MOCK_WAR_PLANS: WarPlan[] = [
  { 
    id: 'wp-1', 
    name: 'แผนบุกมาตรฐาน A', 
    images: ['https://img2.pic.in.th/pic/war-map-mockup.jpg'] 
  },
  { 
    id: 'wp-2', 
    name: 'แผนป้องกันโซน B', 
    images: ['https://placehold.co/800x600/1e293b/FFFFFF?text=Defense+Zone+B'] 
  },
  {
    id: 'wp-3',
    name: 'แผนตีโอบล้อม C',
    images: ['https://placehold.co/800x600/7f1d1d/FFFFFF?text=Flanking+Maneuver']
  }
];

// Initialize with 'Any' role to allow free placement
const createEmptySubParties = (): SubParty[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `ปาร์ตี้ ${i + 1}`,
    slots: Array(6).fill(null).map((_, idx) => ({ 
      role: 'Any', 
      memberId: null 
    }))
  }));
};

export const MOCK_WAR_HISTORY: WarEvent[] = [
  {
    id: 'w1',
    date: '2023-10-28',
    branch: 'Inferno-1',
    subParties: createEmptySubParties(),
    groups: [
      { id: 'g1', name: 'ทีมบุก A', subPartyIds: [1, 2, 3, 4], color: 'แดง' },
      { id: 'g2', name: 'ทีมป้องกัน B', subPartyIds: [5, 6], color: 'ฟ้า' }
    ],
    result: {
      outcome: 'Victory',
      opponent: 'Golden Lions',
      ourScore: 15000,
      enemyScore: 12400,
      // Fix: Removed 'notes' property as it does not exist in WarResult type
      warPlanId: 'wp-1'
    }
  }
];
