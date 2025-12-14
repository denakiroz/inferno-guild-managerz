import React, { useCallback, useMemo, useState } from 'react';
import { LeaveRequest, Member, Branch } from '../types';
import { Card, Button, Badge, Modal } from '../components/UI';
import { Icons, CLASS_DATA } from '../components/Icons';
import { BRANCHES } from '../constants';

interface LeaveRequestsProps {
  members: Member[];
  requests: LeaveRequest[];
  onDeleteRequest: (id: string) => void;
}

type LeaveStat = {
  warMonth: number;
  personalMonth: number;
  warAll: number;
  personalAll: number;
};

export const LeaveRequests: React.FC<LeaveRequestsProps> = ({ members, requests, onDeleteRequest }) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch | 'All'>('All');

  // Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Helper: Get Thai Date Object (UTC+7)
  const getThaiDate = () => {
    const d = new Date();
    return new Date(d.getTime() + 7 * 60 * 60 * 1000);
  };

  // Helper: Format Date YYYY-MM-DD
  const toISOStringDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentThaiDate = useMemo(() => getThaiDate(), []);
  const todayStr = useMemo(() => toISOStringDate(getThaiDate()), []);

  // Month key: YYYY-MM (Thai Time)
  const monthKey = useMemo(() => {
    const d = getThaiDate();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const isThisMonth = (dateStr: string) => (dateStr || '').slice(0, 7) === monthKey;

  // VIEWING LOGIC:
  // If Today is Saturday -> Show records for TODAY (Saturday)
  // If Today is Sun-Fri -> Show records for NEXT Saturday
  const activeWarDateStr = useMemo(() => {
    const d = getThaiDate();
    const day = d.getUTCDay();
    const daysToAdd = (6 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    return toISOStringDate(d);
  }, []);

  // Formatting date for header
  const formatHeaderDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  };

  // Helper to format date with Thai Day Name
  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = parseInt(dateStr.split('-')[2]);
    const m = parseInt(dateStr.split('-')[1]);

    const tempD = new Date(dateStr);
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dayName = days[tempD.getUTCDay()];

    return (
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-zinc-500">วัน{dayName}</span>
        <span className="text-sm font-bold text-zinc-900">
          {d}/{m}
        </span>
      </span>
    );
  };

  const initiateDelete = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      onDeleteRequest(deleteTargetId);
      setDeleteTargetId(null);
      setIsDeleteModalOpen(false);
    }
  };

  // Group requests by member (ตารางซ้าย: เดิม)
  const groupedLeaves = members
    .filter(m => selectedBranch === 'All' || m.branch === selectedBranch)
    .map(member => {
      const memberRequests = requests.filter(r => r.memberId === member.id);

      const warLeave = memberRequests.find(r => r.warDate === activeWarDateStr);

      const personalLeave = memberRequests.find(r => r.warDate === todayStr && r.warDate !== activeWarDateStr);

      return {
        member,
        warLeave,
        personalLeave,
        hasLeave: !!warLeave || !!personalLeave
      };
    })
    .filter(item => item.hasLeave);

  // ===== ✅ สถิติ (แยก ลาวอ/ลากิจ + เดือนนี้/ทั้งหมด) =====
  const statsByMember = useMemo(() => {
    const map = new Map<string, LeaveStat>();

    const ensure = (memberId: string) => {
      if (!map.has(memberId)) {
        map.set(memberId, { warMonth: 0, personalMonth: 0, warAll: 0, personalAll: 0 });
      }
      return map.get(memberId)!;
    };

    requests.forEach(r => {
      const stat = ensure(r.memberId);
      const d = new Date(r.warDate);
      const isWar = d.getUTCDay() === 6; // เสาร์ = ลาวอ
      const inMonth = isThisMonth(r.warDate);

      if (isWar) {
        stat.warAll += 1;
        if (inMonth) stat.warMonth += 1;
      } else {
        stat.personalAll += 1;
        if (inMonth) stat.personalMonth += 1;
      }
    });

    return map;
  }, [requests, monthKey]);

  const branchMembers = useMemo(
    () => members.filter(m => selectedBranch === 'All' || m.branch === selectedBranch),
    [members, selectedBranch]
  );

  const topList = useCallback(
    (key: keyof LeaveStat, limit = 10) => {
      return branchMembers
        .map(m => ({
          ...m,
          count: statsByMember.get(m.id)?.[key] || 0
        }))
        .filter(m => m.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },
    [branchMembers, statsByMember]
  );

  // (ไม่ใช้ useCallback import เดิมไม่ได้มี) -> ทำเป็น useMemo wrapper ให้ UI ไม่เพี้ยน
  const topWarMonth = useMemo(() => topList('warMonth', 10), [topList]);
  const topPersonalMonth = useMemo(() => topList('personalMonth', 10), [topList]);
  const topWarAll = useMemo(() => topList('warAll', 10), [topList]);
  const topPersonalAll = useMemo(() => topList('personalAll', 10), [topList]);

  const renderTopBox = (
    title: string,
    subtitle: string,
    items: Array<Member & { count: number }>,
    badgeColor: 'red' | 'yellow' | 'ิblue'
  ) => {
    const emptyText =
      badgeColor === 'red'
        ? 'ไม่มีสมาชิกที่มีประวัติลาวอ'
        : badgeColor === 'yellow'
        ? 'ไม่มีสมาชิกที่มีประวัติลากิจ'
        : 'ไม่มีข้อมูล';

    return (
      <Card>
        <h3 className="font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Icons.Alert className={`w-5 h-5 ${badgeColor === 'red' ? 'text-red-500' : badgeColor === 'yellow' ? 'text-amber-500' : 'text-zinc-500'}`} />
          {title} ({selectedBranch === 'All' ? 'ทุกสาขา' : selectedBranch})
        </h3>
        <p className="text-xs text-zinc-500 mb-3">{subtitle}</p>

        <div className="space-y-3">
          {items.map(m => (
            <div
              key={m.id}
              className={`flex justify-between items-center p-2 rounded border ${
                badgeColor === 'red'
                  ? 'bg-red-50 border-red-100'
                  : badgeColor === 'yellow'
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <span className={`text-sm font-medium ${badgeColor === 'red' ? 'text-red-900' : badgeColor === 'yellow' ? 'text-amber-900' : 'text-zinc-900'}`}>
                {m.name}
              </span>
              {badgeColor === 'red' ? (
                <Badge color="red">{m.count} ครั้ง</Badge>
              ) : badgeColor === 'yellow' ? (
                <Badge color="blue">{m.count} ครั้ง</Badge>
              ) : (
                <Badge>{m.count} ครั้ง</Badge>
              )}
            </div>
          ))}

          {items.length === 0 && <p className="text-sm text-zinc-400">{emptyText}</p>}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Info (เดิม) */}
      <Card className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-zinc-50 to-white">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 rpg-font">จัดการการลา</h2>
          <p className="text-zinc-500 text-sm mt-1">
            รายการสมาชิกที่ลาในสาขา:{' '}
            <span className="font-bold text-red-700">{selectedBranch === 'All' ? 'ทั้งหมด' : selectedBranch}</span>
          </p>
        </div>
      </Card>

      {/* Filters & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ตารางซ้าย (เดิม) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 hide-scrollbar">
            <Button size="sm" variant={selectedBranch === 'All' ? 'primary' : 'outline'} onClick={() => setSelectedBranch('All')}>
              ทั้งหมด
            </Button>
            {BRANCHES.map(b => (
              <Button key={b} size="sm" variant={selectedBranch === b ? 'primary' : 'outline'} onClick={() => setSelectedBranch(b)}>
                {b}
              </Button>
            ))}
          </div>

          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-3 w-1/3">สมาชิก</th>
                    <th className="px-6 py-3 w-1/3">ลากิจ (วันนี้)</th>
                    <th className="px-6 py-3 w-1/3 text-red-700">ลาวอ ({formatHeaderDate(activeWarDateStr)})</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedLeaves.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">
                        ไม่พบข้อมูลการลาในขณะนี้
                      </td>
                    </tr>
                  )}

                  {groupedLeaves.map(({ member, personalLeave, warLeave }) => (
                    <tr key={member.id} className="bg-white border-b border-zinc-100 hover:bg-zinc-50">
                      {/* Member Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full border-2 overflow-hidden flex-shrink-0 ${CLASS_DATA[member.class].color}`}>
                            <img src={CLASS_DATA[member.class].img} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900">{member.name}</div>
                            <div className="text-xs text-zinc-400 font-normal mt-0.5">
                              <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded mr-2 border border-zinc-200">{member.branch}</span>
                              <span className="font-mono">Total: {member.leaveCount}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Personal Leave Column */}
                      <td className="px-6 py-4">
                        {personalLeave ? (
                          <div className="flex items-center justify-between gap-2 bg-zinc-50 p-2 rounded border border-zinc-200">
                            {formatDateWithDay(personalLeave.warDate)}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-zinc-400 hover:text-red-600 h-8 w-8 p-0 flex items-center justify-center cursor-pointer relative z-10"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                initiateDelete(personalLeave.id);
                              }}
                              title="ยกเลิกลากิจ"
                            >
                              <Icons.Trash className="w-4 h-4 pointer-events-none" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-xs">-</span>
                        )}
                      </td>

                      {/* War Leave Column */}
                      <td className="px-6 py-4">
                        {warLeave ? (
                          <div className="flex items-center justify-between gap-2 bg-red-50 p-2 rounded border border-red-100">
                            {formatDateWithDay(warLeave.warDate)}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-700 h-8 w-8 p-0 flex items-center justify-center cursor-pointer relative z-10"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                initiateDelete(warLeave.id);
                              }}
                              title="ยกเลิกการลาวอ"
                            >
                              <Icons.Trash className="w-4 h-4 pointer-events-none" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ฝั่งขวา: ✅ 4 กล่อง (คงโทน UI เดิม) */}
        <div className="space-y-4">
          {renderTopBox(
            'ลาวอ (เดือนนี้)',
            `*นับเฉพาะเดือน ${monthKey} (วันเสาร์)`,
            topWarMonth as any,
            'red'
          )}

          {renderTopBox(
            'ลากิจ (เดือนนี้)',
            `*นับเฉพาะเดือน ${monthKey} (ไม่ใช่วันเสาร์)`,
            topPersonalMonth as any,
            'yellow'
          )}

          {renderTopBox(
            'ลาวอทั้งหมด',
            '*นับทั้งหมด (วันเสาร์)',
            topWarAll as any,
            'red'
          )}

          {renderTopBox(
            'ลากิจทั้งหมด',
            '*นับทั้งหมด (ไม่ใช่วันเสาร์)',
            topPersonalAll as any,
            'yellow'
          )}
        </div>
      </div>

      {/* Confirmation Modal (เดิม) */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="ยืนยันการลบข้อมูล" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Icons.Trash className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">คุณแน่ใจหรือไม่?</h3>
            <p className="text-sm text-zinc-500">การกระทำนี้จะลบประวัติการลาของสมาชิกออกทันที</p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
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
