
import React, { useState } from 'react';
import { WarEvent, Branch, WarResult, Member, LeaveRequest } from '../types';
import { Card, Button, Modal, Input } from '../components/UI';
import { Icons, CLASS_DATA } from '../components/Icons';
import { BRANCHES, CLASS_CONFIG } from '../constants';

interface WarHistoryProps {
  history: WarEvent[];
  members: Member[];
  leaveRequests: LeaveRequest[];
  onUpdateResult: (eventId: string, result: WarResult) => void;
  onDeleteEvent: (eventId: string) => void;
}

export const WarHistory: React.FC<WarHistoryProps> = ({ history, members, leaveRequests, onUpdateResult, onDeleteEvent }) => {
  // Default to specific branch
  const [selectedBranch, setSelectedBranch] = useState<Branch>('Inferno-1');
  
  // Accordion State: Track which event ID is expanded
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Result Modal State
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState<WarResult>({
    outcome: 'Victory',
    opponent: '',
    ourScore: 0,
    enemyScore: 0,
    warPlanId: ''
  });

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const filteredHistory = history.filter(h => h.branch === selectedBranch);

  const handleToggleExpand = (id: string) => {
    if (expandedEventId === id) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(id);
    }
  };

  const handleOpenResultModal = (event: WarEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEventId(event.id);
    if (event.result) {
      setResultForm(event.result);
    } else {
      setResultForm({
        outcome: 'Victory',
        opponent: '',
        ourScore: 0,
        enemyScore: 0,
        warPlanId: ''
      });
    }
    setIsResultModalOpen(true);
  };

  const handleSaveResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEventId) {
      onUpdateResult(selectedEventId, resultForm);
      setIsResultModalOpen(false);
    }
  };
  
  const confirmDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTargetId(id);
    setIsDeleteModalOpen(true);
  };

  const handleExecuteDelete = () => {
    if (deleteTargetId) {
      onDeleteEvent(deleteTargetId);
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
    }
  };

  // Helper formatting date
  const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-2xl font-bold text-zinc-900 rpg-font">คลังข้อมูลสงคราม</h2>
            <p className="text-sm text-zinc-500">บันทึกผลการแข่งขันและจัดเก็บประวัติปาร์ตี้ (บันทึกอัตโนมัติทุกวันเสาร์ 21:00 น.)</p>
         </div>
      </div>
      
      {/* Branch Selector */}
      <div className="flex gap-2 border-b border-zinc-200 pb-2 overflow-x-auto hide-scrollbar">
         {BRANCHES.map(b => (
            <Button key={b} size="sm" variant={selectedBranch === b ? 'primary' : 'outline'} onClick={() => setSelectedBranch(b)}>{b}</Button>
         ))}
      </div>

      <div className="space-y-4">
        {filteredHistory.map(event => {
          const isExpanded = expandedEventId === event.id;
          const hasResult = !!event.result;
          const isVictory = hasResult && event.result?.outcome === 'Victory';
          
          // Calculate Dynamic Lists
          const absentRequests = leaveRequests.filter(l => l.warDate === event.date);
          const absentMemberIds = new Set(absentRequests.map(l => l.memberId));
          
          const assignedIds = new Set<string>();
          event.subParties.forEach(p => p.slots.forEach(s => { if(s.memberId) assignedIds.add(s.memberId) }));

          const reserveMembers = members.filter(m => 
             m.branch === event.branch && 
             m.status === 'Active' && 
             !assignedIds.has(m.id) && 
             !absentMemberIds.has(m.id)
          );

          return (
            <div 
              key={event.id} 
              className={`bg-white rounded-lg shadow-sm border transition-all duration-200 overflow-hidden cursor-pointer hover:shadow-md
                ${isExpanded ? (isVictory ? 'ring-2 ring-blue-500/20 border-blue-200' : 'ring-2 ring-red-500/20 border-red-200') : 'border-zinc-200'}
              `}
              onClick={() => handleToggleExpand(event.id)}
            >
              {/* Card Header (Summary) */}
              <div className={`
                 p-4 flex items-center justify-between gap-4
                 ${!isExpanded && hasResult ? (isVictory ? 'bg-gradient-to-r from-blue-50 to-white' : 'bg-gradient-to-r from-red-50 to-white') : 'bg-white'}
              `}>
                 <div className="flex items-center gap-4">
                    {/* Date Box */}
                    <div className="flex flex-col items-center justify-center bg-white border border-zinc-200 rounded p-2 min-w-[60px] shadow-sm">
                       <span className="text-[10px] text-zinc-400 font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                       <span className="text-xl font-bold text-zinc-800 leading-none">{new Date(event.date).getDate()}</span>
                    </div>

                    {/* Basic Info */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">
                              {event.branch}
                           </span>
                           {hasResult && (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${isVictory ? 'bg-blue-600 text-white border-blue-700' : 'bg-red-600 text-white border-red-700'}`}>
                                 {isVictory ? <Icons.Trophy className="w-3 h-3" /> : <Icons.Skull className="w-3 h-3" />}
                                 {isVictory ? 'VICTORY' : 'DEFEAT'}
                              </span>
                           )}
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 mt-1 flex items-center gap-2">
                           VS {hasResult ? event.result?.opponent : <span className="text-zinc-400 italic">รอการบันทึกผล</span>}
                        </h3>
                    </div>
                 </div>

                 {/* Scores & Chevron */}
                 <div className="flex items-center gap-6">
                    {hasResult && (
                       <div className="hidden md:flex items-center gap-3">
                          <div className="text-right">
                             <span className="block text-[10px] text-zinc-400 font-bold uppercase">เรา</span>
                             <span className={`block font-bold text-lg ${isVictory ? 'text-blue-700' : 'text-zinc-600'}`}>
                                {event.result?.ourScore.toLocaleString()}
                             </span>
                          </div>
                          <div className="text-zinc-300 font-light text-xl">/</div>
                          <div>
                             <span className="block text-[10px] text-zinc-400 font-bold uppercase">ศัตรู</span>
                             <span className={`block font-bold text-lg ${!isVictory ? 'text-red-700' : 'text-zinc-600'}`}>
                                {event.result?.enemyScore.toLocaleString()}
                             </span>
                          </div>
                       </div>
                    )}
                    
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} text-zinc-400`}>
                       <Icons.ChevronRight className="w-6 h-6 rotate-90" />
                    </div>
                 </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-zinc-100 animate-fade-in cursor-default" onClick={e => e.stopPropagation()}>
                   {/* Action Bar */}
                   <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={(e) => handleOpenResultModal(event, e)}>
                         <Icons.Edit className="w-4 h-4 mr-2" /> {hasResult ? 'แก้ไขผล' : 'บันทึกผล'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-red-600" onClick={(e) => confirmDelete(event.id, e)}>
                         <Icons.Trash className="w-4 h-4" /> ลบ
                      </Button>
                   </div>

                   {/* Detail Content */}
                   <div className="p-4 bg-zinc-50/30">
                      
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                         {/* MAIN CONTENT: PARTIES GRID */}
                         <div className="lg:col-span-3 space-y-4">
                             {/* Date & Title */}
                             <div className="bg-white rounded border border-zinc-200 p-3 flex items-center gap-3">
                                 <div className="p-2 bg-zinc-100 text-zinc-600 rounded-full"><Icons.Calendar className="w-4 h-4" /></div>
                                 <div>
                                    <p className="text-xs font-bold text-zinc-400 uppercase">วันที่ทำการแข่งขัน</p>
                                    <p className="font-bold text-zinc-900">
                                       {formatDate(event.date)}
                                    </p>
                                 </div>
                              </div>
                             
                             {/* PARTY LIST */}
                             <h4 className="text-sm font-bold text-zinc-700 uppercase tracking-wide flex items-center gap-2">
                                <Icons.Users className="w-4 h-4" /> ปาร์ตี้ที่ลงสนาม
                             </h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {event.subParties.filter(p => p.slots.some(s => s.memberId)).map(party => (
                                  <div key={party.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                                     <div className="bg-zinc-50 px-3 py-2 border-b border-zinc-100 flex justify-between items-center">
                                        <span className="text-xs font-bold text-zinc-700">{party.name}</span>
                                        <span className="text-[10px] text-zinc-400">{party.slots.filter(s => s.memberId).length}/6</span>
                                     </div>
                                     <div className="p-2 space-y-1">
                                        {party.slots.map((slot, idx) => {
                                           if (!slot.memberId) return null;
                                           const m = members.find(mem => mem.id === slot.memberId) || { name: 'Unknown Member', class: 'Ironclan', power: 0 };
                                           const classData = CLASS_DATA[m.class as any] || CLASS_DATA['Ironclan'];
                                           
                                           return (
                                              <div key={idx} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-zinc-50">
                                                 <div className={`w-5 h-5 rounded-full border border-zinc-200 overflow-hidden flex-shrink-0`}>
                                                    <img src={classData.img} className="w-full h-full object-cover" />
                                                 </div>
                                                 <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-zinc-800 truncate">{m.name}</div>
                                                    <div className="text-[9px] text-zinc-400 font-mono">{m.power.toLocaleString()} • {CLASS_CONFIG[m.class as any]?.th || m.class}</div>
                                                 </div>
                                              </div>
                                           );
                                        })}
                                        {party.slots.every(s => !s.memberId) && (
                                           <div className="text-center py-2 text-zinc-300 text-xs">ว่าง</div>
                                        )}
                                     </div>
                                  </div>
                                ))}
                             </div>
                         </div>

                         {/* SIDE STATS */}
                         <div className="space-y-4">
                             {/* Absent List */}
                             <Card noPadding className="bg-white border-zinc-200">
                                <div className="p-2 bg-red-50 border-b border-red-100">
                                   <h5 className="font-bold text-red-800 text-[10px] uppercase flex items-center gap-2">
                                      <Icons.Leave className="w-3 h-3" /> รายชื่อคนลา ({absentRequests.length})
                                   </h5>
                                </div>
                                <div className="p-2 max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                   {absentRequests.length > 0 ? (
                                      absentRequests.map((req) => {
                                         const member = members.find(m => m.id === req.memberId);
                                         return (
                                            <div key={req.id} className="flex justify-between text-[10px] border-b border-zinc-50 pb-1">
                                               <span className="font-bold text-zinc-700">{member?.name || 'Unknown'}</span>
                                               <span className="text-zinc-400 truncate max-w-[80px]">ลาวอ</span>
                                            </div>
                                         );
                                      })
                                   ) : (
                                      <p className="text-zinc-300 text-[10px] text-center">ไม่มีคนลา</p>
                                   )}
                                </div>
                             </Card>
                             
                             {/* Reserve List */}
                             <Card noPadding className="bg-white border-zinc-200">
                                <div className="p-2 bg-blue-50 border-b border-blue-100">
                                   <h5 className="font-bold text-blue-800 text-[10px] uppercase flex items-center gap-2">
                                      <Icons.Shield className="w-3 h-3" /> ตัวสำรอง ({reserveMembers.length})
                                   </h5>
                                </div>
                                <div className="p-2 max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                   {reserveMembers.length > 0 ? (
                                      reserveMembers.map((m) => (
                                         <div key={m.id} className="flex justify-between text-[10px] border-b border-zinc-50 pb-1">
                                            <span className="font-bold text-zinc-700">{m.name}</span>
                                            <span className="text-zinc-400 font-mono">{m.power.toLocaleString()}</span>
                                         </div>
                                      ))
                                   ) : (
                                      <p className="text-zinc-300 text-[10px] text-center">ไม่มีตัวสำรอง</p>
                                   )}
                                </div>
                             </Card>
                         </div>
                      </div>
                   </div>
                   
                   {!hasResult && (
                      <div className="p-8 text-center text-zinc-400 border-t border-zinc-100">
                         <Icons.Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                         <p>ยังไม่ได้บันทึกผลการแข่งขัน</p>
                         <Button size="sm" variant="outline" className="mt-4" onClick={(e) => handleOpenResultModal(event, e)}>บันทึกผลตอนนี้</Button>
                      </div>
                   )}
                </div>
              )}
            </div>
          );
        })}

        {filteredHistory.length === 0 && (
           <div className="text-center py-12 text-zinc-400 border-2 border-dashed border-zinc-200 rounded-lg bg-zinc-50">
              ไม่พบประวัติการวอสำหรับสาขานี้
           </div>
        )}
      </div>

      {/* Result Recording Modal */}
      <Modal 
        isOpen={isResultModalOpen} 
        onClose={() => setIsResultModalOpen(false)} 
        title="รายงานผลสงคราม"
        size="lg"
      >
         <form onSubmit={handleSaveResult} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Outcome & Score */}
               <div className="md:col-span-2 space-y-4 p-4 bg-zinc-50 rounded border border-zinc-200">
                  <label className="text-xs font-bold text-zinc-500 uppercase block">ผลการรบ</label>
                  <div className="flex gap-2 mb-4">
                     <button
                       type="button"
                       onClick={() => setResultForm({...resultForm, outcome: 'Victory'})}
                       className={`flex-1 py-3 rounded border font-bold flex items-center justify-center gap-2 transition-all ${resultForm.outcome === 'Victory' ? 'bg-blue-100 border-blue-300 text-blue-800 ring-2 ring-blue-300' : 'bg-white border-zinc-200 text-zinc-500'}`}
                     >
                       <Icons.Trophy className="w-5 h-5" /> Victory
                     </button>
                     <button
                       type="button"
                       onClick={() => setResultForm({...resultForm, outcome: 'Defeat'})}
                       className={`flex-1 py-3 rounded border font-bold flex items-center justify-center gap-2 transition-all ${resultForm.outcome === 'Defeat' ? 'bg-red-100 border-red-300 text-red-800 ring-2 ring-red-300' : 'bg-white border-zinc-200 text-zinc-500'}`}
                     >
                       <Icons.Skull className="w-5 h-5" /> Defeat
                     </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                     <div className="col-span-3 md:col-span-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">กิลด์คู่แข่ง</label>
                        <Input 
                          value={resultForm.opponent} 
                          onChange={e => setResultForm({...resultForm, opponent: e.target.value})}
                          placeholder="ชื่อกิลด์"
                          required
                        />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">คะแนนเรา</label>
                        <Input 
                          type="number"
                          value={resultForm.ourScore} 
                          onChange={e => setResultForm({...resultForm, ourScore: parseInt(e.target.value) || 0})}
                        />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">คะแนนศัตรู</label>
                        <Input 
                          type="number"
                          value={resultForm.enemyScore} 
                          onChange={e => setResultForm({...resultForm, enemyScore: parseInt(e.target.value) || 0})}
                        />
                     </div>
                  </div>
               </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
               <Button type="button" variant="ghost" onClick={() => setIsResultModalOpen(false)}>ยกเลิก</Button>
               <Button type="submit">บันทึกรายงาน</Button>
            </div>
         </form>
      </Modal>

      {/* Delete Confirmation Modal */}
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
               การกระทำนี้จะลบบันทึกสงครามและข้อมูลที่เกี่ยวข้องทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้
             </p>
          </div>
          
          <div className="flex gap-3 justify-center pt-2">
             <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">ยกเลิก</Button>
             <Button variant="danger" onClick={handleExecuteDelete} className="flex-1 bg-red-600 text-white hover:bg-red-700 border-transparent shadow-lg shadow-red-500/30">
               ยืนยันการลบ
             </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
