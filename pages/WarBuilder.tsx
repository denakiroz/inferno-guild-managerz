
import React, { useState, useEffect } from 'react';
import { Member, Branch, SubParty, WarSetSlot, PartyGroup, CharacterClass, LeaveRequest, PartyGroupConfig, WarEvent } from '../types';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Icons, CLASS_DATA, ClassIcon } from '../components/Icons';
import { BRANCHES, CLASSES, CLASS_CONFIG, GROUP_COLORS } from '../constants';
import { memberService } from '../services/memberService';
import { groupService } from '../services/groupService'; // Import Service

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
    slots: Array(6).fill(null).map((_, idx) => ({ 
      role: 'Any', 
      memberId: null 
    }))
  }));
};

type DragItem = 
  | { type: 'SLOT'; partyId: number; index: number; memberId: string }
  | { type: 'ROSTER'; memberId: string };

type DragTarget = { partyId: number; index: number } | null;

interface PartyCardProps {
  party: SubParty;
  onSlotClick: (partyId: number, slotIndex: number) => void;
  members: Member[];
  selectedMemberId: string | null;
  onDragStart: (e: React.DragEvent, item: DragItem) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, partyId: number, slotIndex: number) => void;
  onDrop: (e: React.DragEvent, partyId: number, slotIndex: number) => void;
  dragOverTarget: DragTarget;
  isDraggingAny: boolean;
  headerStyle?: string;
  groupName?: string;
}

