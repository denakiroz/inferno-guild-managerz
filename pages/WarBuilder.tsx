import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Member,
  Branch,
  SubParty,
  PartyGroup,
  CharacterClass,
  LeaveRequest,
  PartyGroupConfig,
  WarEvent,
  MemberColor
} from '../types';

import { Card, Button, Input, Select, Modal } from '../components/UI';
import { Icons, CLASS_DATA } from '../components/Icons';
import { BRANCHES, CLASSES, CLASS_CONFIG, GROUP_COLORS } from '../constants';
import { memberService } from '../services/memberService';
import { groupService } from '../services/groupService';

interface WarBuilderProps {
  members: Member[];
  leaveRequests: LeaveRequest[];
  onExport: (data: Partial<WarEvent>) => void;
  groupConfigs?: PartyGroupConfig[];
  onUpdateGroupConfig?: (branch: Branch, groups: PartyGroup[]) => void;
  onReloadMembers: () => Promise<void>;
}

// Helper to create initial 10 parties
const createInitialParties = (): SubParty[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `ปาร์ตี้ ${i + 1}`,
    slots: Array(6)
      .fill(null)
      .map(() => ({
        role: 'Any',
        memberId: null
      }))
  }));
};

type DragItem =
  | { type: 'SLOT'; partyId: number; index: number; memberId: string }
  | { type: 'ROSTER'; memberId: string };

type DragTarget = { partyId: number; index: number } | null;

type WarTime = '20:00' | '20:30';
type VisualMode = 'main' | 'temp';

interface PartyCardProps {
  party: SubParty;
  onSlotClick: (partyId: number, slotIndex: number) => void;
  members: Member[];
  selectedMemberIds: Set<string>;
  onToggleSelectMember: (memberId: string) => void;

  onDragStart: (e: React.DragEvent, item: DragItem) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, partyId: number, slotIndex: number) => void;
  onDrop: (e: React.DragEvent, partyId: number, slotIndex: number) => void;
  dragOverTarget: DragTarget;

  getNameColorClass: (c?: MemberColor | null) => string;
  onRemoveFromParty: (partyId: number, slotIndex: number) => void;

  /** ✅ เพิ่มสำหรับสีหัวการ์ดตามกลุ่ม */
  headerStyle?: string;
  groupName?: string;

  /** ✅ โหมดชั่วคราว/ปกติ + เงื่อนไข “จัดเข้าได้ไหม” */
  isTempMode: boolean;
  canPlaceMemberId: (memberId: string) => boolean;
  warLeaveSet: Set<string>;   
}

export const PartyCard: React.FC<PartyCardProps> = ({
  party,
  members,
  selectedMemberIds,
  onToggleSelectMember,
  onSlotClick,
  onRemoveFromParty,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragOverTarget,
  getNameColorClass,
  headerStyle,
  groupName,
  isTempMode,
  canPlaceMemberId,
  warLeaveSet
}) => {
  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      {/* ✅ หัวการ์ด: สีไม่หาย + รองรับชื่อกลุ่ม */}
      <div className={`px-3 py-2 font-bold text-sm ${headerStyle ?? 'bg-zinc-100 text-zinc-800'}`}>
        <div className="flex items-center justify-between">
          <span className="truncate">{party.name}</span>
          {groupName ? <span className="text-xs opacity-90 truncate ml-2">{groupName}</span> : null}
        </div>
      </div>

      <div className="p-2 space-y-1">
        {party.slots.map((slot, idx) => {
          const member = slot.memberId ? members.find(m => m.id === slot.memberId) : null;
          const isWarLeave = !!member && warLeaveSet.has(member.id);

          const isSelected = !!member && selectedMemberIds.has(member.id);
          const isDragTarget = dragOverTarget?.partyId === party.id && dragOverTarget?.index === idx;

          const memberMovable = member ? canPlaceMemberId(member.id) : true;

          return (
            <div
              key={idx}
              draggable={!!member && memberMovable}
              onDragStart={e => {
                if (!member) return;
                if (!memberMovable) return; // ✅ กันลากคนที่ “ห้ามจัด” ในโหมดนั้น
                onDragStart(e, {
                  type: 'SLOT',
                  partyId: party.id,
                  index: idx,
                  memberId: member.id
                });
              }}
              onDragEnd={onDragEnd}
              className={`
                flex items-center h-[42px] px-2 rounded border select-none
                ${member ? (memberMovable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-75') : ''}
                ${isDragTarget ? 'ring-2 ring-red-300 bg-red-50' : 'border-zinc-100'}
                ${isSelected ? 'bg-red-50 border-red-300' : 'bg-white'}
                ${isWarLeave ? 'bg-red-200 border-red-500 ring-2 ring-red-300 shadow-sm' : ''}
              `}
              onDragOver={e => onDragOver(e, party.id, idx)}
              onDrop={e => onDrop(e, party.id, idx)}
            >
              {member ? (
                <>
                  <div className="w-7 h-7 rounded-full mr-2 border flex-shrink-0 overflow-hidden">
                    <img src={CLASS_DATA[member.class].img} className="w-full h-full rounded-full" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      {/* ✅ เลือกสมาชิกในปาร์ตี้เพื่อใส่สีได้ */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onToggleSelectMember(member.id);
                        }}
                        className="flex-1 text-left min-w-0"
                        title="คลิกเพื่อเลือก/ยกเลิกเลือก (สำหรับใส่สี)"
                      >
                        <span className={`text-xs font-bold truncate block ${getNameColorClass(member.color)}`}>
                          {member.name}
                        </span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation();
                          onRemoveFromParty(party.id, idx);
                        }}
                        className="w-6 h-6 rounded border bg-white text-zinc-500 hover:text-red-600 hover:bg-zinc-100"
                        title="ถอดออกจากปาร์ตี้"
                      >
                        ×
                      </button>
                    </div>

                    <div className="text-[10px] text-zinc-400 font-mono">{member.power.toLocaleString()}</div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onSlotClick(party.id, idx)}
                  className="w-full h-full text-[10px] font-bold text-zinc-300 uppercase"
                >
                  ว่าง
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ✅ hint โหมดชั่วคราว (optional) */}
      {isTempMode ? <div className="px-3 pb-2 text-[10px] text-amber-700">โหมดชั่วคราว: ห้ามจัด “ลากิจ”</div> : null}
    </div>
  );
};

