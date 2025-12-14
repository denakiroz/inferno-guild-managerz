import React, { useState, useEffect } from 'react';
import { Member, LeaveRequest, WarEvent, GameEvent, PartyGroupConfig, Branch, PartyGroup, WarResult, RegularWar, SubParty } from './types';
import { MOCK_GAME_EVENTS } from './constants';
import { Icons } from './components/Icons';
import { memberService } from './services/memberService';
import { leaveService } from './services/leaveService';
import { groupService } from './services/groupService';
import { warHistoryService } from './services/warHistoryService';
import { regularWarService } from './services/regularWarService';
import { supabase } from './lib/supabaseClient';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { WarBuilder } from './pages/WarBuilder';
import { LeaveRequests } from './pages/LeaveRequests';
import { WarHistory } from './pages/WarHistory';
import { RegularWarHistory } from './pages/WarPlans';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [members, setMembers] = useState<Member[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [warHistory, setWarHistory] = useState<WarEvent[]>([]);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>(MOCK_GAME_EVENTS);
  const [regularWars, setRegularWars] = useState<RegularWar[]>([]);
  const [groupConfigs, setGroupConfigs] = useState<PartyGroupConfig[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarLocked, setIsSidebarLocked] = useState(false);

  const isDesktopExpanded = isSidebarHovered || isSidebarLocked;

  // Helper: Get Thai Date Object (UTC+7)
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

  // ✅ Helper: create timestamp string "YYYY-MM-DDT20:00:00"
  const buildWarTimestamp = (dateStr: string, session: '20:00' | '20:30') => {
    const hhmm = session === '20:00' ? '20:00:00' : '20:30:00';
    return `${dateStr}T${hhmm}`;
  };

  // ✅ Helper: alternating 1 round / 2 rounds by weeks since anchor saturday
  const getSessionsForSaturday = (thaiSaturdayDateStr: string): Array<'20:00' | '20:30'> => {
    const anchor = new Date('2025-01-04T00:00:00'); // เสาร์แรกปี 2025
    const cur = new Date(`${thaiSaturdayDateStr}T00:00:00`);
    const diffDays = Math.floor((cur.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSince = Math.floor(diffDays / 7);

    // weeksSince: 0 => 1 round, 1 => 2 rounds, 2 => 1 round, ...
    const isTwoRounds = (weeksSince % 2) === 1;
    return isTwoRounds ? ['20:00', '20:30'] : ['20:00'];
  };

  const fetchData = async () => {
    setIsMembersLoading(true);
    setFetchError(null);
    try {
      const [membersData, leavesData, historyData, regularWarsData] = await Promise.all([
        memberService.getAll(),
        leaveService.getAll(),
        warHistoryService.getAll(),
        regularWarService.getAll()
      ]);

      const [g1, g2, g3] = await Promise.all([
        groupService.getAllByBranch('Inferno-1'),
        groupService.getAllByBranch('Inferno-2'),
        groupService.getAllByBranch('Inferno-3')
      ]);

      setGroupConfigs([
        { branch: 'Inferno-1', groups: g1 },
        { branch: 'Inferno-2', groups: g2 },
        { branch: 'Inferno-3', groups: g3 },
      ]);

      // Calculate leave counts (Using ALL history)
      const membersWithCounts = membersData.map(m => {
        const memberLeaves = leavesData.filter(l => l.memberId === m.id);

        const warLeaves = memberLeaves.filter(l => {
          if (!l.warDate) return false;
          const [y, mm, dd] = l.warDate.split('-').map(Number);
          const date = new Date(Date.UTC(y, mm - 1, dd));
          return date.getUTCDay() === 6; // Saturday
        });

        return {
          ...m,
          leaveCount: memberLeaves.length,
          warLeaveCount: warLeaves.length
        };
      });

      setMembers(membersWithCounts);
      setLeaveRequests(leavesData);
      setRegularWars(regularWarsData);

      // --- AUTOMATED SNAPSHOT LOGIC ---
      const thaiDate = getThaiDate();
      const currentDay = thaiDate.getUTCDay();   // 6 = Saturday
      const currentHour = thaiDate.getUTCHours(); // Thai hour

      let finalHistory = historyData;

      // ✅ Saturday AND Time >= 21:00
      if (currentDay === 6 && currentHour >= 21) {
        const dateStr = toISOStringDate(thaiDate); // "YYYY-MM-DD"
        const sessions = getSessionsForSaturday(dateStr); // ['20:00'] or ['20:00','20:30']
        const branches: Branch[] = ['Inferno-1', 'Inferno-2', 'Inferno-3'];
        const newEvents: WarEvent[] = [];

        for (const branch of branches) {
          for (const session of sessions) {
            const dateTs = buildWarTimestamp(dateStr, session); // ✅ timestamp stored in DB

            // ✅ exists check by exact timestamp string + branch
            const exists = historyData.some(h => String(h.date) === String(dateTs) && h.branch === branch);
            if (exists) continue;

            console.log(`Auto-snapshotting for ${branch} on ${dateTs}...`);

            // Construct Snapshot Data:
            // - session 20:00 uses member.party
            // - session 20:30 uses member.party_2
            const snapshotParties: SubParty[] = Array.from({ length: 10 }, (_, i) => ({
              id: i + 1,
              name: `ปาร์ตี้ ${i + 1}`,
              slots: Array(6).fill(null).map(() => ({ role: 'Any', memberId: null }))
            }));

            const branchMembers = membersData.filter(m => m.branch === branch && m.status === 'Active');

            branchMembers.forEach(m => {
              const partyNo = (session === '20:00' ? (m as any).party : (m as any).party_2);

              if (partyNo && partyNo >= 1 && partyNo <= 10) {
                const partyIdx = partyNo - 1;
                const emptySlotIdx = snapshotParties[partyIdx].slots.findIndex(s => s.memberId === null);
                if (emptySlotIdx !== -1) {
                  snapshotParties[partyIdx].slots[emptySlotIdx].memberId = m.id;
                }
              }
            });

            // ✅ Build leave_snapshot (jsonb)
            // leave table ไม่มี session => ถือว่า "ลาทั้งคืน" และใส่ session ของการ์ดนั้นไปเลย
            const branchLeavesForDate = leavesData
              .filter(l => (l.memberId || '').startsWith(`${branch}:`))
              .filter(l => String(l.warDate || '') === dateStr);

            const leaveSnapshot = branchLeavesForDate.map(l => {
              const mem = membersData.find(m => m.id === l.memberId);
              return {
                memberId: l.memberId,
                name: mem?.name || 'Unknown',
                class: mem?.class,
                power: mem?.power,
                branch: branch,
                leaveType: 'War',
                session: session,
                warDate: dateStr
              };
            });

            try {
              const newEvent = await warHistoryService.create(branch, dateTs, snapshotParties, leaveSnapshot);
              newEvents.push(newEvent);
            } catch (err) {
              console.error(`Failed to auto-snapshot for ${branch} ${dateTs}`, err);
            }
          }
        }

        if (newEvents.length > 0) {
          finalHistory = [...newEvents, ...historyData].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }
      }

      setWarHistory(finalHistory);

    } catch (error: any) {
      console.error("Failed to fetch data:", error);
      setFetchError(error.message || "เชื่อมต่อฐานข้อมูลล้มเหลว");
    } finally {
      setIsMembersLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---
  const handleAddMember = async (m: Member) => {
    setActionError(null);
    try {
      const newMember = await memberService.create(m);
      setMembers(prev => [...prev, newMember]);
    } catch (error: any) {
      console.error(error);
      setActionError(`บันทึกข้อมูลล้มเหลว: ${error.message}`);
    }
  };

  const handleUpdateMember = async (m: Member) => {
    setActionError(null);
    try {
      const updated = await memberService.update(m);
      const currentMember = members.find(old => old.id === m.id);
      setMembers(prev => prev.map(mem => mem.id === updated.id ? {
        ...updated,
        leaveCount: currentMember?.leaveCount || 0,
        warLeaveCount: currentMember?.warLeaveCount || 0
      } : mem));
    } catch (error: any) {
      console.error(error);
      setActionError(`แก้ไขข้อมูลล้มเหลว: ${error.message}`);
    }
  };

  const handleDeleteMember = async (id: string) => {
    setActionError(null);
    try {
      await memberService.delete(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (error: any) {
      console.error(error);
      setActionError(`ลบข้อมูลล้มเหลว: ${error.message}`);
    }
  };

  const handleImportMembers = async (importedMembers: Member[]) => {
    setIsMembersLoading(true);
    setActionError(null);

    try {
      await memberService.replaceByBranches(importedMembers);
      const fresh = await memberService.getAll();
      setMembers(fresh);
    } catch (error) {
      console.error(error);
      setActionError("นำเข้าข้อมูลล้มเหลว");
    } finally {
      setIsMembersLoading(false);
    }
  };

  const handleReportLeave = async (memberId: string, type: 'War' | 'Personal') => {
    setActionError(null);
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    try {
      if (type === 'War') {
        const d = getThaiDate();
        const day = d.getUTCDay();
        const daysToAdd = (6 - day + 7) % 7;
        d.setUTCDate(d.getUTCDate() + daysToAdd);
        const warDate = toISOStringDate(d);

        const existingLeave = leaveRequests.find(l => l.memberId === memberId && l.warDate === warDate);

        if (existingLeave) {
          await leaveService.delete(existingLeave.id);
          setLeaveRequests(prev => prev.filter(l => l.id !== existingLeave.id));
          setMembers(prev => prev.map(m => m.id === memberId ? {
            ...m,
            warLeaveCount: Math.max(0, (m.warLeaveCount || 0) - 1),
            leaveCount: Math.max(0, m.leaveCount - 1)
          } : m));
        } else {
          const newLeave = await leaveService.create(memberId, member.branch, warDate);
          setLeaveRequests(prev => [...prev, newLeave]);
          setMembers(prev => prev.map(m => m.id === memberId ? {
            ...m,
            warLeaveCount: (m.warLeaveCount || 0) + 1,
            leaveCount: m.leaveCount + 1
          } : m));
        }
      } else {
        const d = getThaiDate();
        const todayDate = toISOStringDate(d);

        const existing = leaveRequests.find(l => l.memberId === memberId && l.warDate === todayDate);
        if (existing) {
          setActionError(`สมาชิกรายนี้มีการแจ้งลากิจสำหรับวันนี้ (${todayDate}) แล้ว`);
          return;
        }

        const newLeave = await leaveService.create(memberId, member.branch, todayDate);
        setLeaveRequests(prev => [...prev, newLeave]);
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, leaveCount: m.leaveCount + 1 } : m));
      }
    } catch (error: any) {
      console.error("Leave operation failed:", error);
      setActionError(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    setActionError(null);
    try {
      const leave = leaveRequests.find(l => l.id === leaveId);
      await leaveService.delete(leaveId);

      setLeaveRequests(prev => prev.filter(l => l.id !== leaveId));

      if (leave) {
        const leaveDate = new Date(leave.warDate);
        const isSaturday = leaveDate.getUTCDay() === 6;

        setMembers(prev => prev.map(m => m.id === leave.memberId ? {
          ...m,
          leaveCount: Math.max(0, m.leaveCount - 1),
          warLeaveCount: isSaturday ? Math.max(0, (m.warLeaveCount || 0) - 1) : m.warLeaveCount
        } : m));
      }
    } catch (error: any) {
      console.error("Failed to delete leave:", error);
      setActionError(`ลบข้อมูลล้มเหลว: ${error.message}`);
    }
  };

  const handleUpdateWarResult = async (eventId: string, result: WarResult) => {
    setActionError(null);
    try {
      await warHistoryService.updateResult(eventId, result);
      setWarHistory(prev => prev.map(ev => ev.id === eventId ? { ...ev, result } : ev));
    } catch (error: any) {
      console.error(error);
      setActionError(`ไม่สามารถบันทึกผลได้: ${error.message}`);
    }
  };

  const handleDeleteWarEvent = async (eventId: string) => {
    setActionError(null);
    try {
      await warHistoryService.delete(eventId);
      setWarHistory(prev => prev.filter(ev => ev.id !== eventId));
    } catch (error: any) {
      console.error(error);
      setActionError(`ไม่สามารถลบบันทึกได้: ${error.message}`);
    }
  };

  const handleWarExport = (data: Partial<WarEvent>) => {
    const newEvent: WarEvent = {
      id: Date.now().toString(),
      date: data.date || new Date().toISOString().split('T')[0],
      branch: data.branch || 'Inferno-1',
      subParties: data.subParties || [],
      groups: data.groups || [],
      snapshotLeaves: data.snapshotLeaves,
      snapshotReserves: data.snapshotReserves,
      ...data
    } as WarEvent;

    setWarHistory([newEvent, ...warHistory]);
  };

  const handleAddGameEvent = (event: GameEvent) => {
    setGameEvents([...gameEvents, event]);
  };

  const handleUpdateGroupConfig = (branch: Branch, groups: PartyGroup[]) => {
    setGroupConfigs(prev => {
      const existing = prev.filter(c => c.branch !== branch);
      return [...existing, { branch, groups }];
    });
  };

  const handleAddRegularWar = async (war: RegularWar) => {
    setActionError(null);
    try {
      const newWar = await regularWarService.create(war);
      setRegularWars(prev => [newWar, ...prev]);
    } catch (error: any) {
      console.error(error);
      setActionError(`บันทึกประวัติวอล้มเหลว: ${error.message}`);
    }
  };

  const handleDeleteRegularWar = async (id: string) => {
    setActionError(null);
    try {
      await regularWarService.delete(id);
      setRegularWars(prev => prev.filter(w => w.id !== id));
    } catch (error: any) {
      console.error(error);
      setActionError(`ลบรายการล้มเหลว: ${error.message}`);
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`relative w-full flex items-center px-4 py-3 text-sm font-medium transition-all mr-4 overflow-hidden whitespace-nowrap
        ${activeTab === id
          ? 'bg-red-50 text-red-700 md:border-l-4 md:border-red-600'
          : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
      title={!isDesktopExpanded ? label : ''}
    >
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        <Icon className={`w-5 h-5 ${activeTab === id ? 'text-red-600' : 'text-zinc-400'}`} />
      </div>
      <span className={`ml-3 transition-all duration-300 ${isDesktopExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 md:hidden lg:block'}`}></span>
      <span className={`ml-3 transition-all duration-300 md:block hidden ${isDesktopExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
        {label}
      </span>
    </button>
  );

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'แดชบอร์ด';
      case 'members': return 'สมาชิก';
      case 'builder': return 'จัดทัพวอ';
      case 'leave': return 'จัดการการลา';
      case 'history': return 'คลังข้อมูลสงคราม';
      case 'plans': return 'ประวัติวอ-ธรรมดา';
      default: return tab;
    }
  };

  const reloadMembers = async () => {
    setIsMembersLoading(true);
    try {
      const all = await memberService.getAll();
      setMembers(all);
    } finally {
      setIsMembersLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 font-sans">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-white border-b border-zinc-200 z-50 flex items-center justify-between px-4 shadow-sm">
        <span className="text-lg font-bold text-red-700 rpg-font">INFERNO</span>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-600">
          <Icons.Menu />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 bg-white border-r border-zinc-200 shadow-xl md:shadow-none
          transform transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${isDesktopExpanded ? 'md:w-64' : 'md:w-20'}
        `}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="p-4 h-16 flex items-center gap-3 overflow-hidden whitespace-nowrap border-b border-zinc-100/50">
          <button
            onClick={() => setIsSidebarLocked(!isSidebarLocked)}
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <Icons.Menu className="w-6 h-6" />
          </button>
          <div className={`transition-all duration-300 ${isDesktopExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
            <h1 className="text-xl font-bold text-zinc-900 rpg-font tracking-wider">
              INFERNO
            </h1>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          <NavItem id="dashboard" icon={Icons.Home} label="แดชบอร์ด" />
          <NavItem id="members" icon={Icons.Users} label="สมาชิก" />
          <NavItem id="builder" icon={Icons.Sword} label="จัดทัพวอ" />
          <NavItem id="leave" icon={Icons.Leave} label="จัดการการลา" />
          <NavItem id="history" icon={Icons.Calendar} label="ประวัติวอ" />
          <NavItem id="plans" icon={Icons.Map} label="ประวัติวอ-ธรรมดา" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-full pt-16 md:pt-0 bg-slate-50 relative">
        <div className="min-h-full w-full p-4 md:p-8 max-w-7xl mx-auto">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 rpg-font capitalize">{getPageTitle(activeTab)}</h2>
              <p className="text-zinc-500">จัดการกิลด์ของคุณอย่างมีประสิทธิภาพ</p>
            </div>
          </header>

          {(fetchError || actionError) && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r shadow-sm animate-fade-in relative" role="alert">
              <div className="flex justify-between items-start">
                <p className="font-bold flex items-center gap-2">
                  <Icons.Alert className="w-5 h-5" />
                  เกิดข้อผิดพลาด
                </p>
                {actionError && (
                  <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-700">
                    <Icons.X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-sm mt-1">{fetchError || actionError}</p>
            </div>
          )}

          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <Dashboard
                members={members}
                leaveRequests={leaveRequests}
                warHistory={warHistory}
                gameEvents={gameEvents}
                onAddEvent={handleAddGameEvent}
              />
            )}
            {activeTab === 'members' && (
              <Members
                members={members}
                leaveRequests={leaveRequests}
                isLoading={isMembersLoading}
                onAddMember={handleAddMember}
                onUpdateMember={handleUpdateMember}
                onDeleteMember={handleDeleteMember}
                onImportMembers={handleImportMembers}
                onReportLeave={handleReportLeave}
              />
            )}
            {activeTab === 'builder' && (
              <WarBuilder
                members={members}
                leaveRequests={leaveRequests}
                onExport={handleWarExport}
                groupConfigs={groupConfigs}
                onUpdateGroupConfig={handleUpdateGroupConfig}
                onReloadMembers={reloadMembers}
              />
            )}
            {activeTab === 'leave' && (
              <LeaveRequests
                members={members}
                requests={leaveRequests}
                onDeleteRequest={handleDeleteLeave}
              />
            )}
            {activeTab === 'history' && (
              <WarHistory
                history={warHistory}
                members={members}
                leaveRequests={leaveRequests}
                onUpdateResult={handleUpdateWarResult}
                onDeleteEvent={handleDeleteWarEvent}
              />
            )}
            {activeTab === 'plans' && (
              <RegularWarHistory
                wars={regularWars}
                onAddWar={handleAddRegularWar}
                onDeleteWar={handleDeleteRegularWar}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
