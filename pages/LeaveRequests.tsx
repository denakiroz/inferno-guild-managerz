
import React, { useState } from 'react';
import { LeaveRequest, Member, Branch } from '../types';
import { Card, Button, Badge, Modal } from '../components/UI';
import { Icons, CLASS_DATA } from '../components/Icons';
import { BRANCHES } from '../constants';

interface LeaveRequestsProps {
  members: Member[];
  requests: LeaveRequest[];
  onDeleteRequest: (id: string) => void;
}

export const LeaveRequests: React.FC<LeaveRequestsProps> = ({ members, requests, onDeleteRequest }) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch | 'All'>('All');
  
  // Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Helper: Get Thai Date Object (UTC+7)
  const getThaiDate = () => {
    const d = new Date();
    return new Date(d.getTime() + (7 * 60 * 60 * 1000));
  };

  // Helper: Format Date YYYY-MM-DD
  const toISOStringDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentThaiDate = getThaiDate();

  // Helper dates (Using Thai Time)
  const todayStr = toISOStringDate(currentThaiDate);

  // VIEWING LOGIC:
  // If Today is Saturday -> Show records for TODAY (Saturday)
  // If Today is Sun-Fri -> Show records for NEXT Saturday
  const activeWarDateStr = (() => {
    const d = getThaiDate();
    const day = d.getUTCDay(); // UTC Day of shifted object
    // If Sat (6), add 0. If Sun(0), add 6. If Fri(5), add 1.
    const daysToAdd = (6 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    return toISOStringDate(d);
  })();

  // Formatting date for header
  const formatHeaderDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  };

  // Helper to format date with Thai Day Name
  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return '-';
    // Safer Day Name Parsing
    const d = parseInt(dateStr.split('-')[2]);
    const m = parseInt(dateStr.split('-')[1]);
    
    const tempD = new Date(dateStr);
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dayName = days[tempD.getUTCDay()]; 

    return (
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-zinc-500">วัน{dayName}</span>
        <span className="text-sm font-bold text-zinc-900">{d}/{m}</span>
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

  // Group requests by member
  const groupedLeaves = members
    .filter(m => selectedBranch === 'All' || m.branch === selectedBranch)
    .map(member => {
      // Find requests for this member
      const memberRequests = requests.filter(r => r.memberId === member.id);
      
      // Identify War Leave (Match our Active War Date)
      const warLeave = memberRequests.find(r => r.warDate === activeWarDateStr);
      
      // Identify Personal Leave (Match Today AND NOT War Date)
      const personalLeave = memberRequests.find(r => r.warDate === todayStr && r.warDate !== activeWarDateStr); 
      
      return {
        member,
        warLeave,
        personalLeave,
        hasLeave: !!warLeave || !!personalLeave
      };
    })
    .filter(item => item.hasLeave); // Show only members with at least one leave

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-zinc-50 to-white">
        <div>
           <h2 className="text-xl font-bold text-zinc-900 rpg-font">จัดการการลา</h2>
           <p className="text-zinc-500 text-sm mt-1">
             รายการสมาชิกที่ลาในสาขา: <span className="font-bold text-red-700">{selectedBranch === 'All' ? 'ทั้งหมด' : selectedBranch}</span>
           </p>
        </div>
      </Card>

      {/* Filters & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 hide-scrollbar">
             <Button size="sm" variant={selectedBranch === 'All' ? 'primary' : 'outline'} onClick={() => setSelectedBranch('All')}>ทั้งหมด</Button>
             {BRANCHES.map(b => (
               <Button key={b} size="sm" variant={selectedBranch === b ? 'primary' : 'outline'} onClick={() => setSelectedBranch(b)}>{b}</Button>
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
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">ไม่พบข้อมูลการลาในขณะนี้</td>
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
                                onClick={(e) => { 
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
                                onClick={(e) => { 
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

        {/* High Absence List */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
               <Icons.Alert className="w-5 h-5 text-red-500" /> ขาดลาบ่อย ({selectedBranch === 'All' ? 'ทุกสาขา' : selectedBranch})
            </h3>
            <p className="text-xs text-zinc-500 mb-3">*นับเฉพาะการลาวันเสาร์ (War Days)</p>
            <div className="space-y-3">
              {members
                .filter(m => (selectedBranch === 'All' || m.branch === selectedBranch) && (m.warLeaveCount || 0) >= 1) 
                .sort((a, b) => (b.warLeaveCount || 0) - (a.warLeaveCount || 0))
                .slice(0, 10)
                .map(m => (
                  <div key={m.id} className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-100">
                     <span className="text-sm font-medium text-red-900">{m.name}</span>
                     <Badge color="red">{m.warLeaveCount} ครั้ง</Badge>
                  </div>
              ))}
              {members.filter(m => (selectedBranch === 'All' || m.branch === selectedBranch) && (m.warLeaveCount || 0) >= 1).length === 0 && (
                <p className="text-sm text-zinc-400">ไม่มีสมาชิกที่มีประวัติขาดลาบ่อย (ลาวอร์)</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="ยืนยันการลบข้อมูล"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Icons.Trash className="w-8 h-8 text-red-600" />
             </div>
             <h3 className="text-lg font-bold text-zinc-900 mb-2">คุณแน่ใจหรือไม่?</h3>
             <p className="text-sm text-zinc-500">
               การกระทำนี้จะลบประวัติการลาของสมาชิกออกทันที
             </p>
          </div>
          
          <div className="flex gap-3 justify-center pt-2">
             <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">ยกเลิก</Button>
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