const PartyCard: React.FC<PartyCardProps> = ({ 
  party, onSlotClick, members, selectedMemberId, 
  onDragStart, onDragEnd, onDragOver, onDrop, dragOverTarget, isDraggingAny,
  headerStyle = 'bg-zinc-100', groupName 
}) => {
  return (
    <div className={`rounded-lg border overflow-hidden shadow-sm bg-white transition-all ${isDraggingAny ? 'border-dashed border-zinc-300' : 'border-zinc-200'}`}>
        <div className={`px-3 py-2 flex justify-between items-center ${headerStyle}`}>
            <span className="font-bold text-sm text-zinc-700">{groupName ? `${groupName} - ` : ''}{party.name}</span>
            <span className="text-xs text-zinc-500 font-mono">{party.slots.filter(s => s.memberId).length}/6</span>
        </div>
        <div className="p-2 space-y-1">
            {party.slots.map((slot, idx) => {
                const member = slot.memberId ? members.find(m => m.id === slot.memberId) : null;
                const isSelected = member && selectedMemberId === member.id;
                const isDragTarget = dragOverTarget?.partyId === party.id && dragOverTarget?.index === idx;
                const memberClassData = member ? CLASS_DATA[member.class] : null;

                return (
                    <div 
                        key={idx}
                        className={`
                           relative flex items-center p-1.5 rounded border transition-all h-[42px] cursor-pointer
                           ${isDragTarget ? 'bg-red-50 border-red-300 ring-2 ring-red-200 z-10' : ''}
                           ${isSelected ? 'bg-red-50 border-red-300' : 'border-zinc-100 hover:border-zinc-300'}
                           ${!member ? 'bg-zinc-50/50' : 'bg-white'}
                        `}
                        onClick={() => onSlotClick(party.id, idx)}
                        onDragOver={(e) => onDragOver(e, party.id, idx)}
                        onDrop={(e) => onDrop(e, party.id, idx)}
                    >
                        {member && memberClassData ? (
                            <>
                                <div 
                                    className={`w-7 h-7 rounded-full border mr-2 flex-shrink-0 cursor-grab active:cursor-grabbing ${memberClassData.color.split(' ')[0]}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        onDragStart(e, { type: 'SLOT', partyId: party.id, index: idx, memberId: member.id });
                                    }}
                                    onDragEnd={onDragEnd}
                                >
                                    <img src={memberClassData.img} className="w-full h-full rounded-full object-cover" alt="" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-zinc-800 truncate leading-none">{member.name}</div>
                                    <div className="text-[9px] text-zinc-400 font-mono mt-0.5">{member.power.toLocaleString()}</div>
                                </div>
                                {isSelected && <div className="w-2 h-2 bg-red-500 rounded-full ml-1"></div>}
                            </>
                        ) : (
                            <div className="w-full text-center text-[10px] text-zinc-300 font-bold uppercase tracking-widest select-none">
                                ว่าง
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export const WarBuilder: React.FC<WarBuilderProps> = ({
  members,
  leaveRequests,
  onExport,
  groupConfigs = [],
  onUpdateGroupConfig,
  onReloadMembers, 
}) => {

  const [selectedBranch, setSelectedBranch] = useState<Branch>('Inferno-1');
  const [warTime, setWarTime] = useState<'20:00' | '20:30'>('20:00');
  
  // Helper to get Thai Date Object (UTC+7)
  const getThaiDate = () => {
    const d = new Date();
    return new Date(d.getTime() + (7 * 60 * 60 * 1000));
  };

  // Helper: Format Date YYYY-MM-DD using UTC components of the shifted date
  const toISOStringDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Auto-set War Date to next Saturday (or today if Saturday)
  const [warDate, setWarDate] = useState(() => {
    const d = getThaiDate();
    const day = d.getUTCDay(); // Thai Day
    // Calculate days to next Saturday (6)
    const daysToAdd = (6 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    
    // FIX: Manually format to prevent timezone shift back to Friday
    return toISOStringDate(d);
  });

  const [filterClass, setFilterClass] = useState<CharacterClass | 'All'>('All');
  
  // Builder State
  const [subParties, setSubParties] = useState<SubParty[]>(createInitialParties());
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // --- SYNC WITH DB ---
  // When members load or branch changes or TIME changes, populate slots
  useEffect(() => {
  // 1) Load Group Config
  const savedConfig = groupConfigs.find(c => c.branch === selectedBranch);
  setGroups(savedConfig ? savedConfig.groups : []);

  // 2) Populate Slots from DB using party + pos_party (or party_2 + pos_party_2)
  const newParties = createInitialParties();

  // (แนะนำ) กันตัวซ้ำ: ถ้าข้อมูล DB ผิดพลาด เช่น คนเดียวถูก set ซ้ำหลายตำแหน่ง
  const placed = new Set<string>();

  members.forEach(m => {
    // ใช้ field ตามรอบเวลา
    const partyId = warTime === '20:00' ? m.party : m.party2;
    const pos     = warTime === '20:00' ? m.posParty : m.posParty2;

    // เงื่อนไขพื้นฐาน
    if (m.branch !== selectedBranch) return;
    if (m.status !== 'Active') return;

    // ต้องมี partyId และ pos ที่ valid
    if (!partyId || partyId < 1 || partyId > 10) return;
    if (pos === null || pos === undefined) return;
    if (pos < 0 || pos > 5) return;

    // กันวางซ้ำ
    if (placed.has(m.id)) return;

    const partyIdx = partyId - 1;

    // กันชน: ถ้ามีคนอยู่ slot นี้แล้ว ให้ “ไม่ทับ” (หรือจะเลือกทับก็ได้)
    if (newParties[partyIdx].slots[pos].memberId) return;

    newParties[partyIdx].slots[pos].memberId = m.id;
    placed.add(m.id);
  });

  setSubParties(newParties);
}, [selectedBranch, groupConfigs, members, warTime]);

  const updateGroups = (newGroups: PartyGroup[]) => {
    setGroups(newGroups);
    if (onUpdateGroupConfig) {
      onUpdateGroupConfig(selectedBranch, newGroups);
    }
  };

  // Interaction State
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  
  // Delete Confirmation State
  const [deleteGroupTargetId, setDeleteGroupTargetId] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('เทา');
  const [selectedPartyIdsForGroup, setSelectedPartyIdsForGroup] = useState<number[]>([]);
  
  // Drag State
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragTarget>(null);

  // Filter Members & Sort by Power Descending
  const branchMembers = members
    .filter(m => {
      if (m.branch !== selectedBranch || m.status !== 'Active') return false;
      if (filterClass !== 'All' && m.class !== filterClass) return false;
      return true;
    })
    .sort((a, b) => b.power - a.power);

  const assignedMemberIds = new Set<string>();
  subParties.forEach(p => p.slots.forEach(s => { if(s.memberId) assignedMemberIds.add(s.memberId) }));

  // --- Handlers ---

  const handleSlotClick = (partyId: number, slotIndex: number) => {
    if (selectedMemberId) {
      const newParties = subParties.map(p => ({
        ...p,
        slots: p.slots.map(s => s.memberId === selectedMemberId ? { ...s, memberId: null } : s)
      }));

      const targetParty = newParties.find(p => p.id === partyId);
      if (targetParty) {
        targetParty.slots[slotIndex] = { ...targetParty.slots[slotIndex], memberId: selectedMemberId };
      }
      
      setSubParties(newParties);
      setSelectedMemberId(null);
      return;
    }

    setSubParties(prev => prev.map(p => {
      if (p.id !== partyId) return p;
      if (!p.slots[slotIndex].memberId) return p;
      const newSlots = [...p.slots];
      newSlots[slotIndex] = { ...newSlots[slotIndex], memberId: null };
      return { ...p, slots: newSlots };
    }));
  };

  const handleCreateGroup = async () => {
    if (!newGroupName || selectedPartyIdsForGroup.length === 0) return;
    
    // Sort party IDs for consistency
    const sortedPartyIds = [...selectedPartyIdsForGroup].sort((a, b) => a - b);
    
    // Calculate new order (last + 1)
    const maxOrder = groups.reduce((max, g) => Math.max(max, g.order_by || 0), 0);

    try {
      // DB Save
      const createdGroup = await groupService.create(selectedBranch, {
        name: newGroupName,
        subPartyIds: sortedPartyIds,
        color: newGroupColor,
        order_by: maxOrder + 1
      });

      // Update Local State
      const updatedGroups = [...groups, createdGroup];
      updateGroups(updatedGroups);
      
      setIsGroupModalOpen(false);
      setNewGroupName('');
      setNewGroupColor('เทา');
      setSelectedPartyIdsForGroup([]);
    } catch (error: any) {
      console.error(error);
      // alert("ไม่สามารถสร้างกลุ่มได้: " + error.message);
    }
  };

  const initiateDeleteGroup = (groupId: string) => {
    setDeleteGroupTargetId(groupId);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTargetId) return;
    
    try {
      await groupService.delete(selectedBranch, deleteGroupTargetId);
      const updatedGroups = groups.filter(g => g.id !== deleteGroupTargetId);
      updateGroups(updatedGroups);
      setDeleteGroupTargetId(null);
    } catch (error: any) {
      console.error(error);
      // alert("ไม่สามารถลบกลุ่มได้: " + error.message);
    }
  };

  const handleMoveGroup = async (index: number, direction: 'up' | 'down') => {
    const sortedGroups = [...groups].sort((a, b) => (a.order_by || 0) - (b.order_by || 0));
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sortedGroups.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap in array
    [sortedGroups[index], sortedGroups[targetIndex]] = [sortedGroups[targetIndex], sortedGroups[index]];
    
    // Update order_by values based on new index positions
    const updates = sortedGroups.map((g, idx) => ({ ...g, order_by: idx }));
    
    // Optimistic Update
    updateGroups(updates);
    
    // API Call
    try {
        await groupService.updateOrder(selectedBranch, updates.map(g => ({ id: g.id, order_by: g.order_by! })));
    } catch (err) {
        console.error("Failed to reorder", err);
    }
  };

  // --- NEW: Save Party Assignments to Database ---
  const handleSaveToDB = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
       // 1. Map current assignments in UI
       type AssignInfo = { party: number; pos: number };
       const assignmentMap = new Map<string, AssignInfo>();
       subParties.forEach(p => {
          p.slots.forEach((s, idx) => {
            if (s.memberId) {
              assignmentMap.set(s.memberId, {
                party: p.id,
                pos: idx
              });
            }
          });
        });

       // 2. Prepare updates for ALL members in this branch
       const branchMembersList = members.filter(m => m.branch === selectedBranch);
       
       const promises = branchMembersList.map(m => {
        const info = assignmentMap.get(m.id);

        const newParty = info?.party ?? null;
        const newPos   = info?.pos ?? null;

        const currentParty = warTime === '20:00' ? m.party : m.party2;
        const currentPos   = warTime === '20:00' ? m.posParty : m.posParty2;

        if (currentParty !== newParty || currentPos !== newPos) {
          return memberService.updateParty(
            m.id,
            newParty,
            warTime,
            newPos
          );
        }
        return Promise.resolve();
      });
       
       await Promise.all(promises);
       await onReloadMembers();
       setSaveStatus('success');
       setTimeout(() => setSaveStatus('idle'), 3000);

    } catch(e: any) {
       console.error(e);
       setSaveStatus('error');
       setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
       setIsSaving(false);
    }
  };

  // --- NEW: Open Visualizer in New Tab ---
  const handleOpenVisualizer = () => {
    // 1. Prepare Data Maps for quick lookup
    // Sort groups by order_by before mapping
    const sortedGroups = [...groups].sort((a, b) => (a.order_by || 0) - (b.order_by || 0));
    
    const partyGroupMap = new Map<number, { name: string; colorConfig: any }>();
    sortedGroups.forEach(g => {
        const colorConfig = GROUP_COLORS.find(c => c.name === g.color) || GROUP_COLORS[0];
        g.subPartyIds.forEach(pid => {
            partyGroupMap.set(pid, { name: g.name, colorConfig });
        });
    });

    // 2. Prepare Ordered List of Parties based on Groups
    const orderedParties: SubParty[] = [];
    const processedPartyIds = new Set<number>();

    // 2a. Add parties from groups in order
    sortedGroups.forEach(group => {
        // Sort subPartyIds within the group (e.g. 5, 6) just in case
        const sortedSubIds = [...group.subPartyIds].sort((a, b) => a - b);
        sortedSubIds.forEach(pid => {
            const party = subParties.find(p => p.id === pid);
            if (party && !processedPartyIds.has(pid)) {
                orderedParties.push(party);
                processedPartyIds.add(pid);
            }
        });
    });

    // 2b. Add remaining (ungrouped) parties sorted by ID
    const remainingParties = subParties
        .filter(p => !processedPartyIds.has(p.id))
        .sort((a, b) => a.id - b.id);
        
    orderedParties.push(...remainingParties);

    // 3. Generate HTML using the ordered list
    const partiesHtml = orderedParties.map(party => {
        const groupInfo = partyGroupMap.get(party.id);
        
        // Define strong headers for high visibility
        let headerClass = 'bg-zinc-800 text-white border-zinc-900';
        let groupLabelStyle = 'bg-white/20 text-white border-white/10';

        if (groupInfo) {
            const c = groupInfo.colorConfig.bg; // e.g. bg-red-50
            if (c.includes('red')) headerClass = 'bg-red-700 text-white border-red-800';
            else if (c.includes('blue')) headerClass = 'bg-blue-700 text-white border-blue-800';
            else if (c.includes('emerald')) headerClass = 'bg-emerald-700 text-white border-emerald-800';
            else if (c.includes('amber')) headerClass = 'bg-amber-600 text-white border-amber-700';
            else if (c.includes('purple')) headerClass = 'bg-purple-700 text-white border-purple-800';
            else if (c.includes('cyan')) headerClass = 'bg-cyan-700 text-white border-cyan-800';
        }

        // LOGIC: Show Group Name in Center. Remove Leader Name.
        const headerTitle = groupInfo ? groupInfo.name : '';

        let slotsHtml = '';
        party.slots.forEach((slot, idx) => {
            const m = members.find(mem => mem.id === slot.memberId);

            if (m) {
                const classData = CLASS_DATA[m.class];
                // Using List layout for tighter fit
                slotsHtml += `
                    <div class="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-100 last:border-0 bg-white relative">
                        <div class="w-9 h-9 rounded-full border-2 overflow-hidden flex-shrink-0 relative z-10" style="border-color: ${classData.color.includes('yellow') ? '#eab308' : classData.color.includes('red') ? '#dc2626' : classData.color.includes('blue') ? '#3b82f6' : '#a1a1aa'}">
                            <img src="${classData.img}" class="w-full h-full object-cover">
                        </div>
                        <div class="min-w-0 flex-1 leading-none flex items-center justify-between">
                            <div>
                                <div class="font-bold text-base text-zinc-900 truncate relative" style="top: 1px;">${m.name}</div>
                                <div class="text-[11px] text-zinc-500 font-mono font-bold mt-0.5">${m.power.toLocaleString()} • ${CLASS_CONFIG[m.class].th}</div>
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
            <div class="border border-zinc-300 rounded-xl overflow-hidden shadow-md bg-white flex flex-col h-full">
                <div class="px-3 py-1 relative flex items-center justify-center ${headerClass} h-[46px]">
                    <div class="text-center font-bold text-2xl tracking-tight truncate px-2 w-full" style="font-family: 'Athiti', sans-serif;">
                        ${headerTitle}
                    </div>
                </div>
                <div class="bg-white flex-1 flex flex-col justify-center">
                    ${slotsHtml}
                </div>
            </div>
        `;
    }).join('');

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=1400, initial-scale=1.0" />
        <title>แผนการจัดทัพ (${warTime.replace(':', '.')}) - ${selectedBranch}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Athiti:wght@400;500;600;700&display=swap');
          body { font-family: 'Athiti', sans-serif; background-color: #f8fafc; }
        </style>
      </head>
      <body class="p-6 h-screen flex flex-col overflow-hidden">
        <div class="grid grid-cols-3 items-center mb-6 border-b-2 border-zinc-800 pb-2 flex-shrink-0">
            <div class="text-left">
               <div class="px-4 py-1.5 bg-white border border-zinc-300 rounded shadow-sm text-zinc-700 font-bold text-lg inline-block mr-2">
                  วันที่: ${warDate}
               </div>
               <div class="px-4 py-1.5 bg-zinc-900 border border-zinc-900 rounded shadow-sm text-white font-bold text-lg inline-block">
                  รอบเวลา: ${warTime.replace(':', '.')} น.
               </div>
            </div>
            <div class="text-center">
               <h1 class="text-5xl font-bold text-zinc-900 uppercase tracking-widest leading-none drop-shadow-sm">${selectedBranch}</h1>
            </div>
            <div class="text-right">
                <span class="bg-red-700 text-white px-4 py-1.5 rounded text-sm font-bold uppercase tracking-wider shadow-md">Inferno Guild</span>
            </div>
        </div>
        
        <div class="flex-1">
            <div class="grid grid-cols-5 gap-4 h-full">
                ${partiesHtml}
            </div>
        </div>
      </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(fullHtml);
        newWindow.document.close();
    } else {
        console.warn("Pop-up blocked");
    }
  };

  // --- Drag & Drop Logic ---

  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverTarget(null);
  };

  const handleDragOverSlot = (e: React.DragEvent, partyId: number, index: number) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTarget?.partyId !== partyId || dragOverTarget?.index !== index) {
      setDragOverTarget({ partyId, index });
    }
  };

  const handleDropOnSlot = (e: React.DragEvent, targetPartyId: number, targetIndex: number) => {
    e.preventDefault();
    if (!dragItem) return;

    const newParties = subParties.map(p => ({ ...p, slots: [...p.slots] })); 
    const targetParty = newParties.find(p => p.id === targetPartyId);
    if (!targetParty) return;

    const targetSlotMemberId = targetParty.slots[targetIndex].memberId;

    if (dragItem.type === 'ROSTER') {
      // Remove from old slot if exists (though roster drag implies new assignment, but just in case logic changes)
      newParties.forEach(p => {
        p.slots.forEach((s, idx) => {
          if (s.memberId === dragItem.memberId) {
             p.slots[idx] = { ...s, memberId: null };
          }
        });
      });
      targetParty.slots[targetIndex] = { ...targetParty.slots[targetIndex], memberId: dragItem.memberId };
    
    } else if (dragItem.type === 'SLOT') {
      const sourceParty = newParties.find(p => p.id === dragItem.partyId);
      if (sourceParty) {
        const sourceMemberId = sourceParty.slots[dragItem.index].memberId;
        
        if (targetSlotMemberId) {
          // Swap
          sourceParty.slots[dragItem.index] = { ...sourceParty.slots[dragItem.index], memberId: targetSlotMemberId };
          targetParty.slots[targetIndex] = { ...targetParty.slots[targetIndex], memberId: sourceMemberId };
        } else {
          // Move
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
    if (!dragItem || dragItem.type !== 'SLOT') return;

    setSubParties(prev => prev.map(p => {
      if (p.id !== dragItem.partyId) return p;
      const newSlots = [...p.slots];
      newSlots[dragItem.index] = { ...newSlots[dragItem.index], memberId: null };
      return { ...p, slots: newSlots };
    }));
    
    setDragItem(null);
    setDragOverTarget(null);
  };
  
  // Sort groups for display in grid (using state which is updated by service/local logic)
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
                 onChange={e => {
                    setSelectedBranch(e.target.value as Branch);
                    // Groups update via useEffect
                 }}
                 className="w-40 border-none bg-zinc-100 font-bold text-zinc-700"
               >
                 {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
               </Select>
            </div>

            {/* Time Selector */}
            <div className="bg-zinc-100 p-1 rounded-lg flex items-center">
               <button
                  onClick={() => setWarTime('20:00')}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${warTime === '20:00' ? 'bg-white text-red-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
               >
                  20.00 น.
               </button>
               <button
                  onClick={() => setWarTime('20:30')}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${warTime === '20:30' ? 'bg-white text-red-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
               >
                  20.30 น.
               </button>
            </div>
         </div>
         <div className="flex gap-2 w-full md:w-auto justify-end">
            <Button variant="ghost" onClick={() => setIsGroupModalOpen(true)}>
               <Icons.Users className="w-4 h-4 mr-2" /> จัดการกลุ่ม
            </Button>
            
            {/* NEW: Save to DB Button */}
            <Button 
                onClick={handleSaveToDB} 
                variant={saveStatus === 'success' ? 'primary' : (saveStatus === 'error' ? 'danger' : 'secondary')} 
                className={`transition-all ${saveStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : (saveStatus === 'error' ? '' : 'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 shadow-sm')}`}
                disabled={isSaving}
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

            {/* NEW: Visualizer Button */}
            <Button 
               onClick={handleOpenVisualizer} 
               variant="primary" 
               className="bg-red-700 text-white hover:bg-red-800 border-none shadow-md"
            >
               <Icons.Image className="w-4 h-4 mr-2" /> แสดงผังจัดทัพ (Visual)
            </Button>
         </div>
      </Card>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
        {/* Left: Member Roster */}
        <div 
          className="w-full lg:w-72 flex flex-col bg-white border border-zinc-100 rounded-lg shadow-sm lg:h-full h-64 flex-shrink-0 transition-colors"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={handleDropOnRoster}
        >
           <div className="p-4 border-b border-zinc-50">
              <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-wider mb-3">สมาชิกที่ว่าง ({warTime.replace(':', '.')})</h3>
              <div className="flex gap-1 flex-wrap mb-2">
                 <button 
                    onClick={() => setFilterClass('All')}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${filterClass === 'All' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}`}
                 >
                   ทุกอาชีพ
                 </button>
                 {CLASSES.map(cls => (
                   <button
                      key={cls}
                      onClick={() => setFilterClass(cls)}
                      title={CLASS_CONFIG[cls].display}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${filterClass === cls ? 'ring-2 ring-red-500 ring-offset-1' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`}
                   >
                     <img src={CLASS_DATA[cls].img} className="w-full h-full rounded-full object-cover" />
                   </button>
                 ))}
              </div>
              <p className="text-[10px] text-zinc-400">{branchMembers.filter(m => !assignedMemberIds.has(m.id)).length} พร้อม / {branchMembers.length} ทั้งหมด</p>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar relative">
              {dragItem?.type === 'SLOT' && (
                <div className="absolute inset-0 bg-red-50/50 z-10 flex items-center justify-center pointer-events-none border-2 border-dashed border-red-200 m-2 rounded">
                   <p className="text-red-400 font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">วางที่นี่เพื่อลบออก</p>
                </div>
              )}

              {branchMembers.map(m => {
                 const isAssigned = assignedMemberIds.has(m.id);
                 const isSelected = selectedMemberId === m.id;
                 const isOnLeave = leaveRequests.some(r => r.memberId === m.id && r.warDate === warDate);
                 const isDragging = dragItem?.memberId === m.id;

                 return (
                   <div 
                     key={m.id}
                     draggable={!isAssigned && !isOnLeave}
                     onDragStart={(e) => handleDragStart(e, { type: 'ROSTER', memberId: m.id })}
                     onDragEnd={handleDragEnd}
                     onClick={() => !isAssigned && !isOnLeave && setSelectedMemberId(isSelected ? null : m.id)}
                     className={`
                       flex items-center p-2 rounded-md border cursor-pointer select-none transition-all group relative
                       ${isAssigned 
                         ? 'bg-zinc-50 text-zinc-300 border-zinc-50 pointer-events-none' 
                         : isOnLeave
                            ? 'bg-zinc-50 text-zinc-400 border-transparent cursor-not-allowed opacity-80'
                            : isSelected 
                                ? 'bg-red-50 border-red-300 ring-1 ring-red-300' 
                                : 'bg-white border-transparent hover:bg-zinc-50 hover:border-zinc-200'
                       }
                       ${isDragging ? 'opacity-50 ring-2 ring-red-200 bg-red-50' : ''}
                     `}
                   >
                     <div className={`w-8 h-8 rounded-full border-2 mr-3 flex-shrink-0 relative ${isAssigned || isOnLeave ? 'border-zinc-200' : CLASS_DATA[m.class].color}`}>
                        <img src={CLASS_DATA[m.class].img} className={`w-full h-full object-cover rounded-full ${isOnLeave ? 'grayscale' : ''}`} />
                        {isOnLeave && (
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-zinc-100 shadow-sm" title="On Leave">
                            <Icons.Leave className="w-3 h-3 text-amber-500" />
                          </div>
                        )}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-sm truncate">{m.name}</span>
                          {isOnLeave && <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1 rounded ml-1 border border-red-100">ลาวอ</span>}
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
        <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
           {/* Groups (Sorted) */}
           {displayGroups.map(group => {
             const colorConfig = GROUP_COLORS.find(c => c.name === group.color) || GROUP_COLORS[0];
             return (
               <div key={group.id} className="mb-8">
                  <div className={`flex items-center gap-4 mb-3 border-b pb-2 ${colorConfig.border}`}>
                     <h3 className={`text-lg font-bold rpg-font tracking-wide ${colorConfig.text}`}>{group.name}</h3>
                     <Button size="sm" variant="ghost" onClick={() => initiateDeleteGroup(group.id)} className="text-xs text-zinc-400 hover:text-red-500 h-6 px-2">ลบกลุ่ม</Button>
                  </div>
                  {/* Responsive Grid: Up to 4 columns on XL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                     {group.subPartyIds.map(pid => {
                        const party = subParties.find(p => p.id === pid);
                        return party ? (
                           <PartyCard 
                             key={party.id} 
                             party={party} 
                             onSlotClick={handleSlotClick} 
                             members={members} 
                             selectedMemberId={selectedMemberId}
                             onDragStart={handleDragStart}
                             onDragEnd={handleDragEnd}
                             onDragOver={handleDragOverSlot}
                             onDrop={handleDropOnSlot}
                             dragOverTarget={dragOverTarget}
                             isDraggingAny={!!dragItem}
                             headerStyle={colorConfig.bg}
                             groupName={group.name}
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
                 {groups.length > 0 && <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4 text-center">ปาร์ตี้ที่ไม่มีกลุ่ม</h3>}
                 {/* Responsive Grid: Up to 4 columns on XL */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {subParties.filter(p => !groups.some(g => g.subPartyIds.includes(p.id))).map(party => (
                       <PartyCard 
                           key={party.id} 
                           party={party} 
                           onSlotClick={handleSlotClick} 
                           members={members} 
                           selectedMemberId={selectedMemberId}
                           onDragStart={handleDragStart}
                           onDragEnd={handleDragEnd}
                           onDragOver={handleDragOverSlot}
                           onDrop={handleDropOnSlot}
                           dragOverTarget={dragOverTarget}
                           isDraggingAny={!!dragItem}
                         />
                    ))}
                 </div>
              </div>
           )}
        </div>
      </div>

      {/* Grouping Modal */}
      <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title="จัดการกลุ่มปาร์ตี้">
         <div className="space-y-4">
            <div className="p-4 bg-zinc-50 rounded border border-zinc-200">
               <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">สร้างกลุ่มใหม่</h4>
               <div className="mb-3 space-y-3">
                  <Input 
                    placeholder="ชื่อกลุ่ม (เช่น ทีมบุก)" 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase mb-2 block">เลือกสี</span>
                    <div className="flex gap-2">
                       {GROUP_COLORS.map(c => (
                          <button
                             key={c.name}
                             type="button"
                             onClick={() => setNewGroupColor(c.name)}
                             className={`w-6 h-6 rounded-full border ${c.bg} ${c.border} ${newGroupColor === c.name ? 'ring-2 ring-offset-1 ring-zinc-400 scale-110' : ''}`}
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
                          if (selectedPartyIdsForGroup.includes(p.id)) {
                             setSelectedPartyIdsForGroup(prev => prev.filter(id => id !== p.id));
                          } else {
                             setSelectedPartyIdsForGroup(prev => [...prev, p.id]);
                          }
                       }}
                       className={`
                          p-2 rounded border text-center cursor-pointer text-sm transition-all
                          ${selectedPartyIdsForGroup.includes(p.id) 
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
                     {/* Use displayGroups sorted by order */}
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
                                      className={`p-0.5 rounded hover:bg-zinc-200 ${index === groups.length - 1 ? 'opacity-20 cursor-default' : 'text-zinc-500'}`}
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
                             <Button size="sm" variant="danger" onClick={() => initiateDeleteGroup(g.id)}>ลบ</Button>
                          </div>
                        );
                     })}
                  </div>
               </div>
            )}
            
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
               <Button variant="ghost" onClick={() => setIsGroupModalOpen(false)}>ปิด</Button>
            </div>
         </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteGroupTargetId}
        onClose={() => setDeleteGroupTargetId(null)}
        title="ยืนยันการลบกลุ่ม"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Icons.Trash className="w-8 h-8 text-red-600" />
             </div>
             <h3 className="text-lg font-bold text-zinc-900 mb-2">ยืนยันการลบกลุ่ม?</h3>
             <p className="text-sm text-zinc-500">
               คุณต้องการลบกลุ่มปาร์ตี้นี้ใช่หรือไม่
             </p>
          </div>
          
          <div className="flex gap-3 justify-center pt-2">
             <Button variant="ghost" onClick={() => setDeleteGroupTargetId(null)} className="flex-1">ยกเลิก</Button>
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