export const WarBuilder: React.FC<WarBuilderProps> = ({
  members,
  leaveRequests,
  onExport,
  groupConfigs = [],
  onUpdateGroupConfig,
  onReloadMembers
}) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch>('Inferno-1');
  const [warTime, setWarTime] = useState<WarTime>('20:00');

  const getNameColorClass = (c?: MemberColor | null) => {
    if (c === 'red') return 'text-red-600';
    if (c === 'purple') return 'text-purple-600';
    if (c === 'blue') return 'text-blue-600';
    return 'text-zinc-800';
  };

  const getNameColorHex = (c?: MemberColor | null) => {
    if (c === 'red') return '#dc2626';
    if (c === 'purple') return '#7c3aed';
    if (c === 'blue') return '#2563eb';
    return '#111827';
  };

  const isSpecialMember = (m: Member) => !!(m as any).isSpecial;

  // สมาชิกที่อนุญาตให้ใช้ในหน้าจัดทัพนี้เท่านั้น
  const visibleMembers = useMemo(
    () => members.filter(m => !isSpecialMember(m)),
    [members]
  );

  useEffect(() => {
    const specialIds = new Set(
      members.filter(m => (m as any).isSpecial).map(m => m.id)
    );

    if (specialIds.size === 0) return;

    // ดีดออกจากปาร์ตี้
    setSubParties(prev =>
      prev.map(p => ({
        ...p,
        slots: p.slots.map(s =>
          s.memberId && specialIds.has(s.memberId)
            ? { ...s, memberId: null }
            : s
        )
      }))
    );

    // ยกเลิกการเลือก
    setSelectedMemberIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (!specialIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [members]);

  // ----- Thai Time Helpers (UTC+7) -----
  const getThaiDate = () => {
    const d = new Date();
    return new Date(d.getTime() + 7 * 60 * 60 * 1000);
  };

  const toISOStringDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => toISOStringDate(getThaiDate()), []);
  const isTodaySaturday = useMemo(() => getThaiDate().getUTCDay() === 6, []);

  // ✅ warDate = “เสาร์ที่ใกล้ที่สุด” (เหมือนเดิม)
  const [warDate] = useState(() => {
    const d = getThaiDate();
    const day = d.getUTCDay();
    const daysToAdd = (6 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    return toISOStringDate(d);
  });

  // ----- Leave Sets -----
  // ลาวอ = warDate (เสาร์)
  const warLeaveSet = useMemo(() => {
    return new Set(leaveRequests.filter(r => r.warDate === warDate).map(r => r.memberId));
  }, [leaveRequests, warDate]);

  // ลากิจ = todayStr (และไม่ใช่ warDate)
  const personalLeaveSet = useMemo(() => {
    return new Set(leaveRequests.filter(r => r.warDate === todayStr && r.warDate !== warDate).map(r => r.memberId));
  }, [leaveRequests, todayStr, warDate]);

  const [filterClass, setFilterClass] = useState<CharacterClass | 'All'>('All');

  // ✅ Clear tool: เลือกอาชีพเพื่อเคลียร์คนออกจากปาร์ตี้กลับเข้า roster
  const [clearClass, setClearClass] = useState<CharacterClass | 'All'>('All');

  // Builder State
  const [subParties, setSubParties] = useState<SubParty[]>(createInitialParties());
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // ✅ initial snapshot (ล่าสุดจาก DB) สำหรับปุ่ม "คืนค่า"
  const initialSnapshotRef = useRef<SubParty[]>(createInitialParties());

  // ✅ โหมดชั่วคราว
  const [isTempMode, setIsTempMode] = useState(false);
  const [tempSourceTime, setTempSourceTime] = useState<WarTime>('20:00');

  // Multi-select (รองรับเลือกจาก roster + จากปาร์ตี้)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const toggleSelectedMember = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelectedMembers = () => setSelectedMemberIds(new Set());

  // --- Auto Scroll while dragging ---
  const rosterScrollRef = useRef<HTMLDivElement | null>(null);
  const partyScrollRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const maybeAutoScroll = useCallback(
    (container: HTMLElement | null, clientY: number) => {
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const threshold = 80;
      const maxSpeed = 18;

      let delta = 0;

      if (clientY < rect.top + threshold) {
        const intensity = Math.min(1, (rect.top + threshold - clientY) / threshold);
        delta = -Math.ceil(maxSpeed * intensity);
      } else if (clientY > rect.bottom - threshold) {
        const intensity = Math.min(1, (clientY - (rect.bottom - threshold)) / threshold);
        delta = Math.ceil(maxSpeed * intensity);
      }

      if (delta !== 0) {
        container.scrollBy({ top: delta, behavior: 'auto' });
        stopAutoScroll();
        rafRef.current = requestAnimationFrame(() => {
          maybeAutoScroll(container, clientY);
        });
      } else {
        stopAutoScroll();
      }
    },
    [stopAutoScroll]
  );

  // Modal/Group State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [deleteGroupTargetId, setDeleteGroupTargetId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('เทา');
  const [selectedPartyIdsForGroup, setSelectedPartyIdsForGroup] = useState<number[]>([]);

  // Temp Copy Modal
  const [isTempCopyOpen, setIsTempCopyOpen] = useState(false);
  const [tempPickTime, setTempPickTime] = useState<WarTime>('20:00');

  // ✅ Copy Modal (คัดลอกข้ามช่วงเวลาอัตโนมัติ)
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const copyFromTime: WarTime = useMemo(() => (warTime === '20:00' ? '20:30' : '20:00'), [warTime]);

  // Drag State
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragTarget>(null);

  // ---------- Helpers ----------
  const cloneParties = (ps: SubParty[]) => ps.map(p => ({ ...p, slots: p.slots.map(s => ({ ...s })) }));

  const computePartiesFromMembers = useCallback(
    (time: WarTime, branch: Branch) => {
      const newParties = createInitialParties();
      const placed = new Set<string>();

      visibleMembers.forEach(m => {
        const partyId = time === '20:00' ? m.party : m.party2;
        const pos = time === '20:00' ? m.posParty : m.posParty2;

        if (m.branch !== branch) return;
        if (m.status !== 'Active') return;
        if (!partyId || partyId < 1 || partyId > 10) return;
        if (pos === null || pos === undefined) return;
        if (pos < 0 || pos > 5) return;
        if (placed.has(m.id)) return;

        const partyIdx = partyId - 1;
        if (newParties[partyIdx].slots[pos].memberId) return;

        newParties[partyIdx].slots[pos].memberId = m.id;
        placed.add(m.id);
      });

      return newParties;
    },
    [visibleMembers]
  );

  const activeBranchMembers = useCallback(() => {
    return visibleMembers.filter(
      m => m.branch === selectedBranch && m.status === 'Active'
    );
  }, [visibleMembers, selectedBranch]);


  /**
   * ✅ กฎการ “จัดเข้า/ย้าย/ลากเข้า” ตาม requirement ล่าสุด
   *
   * โหมดปกติ:
   *  - ห้ามจัดคน "ลาวอ" เสมอ
   *  - ลากิจ จัดได้
   *
   * โหมดชั่วคราว:
   *  - ห้ามจัดคน "ลากิจ" เสมอ
   *  - คน "ลาวอ" จัดได้ ยกเว้นวันเสาร์ (วันเสาร์ใช้ logic เดียวกับโหมดปกติ = ห้าม)
   */
  const canPlaceMemberId = useCallback(
    (memberId: string) => {
      const isWarLeave = warLeaveSet.has(memberId);
      const isPersonalLeave = personalLeaveSet.has(memberId);

      if (!isTempMode) {
        // normal
        if (isWarLeave) return false;
        return true;
      }

      // temp
      if (isPersonalLeave) return false;
      if (isWarLeave && isTodaySaturday) return false;
      return true;
    },
    [isTempMode, warLeaveSet, personalLeaveSet, isTodaySaturday]
  );

  // --- SYNC WITH DB (หลัก) ---
  useEffect(() => {
    // 1) load group config
    const savedConfig = groupConfigs.find(c => c.branch === selectedBranch);
    setGroups(savedConfig ? savedConfig.groups : []);

    // 2) build parties from DB mapping
    const computed = computePartiesFromMembers(warTime, selectedBranch);

    setSubParties(computed);
    initialSnapshotRef.current = cloneParties(computed);

    // reset temp mode เมื่อเปลี่ยน branch/time
    setIsTempMode(false);
    setTempSourceTime('20:00');
    setSelectedMemberIds(new Set());
  }, [selectedBranch, groupConfigs, warTime, computePartiesFromMembers]);

  const updateGroups = (newGroups: PartyGroup[]) => {
    setGroups(newGroups);
    if (onUpdateGroupConfig) onUpdateGroupConfig(selectedBranch, newGroups);
  };

  const assignedMemberIds = useMemo(() => {
    const s = new Set<string>();
    subParties.forEach(p => p.slots.forEach(sl => sl.memberId && s.add(sl.memberId)));
    return s;
  }, [subParties]);

  // Filter Members & Sort by Power Descending (Roster)
  const branchMembers = useMemo(() => {
    return visibleMembers
      .filter(m => {
        if (m.branch !== selectedBranch || m.status !== 'Active') return false;
        if (filterClass !== 'All' && m.class !== filterClass) return false;

        // ✅ NEW: เอาคนที่อยู่ในปาร์ตี้แล้วออกจาก roster
        if (assignedMemberIds.has(m.id)) return false;

        return true;
      })
      .sort((a, b) => b.power - a.power);
  }, [visibleMembers, selectedBranch, filterClass, assignedMemberIds]);

  const rosterMembers = useMemo(() => {
   return branchMembers.filter(m => !assignedMemberIds.has(m.id));
  }, [branchMembers, assignedMemberIds]);

  // ✅ เคลียร์สมาชิกออกจากปาร์ตี้ -> กลับเข้า roster (ตามอาชีพที่เลือก)
  const handleClearFromParties = useCallback(() => {
    // ทำงานกับ subParties บนหน้าปัจจุบันเท่านั้น (ตาม branch + warTime ที่เลือก)
    const next = subParties.map(p => ({ ...p, slots: p.slots.map(s => ({ ...s })) }));
    const removedIds: string[] = [];

    next.forEach(p => {
      p.slots.forEach((s, idx) => {
        if (!s.memberId) return;

        const mem = visibleMembers.find(m => m.id === s.memberId);
        if (!mem) return;

        if (clearClass !== 'All' && mem.class !== clearClass) return;

        removedIds.push(s.memberId);
        p.slots[idx] = { ...s, memberId: null };
      });
    });

    if (removedIds.length === 0) return;

    setSubParties(next);

    // กัน selected ค้าง
    setSelectedMemberIds(prev => {
      const ns = new Set(prev);
      removedIds.forEach(id => ns.delete(id));
      return ns;
    });

    // reset drag target
    setDragItem(null);
    setDragOverTarget(null);
  }, [subParties, visibleMembers, clearClass]);
  // --- Handlers ---
  const handleResetToInitial = () => {
    setSubParties(cloneParties(initialSnapshotRef.current));
    setIsTempMode(false);
    setTempSourceTime('20:00');
    setSelectedMemberIds(new Set());
    setDragItem(null);
    setDragOverTarget(null);
  };

  /**
   * ✅ apply copy (ข้ามช่วงเวลาอัตโนมัติ):
   *  - ถ้าอยู่ 20:00 -> คัดลอก 20:30
   *  - ถ้าอยู่ 20:30 -> คัดลอก 20:00
   *  - เป็น “คัดลอกปกติ” ไม่ใช่โหมดชั่วคราว
   */
  const handleApplyCopy = () => {
    const copied = computePartiesFromMembers(copyFromTime, selectedBranch);

    setSubParties(copied);
    setSelectedMemberIds(new Set());
    setDragItem(null);
    setDragOverTarget(null);

    setIsCopyOpen(false);
  };

  /**
   * ✅ apply temp copy:
   *  - คัดลอกจากอีกช่วงเวลา
   *  - “ดีดคนลากิจ (today)” ออกจากทีมทันที (เพราะโหมดชั่วคราวห้ามจัดลากิจ)
   */
  const handleApplyTempCopy = () => {
    const copied = computePartiesFromMembers(tempPickTime, selectedBranch);

    // remove personal leave from party slots in temp mode
    const cleaned = copied.map(p => ({
      ...p,
      slots: p.slots.map(s => (s.memberId && personalLeaveSet.has(s.memberId) ? { ...s, memberId: null } : s))
    }));

    setSubParties(cleaned);
    setIsTempMode(true);
    setTempSourceTime(tempPickTime);
    setIsTempCopyOpen(false);
    setSelectedMemberIds(new Set());
  };

  const handleSlotClick = (partyId: number, slotIndex: number) => {
    if (selectedMemberIds.size === 0) return;

    const pickId = Array.from(selectedMemberIds)[0];

    // ✅ กัน “เอาเข้า” หากผิดกฎโหมดนั้น
    if (!canPlaceMemberId(pickId)) return;

    const newParties = subParties.map(p => ({
      ...p,
      slots: p.slots.map(s => (s.memberId === pickId ? { ...s, memberId: null } : s))
    }));

    const targetParty = newParties.find(p => p.id === partyId);
    if (targetParty) {
      targetParty.slots[slotIndex] = { ...targetParty.slots[slotIndex], memberId: pickId };
    }

    setSubParties(newParties);

    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      next.delete(pickId);
      return next;
    });
  };

  const removeFromParty = (partyId: number, slotIndex: number) => {
    setSubParties(prev =>
      prev.map(p => {
        if (p.id !== partyId) return p;
        const newSlots = [...p.slots];
        newSlots[slotIndex] = { ...newSlots[slotIndex], memberId: null };
        return { ...p, slots: newSlots };
      })
    );
  };

  const handleCreateGroup = async () => {
    if (!newGroupName || selectedPartyIdsForGroup.length === 0) return;

    const sortedPartyIds = [...selectedPartyIdsForGroup].sort((a, b) => a - b);
    const maxOrder = groups.reduce((max, g) => Math.max(max, g.order_by || 0), 0);

    try {
      const createdGroup = await groupService.create(selectedBranch, {
        name: newGroupName,
        subPartyIds: sortedPartyIds,
        color: newGroupColor,
        order_by: maxOrder + 1
      });

      const updatedGroups = [...groups, createdGroup];
      updateGroups(updatedGroups);

      setIsGroupModalOpen(false);
      setNewGroupName('');
      setNewGroupColor('เทา');
      setSelectedPartyIdsForGroup([]);
    } catch (error: any) {
      console.error(error);
    }
  };

  const initiateDeleteGroup = (groupId: string) => setDeleteGroupTargetId(groupId);

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTargetId) return;

    try {
      await groupService.delete(selectedBranch, deleteGroupTargetId);
      const updatedGroups = groups.filter(g => g.id !== deleteGroupTargetId);
      updateGroups(updatedGroups);
      setDeleteGroupTargetId(null);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleMoveGroup = async (index: number, direction: 'up' | 'down') => {
    const sortedGroups = [...groups].sort((a, b) => (a.order_by || 0) - (b.order_by || 0));

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sortedGroups.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    [sortedGroups[index], sortedGroups[targetIndex]] = [sortedGroups[targetIndex], sortedGroups[index]];

    const updates = sortedGroups.map((g, idx) => ({ ...g, order_by: idx }));
    updateGroups(updates);

    try {
      await groupService.updateOrder(
        selectedBranch,
        updates.map(g => ({ id: g.id, order_by: g.order_by! }))
      );
    } catch (err) {
      console.error('Failed to reorder', err);
    }
  };

  // ✅ ใส่สีได้ทั้งจาก roster และจากปาร์ตี้ (เพราะเลือกจากปาร์ตี้ได้แล้ว)
  const handleSetNameColor = async (color: MemberColor | null) => {
    if (selectedMemberIds.size === 0) return;

    try {
      await memberService.updateColorMany(Array.from(selectedMemberIds), color);
      await onReloadMembers();
    } catch (e) {
      console.error(e);
    }
  };

  // --- Save Party Assignments to Database ---
  // ✅ ตามที่คุณขอ: โหมดชั่วคราว “ห้ามบันทึก”
  const handleSaveToDB = async () => {
    if (isTempMode) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      type AssignInfo = { party: number; pos: number };
      const assignmentMap = new Map<string, AssignInfo>();

      subParties.forEach(p => {
        p.slots.forEach((s, idx) => {
          if (s.memberId) assignmentMap.set(s.memberId, { party: p.id, pos: idx });
        });
      });

      const branchMembersList = members.filter(m => m.branch === selectedBranch);

      const promises = branchMembersList.map(m => {
        const info = assignmentMap.get(m.id);

        const newParty = info?.party ?? null;
        const newPos = info?.pos ?? null;

        const currentParty = warTime === '20:00' ? m.party : m.party2;
        const currentPos = warTime === '20:00' ? m.posParty : m.posParty2;

        if (currentParty !== newParty || currentPos !== newPos) {
          return memberService.updateParty(m.id, newParty, warTime, newPos);
        }
        return Promise.resolve();
      });

      await Promise.all(promises);

      await onReloadMembers();

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);

      // ✅ หลังเซฟ ถือว่าเป็น initial ใหม่
      initialSnapshotRef.current = cloneParties(subParties);
      setIsTempMode(false);
      setTempSourceTime('20:00');
    } catch (e: any) {
      console.error(e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Visualizer UI only (หน้าตาแบบเดิม: ทัพใหญ่ + 2 คอลัมน์ขวา) ---
 // --- Visualizer UI only (หน้าตาแบบ inferno-1 เสมอ: 10 ปาร์ตี้ = 5x2 + 2 คอลัมน์ขวา) ---
const buildVisualizerHtml = (mode: VisualMode) => {
  // ======= ✅ ใช้ logic ปัจจุบันของคุณทั้งหมด (คงไว้) =======
  const sortedGroups = [...groups].sort((a, b) => (a.order_by || 0) - (b.order_by || 0));

  const partyGroupMap = new Map<number, { name: string; colorConfig: any }>();
  sortedGroups.forEach(g => {
    const colorConfig = GROUP_COLORS.find(c => c.name === g.color) || GROUP_COLORS[0];
    g.subPartyIds.forEach(pid => partyGroupMap.set(pid, { name: g.name, colorConfig }));
  });

  // ✅ สร้าง orderedParties ให้ “ครบ 10” และ “เรียง 1..10” เสมอ
  let orderedParties: SubParty[] = [];
  const processedPartyIds = new Set<number>();

  if (sortedGroups.length > 0) {
    // มี group: เรียงตาม group ก่อน แล้วค่อยเติมที่เหลือ
    sortedGroups.forEach(group => {
      const sortedSubIds = [...group.subPartyIds].sort((a, b) => a - b);
      sortedSubIds.forEach(pid => {
        const party = subParties.find(p => p.id === pid);
        if (party && !processedPartyIds.has(pid)) {
          orderedParties.push(party);
          processedPartyIds.add(pid);
        }
      });
    });

    const remainingParties = subParties
      .filter(p => !processedPartyIds.has(p.id))
      .sort((a, b) => a.id - b.id);

    orderedParties.push(...remainingParties);
  } else {
    // ไม่มี group: เรียง 1..10 ตรง ๆ (เหมือน inferno-1)
    orderedParties = [...subParties].sort((a, b) => a.id - b.id);
  }

  // ✅ safety: ให้มี 10 ใบแน่นอน (ถ้า data ผิดพลาด/ขาด)
  if (orderedParties.length < 10) {
    const existing = new Set(orderedParties.map(p => p.id));
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        orderedParties.push({
          id: i,
          name: `ปาร์ตี้ ${i}`,
          slots: Array(6).fill(null).map(() => ({ role: 'Any', memberId: null }))
        });
      }
    }
    orderedParties = orderedParties.sort((a, b) => a.id - b.id).slice(0, 10);
  } else {
    orderedParties = orderedParties.slice(0, 10);
  }

  const assigned = new Set<string>();
  subParties.forEach(p => p.slots.forEach(s => s.memberId && assigned.add(s.memberId)));

  const allActive = activeBranchMembers();

  const leavePanelMembers =
    mode === 'temp'
      ? allActive.filter(m => personalLeaveSet.has(m.id))
      : allActive.filter(m => warLeaveSet.has(m.id));

  // ✅ ตัวสำรอง = active ที่ไม่ได้อยู่ในทีม และ "ไม่ติดสถานะคนลาตามโหมด"
  const reserveMembers = allActive.filter(
    m =>
      !assigned.has(m.id) &&
      !(
        mode === 'temp'
          ? personalLeaveSet.has(m.id)
          : warLeaveSet.has(m.id)
      )
  );

  const shouldHidePersonalInTemp = (m: Member) => mode === 'temp' && personalLeaveSet.has(m.id);

  // ======= ✅ Party Cards (คง logic ปัจจุบัน) =======
  const partiesHtml = orderedParties
    .map(party => {
      const groupInfo = partyGroupMap.get(party.id);

      let headerClass = 'bg-zinc-800 text-white border-zinc-900';
      if (groupInfo) {
        const c = groupInfo.colorConfig.bg as string;
        if (c.includes('red')) headerClass = 'bg-red-700 text-white border-red-800';
        else if (c.includes('blue')) headerClass = 'bg-blue-700 text-white border-blue-800';
        else if (c.includes('emerald')) headerClass = 'bg-emerald-700 text-white border-emerald-800';
        else if (c.includes('amber')) headerClass = 'bg-amber-600 text-white border-amber-700';
        else if (c.includes('purple')) headerClass = 'bg-purple-700 text-white border-purple-800';
        else if (c.includes('cyan')) headerClass = 'bg-cyan-700 text-white border-cyan-800';
      }

      // ✅ ไม่มี group ให้โชว์ชื่อปาร์ตี้เดิม (แต่อยู่ layout แบบ inferno-1)
      const headerTitle = groupInfo ? groupInfo.name : party.name;

      let slotsHtml = '';
      party.slots.forEach(slot => {
        const m = visibleMembers.find(mem => mem.id === slot.memberId);

        if (m && shouldHidePersonalInTemp(m)) {
          slotsHtml += `
            <div class="px-2 py-1.5 border-b border-zinc-100 last:border-0 bg-zinc-50/50 flex items-center justify-center h-[46px]">
              <span class="text-[10px] text-zinc-300 uppercase font-bold tracking-widest">ว่าง</span>
            </div>
          `;
          return;
        }

        if (m) {
          const classData = CLASS_DATA[m.class];
          const nameColorHex = getNameColorHex(m.color);
          const isWarLeave = warLeaveSet.has(m.id);

          slotsHtml += `
            <div class="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-100 last:border-0 ${
              isWarLeave ? 'bg-red-100' : 'bg-white'
            }">
              <div class="w-9 h-9 rounded-full border-2 overflow-hidden flex-shrink-0">
                <img src="${classData.img}" class="w-full h-full object-cover ${isWarLeave ? 'grayscale' : ''}">
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-base truncate" style="color: ${nameColorHex};">
                  ${m.name}
                  ${
                    isWarLeave
                      ? `<span style="margin-left:8px; font-size:11px; font-weight:800; color:#b91c1c; background:#fee2e2; padding:2px 6px; border-radius:6px; border:1px solid #fecaca;">ลาวอ</span>`
                      : ''
                  }
                </div>
                <div class="text-[11px] text-zinc-500 font-mono font-bold mt-0.5">
                  ${m.power.toLocaleString()} • ${CLASS_CONFIG[m.class].th}
                </div>
              </div>
            </div>
          `;
        } else {
          slotsHtml += `
            <div class="px-2 py-1.5 border-b border-zinc-100 last:border-0 bg-zinc-50/50 flex items-center justify-center h-[46px]">
              <span class="text-[10px] text-zinc-300 uppercase font-bold tracking-widest">ว่าง</span>
            </div>
          `;
        }
      });

      return `
        <div class="border border-zinc-300 rounded-xl overflow-hidden shadow-md bg-white flex flex-col">
          <div class="px-3 py-1 flex items-center justify-center ${headerClass} h-[46px]">
            <div class="text-center font-bold text-2xl tracking-tight truncate px-2 w-full" style="font-family:'Athiti',sans-serif;">
              ${headerTitle}
            </div>
          </div>
          <div class="bg-white flex flex-col">
            ${slotsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  // ======= ✅ Right panels (หน้าตาเดิม) =======
  const panelHtml = (title: string, mems: Member[], headerClass = 'bg-zinc-900 text-white') => {
    const items = mems
      .slice()
      .sort((a, b) => b.power - a.power)
      .map(m => {
        const classData = CLASS_DATA[m.class];
        const nameColorHex = getNameColorHex(m.color);
        return `
          <div class="flex items-center gap-3 px-3 py-2 border-b border-zinc-100 last:border-0 bg-white">
            <div class="w-9 h-9 rounded-full border-2 overflow-hidden flex-shrink-0">
              <img src="${classData.img}" class="w-full h-full object-cover">
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm truncate" style="color:${nameColorHex};">${m.name}</div>
              <div class="text-[11px] text-zinc-500 font-mono font-bold">
                ${m.power.toLocaleString()} • ${CLASS_CONFIG[m.class].th}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="border border-zinc-300 rounded-xl overflow-hidden shadow-md bg-white flex flex-col h-full">
        <div class="px-3 h-[46px] flex items-center justify-center ${headerClass} font-bold tracking-wide">
          ${title} [${mems.length}]
        </div>
        <div class="flex-1 overflow-hidden">
          ${items || `<div class="p-4 text-center text-zinc-400 font-bold">ไม่มี</div>`}
        </div>
      </div>
    `;
  };

  const pageTitle =
    mode === 'main'
      ? `แผนการจัดทัพ (${warTime.replace(':', '.')}) - ${selectedBranch}`
      : `จัดทัพชั่วคราว (คัดลอกจาก ${tempSourceTime.replace(':', '.')}) - ${selectedBranch}`;

  // ======= ✅ HTML: บังคับ 10 ปาร์ตี้ = 5x2 เสมอ (เหมือน inferno-1) =======
  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=1600, initial-scale=1.0" />
      <title>${pageTitle}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Athiti:wght@400;500;600;700&display=swap');
        body { font-family: 'Athiti', sans-serif; background-color: #f8fafc; }
      </style>
    </head>

    <!-- ✅ เปลี่ยนจาก overflow-hidden -> overflow-auto เพื่อไม่ “ตัดแถวล่าง” -->
    <body class="p-6 overflow-auto">
      <div class="grid grid-cols-3 items-center mb-6 border-b-2 border-zinc-800 pb-2">
        <div class="text-left">
          <div class="px-4 py-1.5 bg-white border border-zinc-300 rounded shadow-sm text-zinc-700 font-bold text-lg inline-block mr-2">
            วันที่: ${warDate}
          </div>
          <div class="px-4 py-1.5 bg-zinc-900 border border-zinc-900 rounded shadow-sm text-white font-bold text-lg inline-block">
            ${mode === 'main' ? `รอบเวลา: ${warTime.replace(':', '.')} น.` : '-'}
          </div>
        </div>
        <div class="text-center">
          <h1 class="text-5xl font-bold text-zinc-900 uppercase tracking-widest leading-none drop-shadow-sm">
            ${selectedBranch}
          </h1>
        </div>
        <div class="text-right">
          <span class="bg-red-700 text-white px-4 py-1.5 rounded text-sm font-bold uppercase tracking-wider shadow-md">
            Inferno Guild
          </span>
        </div>
      </div>

      <!-- ✅ main layout -->
      <div class="grid gap-4" style="grid-template-columns: 1fr 320px 320px;">
        <!-- ทัพใหญ่: บังคับ 5x2 เสมอ -->
        <div>
          <div
            class="grid gap-4"
            style="
              grid-template-columns: repeat(5, minmax(0, 1fr));
              grid-template-rows: repeat(2, minmax(0, 1fr));
            "
          >
            ${partiesHtml}
          </div>
        </div>

        <!-- คนลา -->
        <div style="height: calc(46px + 2 * (46px + 6 * 46px));">
          ${panelHtml(mode === 'temp' ? 'คนลากิจ' : 'คนลาวอ', leavePanelMembers, 'bg-zinc-900 text-white')}
        </div>

        <!-- สำรอง -->
        <div style="height: calc(46px + 2 * (46px + 6 * 46px));">
          ${panelHtml('สำรอง', reserveMembers, 'bg-zinc-900 text-white')}
        </div>
      </div>
    </body>
    </html>
  `;
};

  const openVisualizer = (mode: VisualMode) => {
    const fullHtml = buildVisualizerHtml(mode);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(fullHtml);
      newWindow.document.close();
    } else {
      console.warn('Pop-up blocked');
    }
  };

  // --- Drag & Drop Logic ---
  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    // ✅ กันลาก roster/slot ถ้าสมาชิก “ห้ามจัด” ในโหมดนั้น
    if (item.type === 'ROSTER') {
      if (!canPlaceMemberId(item.memberId)) return;
    } else if (item.type === 'SLOT') {
      if (!canPlaceMemberId(item.memberId)) return;
    }

    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverTarget(null);
    stopAutoScroll();
  };

  const handleDragOverSlot = (e: React.DragEvent, partyId: number, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    maybeAutoScroll(partyScrollRef.current, e.clientY);

    if (dragOverTarget?.partyId !== partyId || dragOverTarget?.index !== index) {
      setDragOverTarget({ partyId, index });
    }
  };

  const handleDropOnSlot = (e: React.DragEvent, targetPartyId: number, targetIndex: number) => {
    e.preventDefault();
    stopAutoScroll();
    if (!dragItem) return;

    const newParties = subParties.map(p => ({ ...p, slots: [...p.slots] }));
    const targetParty = newParties.find(p => p.id === targetPartyId);
    if (!targetParty) return;

    const targetSlotMemberId = targetParty.slots[targetIndex].memberId;

    if (dragItem.type === 'ROSTER') {
      if (!canPlaceMemberId(dragItem.memberId)) {
        setDragItem(null);
        setDragOverTarget(null);
        return;
      }

      // เอาออกจากที่เดิมก่อน (กันซ้ำ)
      newParties.forEach(p => {
        p.slots.forEach((s, idx) => {
          if (s.memberId === dragItem.memberId) {
            p.slots[idx] = { ...s, memberId: null };
          }
        });
      });

      // ทับได้
      targetParty.slots[targetIndex] = { ...targetParty.slots[targetIndex], memberId: dragItem.memberId };
    } else if (dragItem.type === 'SLOT') {
      if (!canPlaceMemberId(dragItem.memberId)) {
        setDragItem(null);
        setDragOverTarget(null);
        return;
      }

      const sourceParty = newParties.find(p => p.id === dragItem.partyId);
      if (sourceParty) {
        const sourceMemberId = sourceParty.slots[dragItem.index].memberId;

        if (targetSlotMemberId) {
          // swap (แต่ต้องเช็คปลายทางด้วย)
          if (!canPlaceMemberId(targetSlotMemberId)) {
            setDragItem(null);
            setDragOverTarget(null);
            return;
          }
          sourceParty.slots[dragItem.index] = { ...sourceParty.slots[dragItem.index], memberId: targetSlotMemberId };
          targetParty.slots[targetIndex] = { ...targetParty.slots[targetIndex], memberId: sourceMemberId };
        } else {
          sourceParty.slots[dragItem.index] = { ...sourceParty.slots[dragItem.index], memberId: null };
          targetParty.slots[targetIndex] = { ...targetParty.slots[targetIndex], memberId: sourceMemberId };
        }
      }
    }

    setSubParties(newParties);
    setDragItem(null);
    setDragOverTarget(null);
  };

  const handleDropOnRoster = (e: React.DragEvent) => {
    e.preventDefault();
    stopAutoScroll();
    if (!dragItem || dragItem.type !== 'SLOT') return;

    // ✅ ลากออก “ได้เสมอ” (ตามที่คุณต้องการ)
    setSubParties(prev =>
      prev.map(p => {
        if (p.id !== dragItem.partyId) return p;
        const newSlots = [...p.slots];
        newSlots[dragItem.index] = { ...newSlots[dragItem.index], memberId: null };
        return { ...p, slots: newSlots };
      })
    );

    setDragItem(null);
    setDragOverTarget(null);
  };

  const displayGroups = [...groups].sort((a, b) => (a.order_by || 0) - (b.order_by || 0));

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Top Bar */}
      <Card className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4 py-4 sticky top-0 z-20 shadow-sm border-zinc-200">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {/* Branch Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">เป้าหมาย</span>
            <Select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value as Branch)}
              className="w-40 border-none bg-zinc-100 font-bold text-zinc-700"
            >
              {BRANCHES.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>

          {/* Time Selector */}
          <div className="bg-zinc-100 p-1 rounded-lg flex items-center">
            <button
              onClick={() => setWarTime('20:00')}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                warTime === '20:00' ? 'bg-white text-red-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              20.00 น.
            </button>
            <button
              onClick={() => setWarTime('20:30')}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                warTime === '20:30' ? 'bg-white text-red-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              20.30 น.
            </button>
          </div>

          {/* ✅ Temp mode badge */}
          {isTempMode && (
            <span className="text-xs font-bold px-2 py-1 rounded border bg-amber-50 text-amber-700 border-amber-200">
              โหมดชั่วคราว (คัดลอก {tempSourceTime.replace(':', '.')}) • ห้ามจัด “ลากิจ”
            </span>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end flex-wrap">
          <Button variant="ghost" onClick={() => setIsGroupModalOpen(true)}>
            <Icons.Users className="w-4 h-4 mr-2" /> จัดการกลุ่ม
          </Button>

          {/* ✅ ปุ่มคืนค่า */}
          <Button variant="secondary" onClick={handleResetToInitial} className="bg-white border border-zinc-200 hover:bg-zinc-50">
            <Icons.Redo className="w-4 h-4 mr-2" /> คืนค่า
          </Button>

          {/* ✅ ปุ่มคัดลอก (อัตโนมัติข้ามเวลา 20.00 ↔ 20.30) */}
          <Button
            variant="secondary"
            onClick={() => setIsCopyOpen(true)}
            className="bg-white border border-zinc-200 hover:bg-zinc-50"
            disabled={isTempMode}
            title={isTempMode ? 'โหมดชั่วคราว: ปิดการคัดลอกแบบปกติ' : undefined}
          >
            <Icons.ClipboardCopy className="w-4 h-4 mr-2" /> คัดลอก
          </Button>

          {/* ✅ ปุ่มจัดทัพชั่วคราว */}
          <Button
            variant="secondary"
            onClick={() => {
              setTempPickTime(warTime);
              setIsTempCopyOpen(true);
            }}
            className="bg-white border border-zinc-200 hover:bg-zinc-50"
          >
            <Icons.ClipboardCopy className="w-4 h-4 mr-2" /> จัดทัพชั่วคราว
          </Button>

          {/* ✅ Save: โหมดชั่วคราว “disable” */}
          <Button
            onClick={handleSaveToDB}
            variant={saveStatus === 'success' ? 'primary' : saveStatus === 'error' ? 'danger' : 'secondary'}
            className={`transition-all ${
              saveStatus === 'success'
                ? 'bg-green-600 hover:bg-green-700'
                : saveStatus === 'error'
                ? ''
                : 'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 shadow-sm'
            }`}
            disabled={isSaving || isTempMode}
            title={isTempMode ? 'โหมดชั่วคราว: ยังไม่อนุญาตให้บันทึก' : undefined}
          >
            {isSaving ? (
              <>
                <div className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin mr-2"></div>
                กำลังบันทึก...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <Icons.CheckCircle className="w-4 h-4 mr-2" /> บันทึกสำเร็จ
              </>
            ) : saveStatus === 'error' ? (
              <>
                <Icons.Alert className="w-4 h-4 mr-2" /> บันทึกไม่สำเร็จ
              </>
            ) : (
              <>
                <Icons.CheckCircle className="w-4 h-4 mr-2" /> บันทึก
              </>
            )}
          </Button>

          {/* ✅ Visual ปกติ: ทั่วไป | คนลาวอ | สำรอง */}
          <Button
            onClick={() => openVisualizer('main')}
            variant="primary"
            className="bg-red-700 text-white hover:bg-red-800 border-none shadow-md"
            disabled={isTempMode}
            title={isTempMode ? 'โหมดชั่วคราว: ปิดผังปกติ' : undefined}
          >
            <Icons.Image className="w-4 h-4 mr-2" /> แสดงผังจัดทัพ (Visual)
          </Button>

          {/* ✅ Visual ชั่วคราว: ทั่วไป | คนลากิจ | สำรอง */}
          {isTempMode && (
            <Button
              onClick={() => openVisualizer('temp')}
              variant="secondary"
              className="bg-amber-600 text-white hover:bg-amber-700 border-none shadow-md"
            >
              <Icons.Image className="w-4 h-4 mr-2" /> แสดงผังจัดทัพ (ชั่วคราว)
            </Button>
          )}
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
        {/* Left: Member Roster */}
        <div
          className="w-full lg:w-72 flex flex-col bg-white border border-zinc-100 rounded-lg shadow-sm lg:h-full h-64 flex-shrink-0 transition-colors"
          onDragOver={e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            maybeAutoScroll(rosterScrollRef.current, e.clientY);
          }}
          onDrop={handleDropOnRoster}
        >
          <div className="p-4 border-b border-zinc-50">
                       {/* ✅ Clear tool */}
            <div className="mt-3 p-3 bg-zinc-50 rounded border border-zinc-200">
              <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2">เคลียร์สมาชิกออกจากปาร์ตี้</div>
              <div className="flex items-center gap-2">
                <Select
                  value={clearClass}
                  onChange={e => setClearClass(e.target.value as any)}
                  className="flex-1 text-xs font-bold"
                >
                  <option value="All">ทุกอาชีพ</option>
                  {CLASSES.map(cls => (
                    <option key={cls} value={cls}>
                      {CLASS_CONFIG[cls].th}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="secondary"
                  onClick={handleClearFromParties}
                  className="h-8 px-3 bg-white border border-zinc-200 hover:bg-zinc-100"
                >
                  เคลียร์
                </Button>
              </div>
            </div>
            
            <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-wider mb-3">
              สมาชิก ({warTime.replace(':', '.')})
            </h3>

            {/* Mark Color Toolbar */}
            <div className="mb-3">

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedMemberIds.size === 0}
                  onClick={() => handleSetNameColor('red')}
                  className={`w-6 h-6 rounded-full border bg-red-500 border-red-600 ${
                    selectedMemberIds.size === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 transition'
                  }`}
                  title="แดง"
                />
                <button
                  type="button"
                  disabled={selectedMemberIds.size === 0}
                  onClick={() => handleSetNameColor('purple')}
                  className={`w-6 h-6 rounded-full border bg-purple-500 border-purple-600 ${
                    selectedMemberIds.size === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 transition'
                  }`}
                  title="ม่วง"
                />
                <button
                  type="button"
                  disabled={selectedMemberIds.size === 0}
                  onClick={() => handleSetNameColor('blue')}
                  className={`w-6 h-6 rounded-full border bg-blue-500 border-blue-600 ${
                    selectedMemberIds.size === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 transition'
                  }`}
                  title="น้ำเงิน"
                />
                <button
                  type="button"
                  disabled={selectedMemberIds.size === 0}
                  onClick={() => handleSetNameColor(null)}
                  className={`h-6 px-2 rounded border text-[10px] font-bold bg-white ${
                    selectedMemberIds.size === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-zinc-100'
                  }`}
                  title="ล้างสี"
                >
                  ล้างสี
                </button>
                <button
                  type="button"
                  disabled={selectedMemberIds.size === 0}
                  onClick={clearSelectedMembers}
                  className={`h-6 px-2 rounded border text-[10px] font-bold bg-white ${
                    selectedMemberIds.size === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-zinc-100'
                  }`}
                  title="ยกเลิกการเลือก"
                >
                  ยกเลิกเลือก
                </button>
              </div>
            </div>

            {/* Class Filter */}
            <div className="flex gap-1 flex-wrap mb-2">
              <button
                onClick={() => setFilterClass('All')}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  filterClass === 'All' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                ทุกอาชีพ
              </button>

              {CLASSES.map(cls => (
                <button
                  key={cls}
                  onClick={() => setFilterClass(cls)}
                  title={CLASS_CONFIG[cls].display}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    filterClass === cls ? 'ring-2 ring-red-500 ring-offset-1' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'
                  }`}
                >
                  <img src={CLASS_DATA[cls].img} className="w-full h-full rounded-full object-cover" />
                </button>
              ))}
            </div>

            <p className="text-[10px] text-zinc-400">
              {branchMembers.length} พร้อม / {activeBranchMembers().length} ทั้งหมด
            </p>
          </div>

          <div ref={rosterScrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar relative">
            {dragItem?.type === 'SLOT' && (
              <div className="absolute inset-0 bg-red-50/50 z-10 flex items-center justify-center pointer-events-none border-2 border-dashed border-red-200 m-2 rounded">
                <p className="text-red-400 font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">วางที่นี่เพื่อลบออก</p>
              </div>
            )}

           {rosterMembers.map(m => {
              const isSelected = selectedMemberIds.has(m.id);

              // แสดง badge ตามเงื่อนไข leave
              const isWarLeave = warLeaveSet.has(m.id);
              const isPersonalLeave = personalLeaveSet.has(m.id);

              const moveBlocked = !canPlaceMemberId(m.id);

              const isDragging = dragItem?.type === 'ROSTER' && dragItem.memberId === m.id;

              const badge =
                !isTempMode && isWarLeave ? 'ลาวอ' : isTempMode && isPersonalLeave ? 'ลากิจ' : isTempMode && isWarLeave ? 'ลาวอ' : null;

              return (
                <div
                  key={m.id}
                  draggable={!moveBlocked}
                  onDragStart={e => {
                    if (moveBlocked) return;
                    handleDragStart(e, { type: 'ROSTER', memberId: m.id });
                  }}
                  onDragEnd={handleDragEnd}
                  onClick={() => toggleSelectedMember(m.id)} // ✅ เลือกเพื่อใส่สีได้เสมอ
                  className={`
                    flex items-center p-2 rounded-md border cursor-pointer select-none transition-all group relative
                    ${moveBlocked ? 'bg-zinc-50 border-transparent opacity-80' : 'bg-white border-transparent hover:bg-zinc-50 hover:border-zinc-200'}
                    ${isSelected ? 'bg-red-50 border-red-300 ring-1 ring-red-300' : ''}
                    ${isDragging ? 'opacity-50 ring-2 ring-red-200 bg-red-50' : ''}
                    ${(!isTempMode && isWarLeave) ? 'bg-red-50 border-red-200' : ''}
                  `}
                  title={moveBlocked ? 'สมาชิกคนนี้ถูกล็อคการจัดตำแหน่งในโหมดปัจจุบัน' : undefined}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-2 mr-3 flex-shrink-0 relative ${
                      moveBlocked ? 'border-zinc-200' : CLASS_DATA[m.class].color
                    }`}
                  >
                    <img src={CLASS_DATA[m.class].img} className="w-full h-full object-cover rounded-full" />
                    {badge && (
                      <div
                        className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-zinc-100 shadow-sm"
                        title={badge}
                      >
                        <Icons.Leave className="w-3 h-3 text-amber-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className={`font-bold text-sm truncate ${getNameColorClass(m.color)}`}>{m.name}</span>
                      {badge && (
                        <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1 rounded ml-1 border border-red-100">
                          {badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] flex justify-between text-zinc-400 font-mono mt-0.5">
                      <span>{m.power.toLocaleString()}</span>
                      <span className="uppercase tracking-tighter">{CLASS_CONFIG[m.class].en}</span>
                    </div>
                  </div>

                  <div className={`w-3 h-3 rounded-full ml-2 ${isSelected ? 'bg-red-500' : 'border border-zinc-200'}`}></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Party Grid */}
        <div
          ref={partyScrollRef}
          className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar"
          onDragOver={e => {
            if (!dragItem) return;
            e.preventDefault();
            maybeAutoScroll(partyScrollRef.current, e.clientY);
          }}
        >
          {/* Groups */}
          {displayGroups.map(group => {
            const colorConfig = GROUP_COLORS.find(c => c.name === group.color) || GROUP_COLORS[0];

            return (
              <div key={group.id} className="mb-8">
                <div className={`flex items-center gap-4 mb-3 border-b pb-2 ${colorConfig.border}`}>
                  <h3 className={`text-lg font-bold rpg-font tracking-wide ${colorConfig.text}`}>{group.name}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => initiateDeleteGroup(group.id)}
                    className="text-xs text-zinc-400 hover:text-red-500 h-6 px-2"
                  >
                    ลบกลุ่ม
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.subPartyIds.map(pid => {
                    const party = subParties.find(p => p.id === pid);
                    return party ? (
                      <PartyCard
                        key={party.id}
                        party={party}
                        onSlotClick={handleSlotClick}
                        members={visibleMembers}
                        selectedMemberIds={selectedMemberIds}
                        onToggleSelectMember={toggleSelectedMember}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOverSlot}
                        onDrop={handleDropOnSlot}
                        dragOverTarget={dragOverTarget}
                        headerStyle={`${colorConfig.bg} ${colorConfig.text?.includes('text-') ? '' : 'text-white'}`}
                        groupName={group.name}
                        getNameColorClass={getNameColorClass}
                        onRemoveFromParty={removeFromParty}
                        isTempMode={isTempMode}
                        canPlaceMemberId={canPlaceMemberId}
                        warLeaveSet={warLeaveSet}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            );
          })}

          {/* Ungrouped */}
          {subParties.some(p => !groups.some(g => g.subPartyIds.includes(p.id))) && (
            <div className="mt-4">
              {groups.length > 0 && (
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4 text-center">ปาร์ตี้ที่ไม่มีกลุ่ม</h3>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {subParties
                  .filter(p => !groups.some(g => g.subPartyIds.includes(p.id)))
                  .map(party => (
                    <PartyCard
                      key={party.id}
                      party={party}
                      onSlotClick={handleSlotClick}
                      members={visibleMembers}
                      selectedMemberIds={selectedMemberIds}
                      onToggleSelectMember={toggleSelectedMember}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOverSlot}
                      onDrop={handleDropOnSlot}
                      dragOverTarget={dragOverTarget}
                      getNameColorClass={getNameColorClass}
                      onRemoveFromParty={removeFromParty}
                      isTempMode={isTempMode}
                      canPlaceMemberId={canPlaceMemberId}
                      warLeaveSet={warLeaveSet}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Copy Modal (คัดลอกข้ามช่วงเวลาอัตโนมัติ) */}
      <Modal isOpen={isCopyOpen} onClose={() => setIsCopyOpen(false)} title="ยืนยันการคัดลอกทีม" size="sm">
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            เมื่อคัดลอกแล้วจะคัดลอกของช่วงเวลา{' '}
            <span className="font-bold text-zinc-900">{copyFromTime.replace(':', '.')}</span>
          </div>

          <div className="text-xs text-zinc-500">
            หมายเหตุ: การคัดลอกจะอัปเดตเฉพาะหน้าจอปัจจุบัน ยังไม่บันทึกลงฐานข้อมูลจนกว่าจะกด “บันทึก”
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsCopyOpen(false)} className="flex-1">
              ยกเลิก
            </Button>
            <Button onClick={handleApplyCopy} className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 border-none">
              ยืนยันคัดลอก
            </Button>
          </div>
        </div>
      </Modal>

      {/* ✅ Temp Copy Modal */}
      <Modal isOpen={isTempCopyOpen} onClose={() => setIsTempCopyOpen(false)} title="จัดทัพชั่วคราว: คัดลอกจากช่วงเวลา" size="sm">
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            เลือกช่วงเวลา “ต้นทาง” เพื่อคัดลอกทีมมาใช้ชั่วคราวในหน้าปัจจุบัน
            <div className="text-xs text-amber-700 mt-2 font-bold">
              หมายเหตุ: โหมดชั่วคราวจะ “ดีดคนลากิจ (วันนี้)” ออกจากปาร์ตี้ และห้ามจัดลากิจเข้าใหม่
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 uppercase w-24">ต้นทาง</span>
            <Select value={tempPickTime} onChange={e => setTempPickTime(e.target.value as WarTime)} className="flex-1">
              <option value="20:00">20.00</option>
              <option value="20:30">20.30</option>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsTempCopyOpen(false)} className="flex-1">
              ยกเลิก
            </Button>
            <Button onClick={handleApplyTempCopy} className="flex-1 bg-amber-600 text-white hover:bg-amber-700 border-none">
              คัดลอกมาใช้งานชั่วคราว
            </Button>
          </div>
        </div>
      </Modal>

      {/* Grouping Modal */}
      <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title="จัดการกลุ่มปาร์ตี้">
        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 rounded border border-zinc-200">
            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">สร้างกลุ่มใหม่</h4>

            <div className="mb-3 space-y-3">
              <Input placeholder="ชื่อกลุ่ม (เช่น ทีมบุก)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />

              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase mb-2 block">เลือกสี</span>
                <div className="flex gap-2">
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setNewGroupColor(c.name)}
                      className={`w-6 h-6 rounded-full border ${c.bg} ${c.border} ${
                        newGroupColor === c.name ? 'ring-2 ring-offset-1 ring-zinc-400 scale-110' : ''
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-3">
              {subParties
                .filter(p => !groups.some(g => g.subPartyIds.includes(p.id)))
                .map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (selectedPartyIdsForGroup.includes(p.id)) setSelectedPartyIdsForGroup(prev => prev.filter(id => id !== p.id));
                      else setSelectedPartyIdsForGroup(prev => [...prev, p.id]);
                    }}
                    className={`
                      p-2 rounded border text-center cursor-pointer text-sm transition-all
                      ${
                        selectedPartyIdsForGroup.includes(p.id)
                          ? 'bg-zinc-800 text-white border-zinc-900 shadow-md transform scale-105'
                          : 'bg-white border-zinc-200 hover:border-red-300 text-zinc-600'
                      }
                    `}
                  >
                    {p.id}
                  </div>
                ))}
            </div>

            <Button onClick={handleCreateGroup} disabled={!newGroupName || selectedPartyIdsForGroup.length === 0} className="w-full">
              สร้างกลุ่ม
            </Button>
          </div>

          {groups.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">กลุ่มที่มีอยู่ (จัดเรียง)</h4>
              <div className="space-y-2">
                {displayGroups.map((g, index) => {
                  const colorConfig = GROUP_COLORS.find(c => c.name === g.color) || GROUP_COLORS[0];
                  return (
                    <div key={g.id} className="flex justify-between items-center p-2 border border-zinc-100 rounded hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveGroup(index, 'up')}
                            className={`p-0.5 rounded hover:bg-zinc-200 ${index === 0 ? 'opacity-20 cursor-default' : 'text-zinc-500'}`}
                          >
                            <Icons.ChevronRight className="w-3 h-3 -rotate-90" />
                          </button>
                          <button
                            type="button"
                            disabled={index === groups.length - 1}
                            onClick={() => handleMoveGroup(index, 'down')}
                            className={`p-0.5 rounded hover:bg-zinc-200 ${
                              index === groups.length - 1 ? 'opacity-20 cursor-default' : 'text-zinc-500'
                            }`}
                          >
                            <Icons.ChevronRight className="w-3 h-3 rotate-90" />
                          </button>
                        </div>

                        <div className={`w-3 h-3 rounded-full ${colorConfig.bg} border ${colorConfig.border}`}></div>

                        <div>
                          <span className="font-bold text-sm text-zinc-800">{g.name}</span>
                          <span className="text-xs text-zinc-400 ml-2">ปาร์ตี้: {g.subPartyIds.join(', ')}</span>
                        </div>
                      </div>

                      <Button size="sm" variant="danger" onClick={() => initiateDeleteGroup(g.id)}>
                        ลบ
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
            <Button variant="ghost" onClick={() => setIsGroupModalOpen(false)}>
              ปิด
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteGroupTargetId} onClose={() => setDeleteGroupTargetId(null)} title="ยืนยันการลบกลุ่ม" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Icons.Trash className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">ยืนยันการลบกลุ่ม?</h3>
            <p className="text-sm text-zinc-500">คุณต้องการลบกลุ่มปาร์ตี้นี้ใช่หรือไม่</p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="ghost" onClick={() => setDeleteGroupTargetId(null)} className="flex-1">
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteGroup}
              className="flex-1 bg-red-600 text-white hover:bg-red-700 border-transparent shadow-lg shadow-red-500/30"
            >
              ยืนยันการลบ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
