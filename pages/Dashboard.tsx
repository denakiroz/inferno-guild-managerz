
import React, { useState, useMemo } from 'react';
import { Member, LeaveRequest, WarEvent, GameEvent } from '../types';
import { Card, Badge, Button, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardProps {
  members: Member[];
  leaveRequests: LeaveRequest[];
  warHistory: WarEvent[];
  gameEvents: GameEvent[];
  onAddEvent: (event: GameEvent) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ members, leaveRequests, warHistory, gameEvents, onAddEvent }) => {
  // Stats Calculation
  const totalMembers = members.length;
  // High Leave = > 2 War Leaves (Saturdays)
  const highLeaveMembers = members.filter(m => (m.warLeaveCount || 0) > 2).length;
  
  // Dynamic Monthly Stats from History
  const monthlyStats = useMemo(() => {
     const stats: Record<string, { leaves: number, wars: number }> = {};
     const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
     
     // Helper
     const getKey = (dateStr: string) => {
        const d = new Date(dateStr);
        return monthNames[d.getMonth()];
     };

     // Init current months (e.g., last 4 months) to ensure order or just let data drive it
     // Letting data drive it for now
     
     // Process Leaves (History)
     leaveRequests.forEach(l => {
        const key = getKey(l.warDate);
        if (!stats[key]) stats[key] = { leaves: 0, wars: 0 };
        stats[key].leaves++;
     });
     
     // Process Wars (History)
     warHistory.forEach(w => {
        const key = getKey(w.date);
        if (!stats[key]) stats[key] = { leaves: 0, wars: 0 };
        stats[key].wars++;
     });

     // Default mock if empty for visual
     if (Object.keys(stats).length === 0) {
        return [
           { name: 'ส.ค.', leaves: 0, wars: 0 },
           { name: 'ก.ย.', leaves: 0, wars: 0 },
           { name: 'ต.ค.', leaves: 0, wars: 0 },
           { name: 'พ.ย.', leaves: 0, wars: 0 },
        ];
     }

     return Object.entries(stats).map(([name, val]) => ({ name, ...val }));
  }, [leaveRequests, warHistory]);


  // --- Calendar State & Logic ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  
  // Event Form State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState<'Activity' | 'Meeting' | 'Other'>('Activity');

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;
    
    onAddEvent({
      id: Date.now().toString(),
      title: newEventTitle,
      date: newEventDate,
      type: newEventType
    });
    
    setNewEventTitle('');
    setNewEventDate('');
    setIsEventModalOpen(false);
  };

  // Generate Calendar Grid
  const renderCalendarDays = () => {
    const days = [];
    // Padding for prev month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`pad-${i}`} className="bg-zinc-50/50 min-h-[100px] border border-zinc-100/50" />);
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayObj = new Date(year, month, d);
      const isSaturday = dayObj.getDay() === 6;
      const isToday = new Date().toDateString() === dayObj.toDateString();

      // Find events for this day
      const daysEvents = gameEvents.filter(e => e.date === dateStr);

      days.push(
        <div key={`day-${d}`} className={`min-h-[100px] bg-white border border-zinc-200 p-2 relative group hover:border-red-200 transition-colors ${isToday ? 'ring-2 ring-red-500 ring-inset' : ''}`}>
          <div className="flex justify-between items-start mb-1">
             <span className={`text-sm font-bold ${isSaturday ? 'text-red-600' : 'text-zinc-700'}`}>{d}</span>
             {isSaturday && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded uppercase tracking-tighter">วอ</span>
             )}
          </div>
          
          <div className="space-y-1">
             {/* Auto-Event for Saturday */}
             {isSaturday && (
               <div className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm truncate">
                 วอกิลด์
               </div>
             )}
             
             {/* Custom Events */}
             {daysEvents.map(event => (
               <div 
                 key={event.id} 
                 title={event.title}
                 className={`text-[10px] px-1.5 py-0.5 rounded shadow-sm truncate cursor-pointer
                   ${event.type === 'Meeting' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}
                 `}
               >
                 {event.title}
               </div>
             ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-600 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">สมาชิกทั้งหมด</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">{totalMembers}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <Icons.Users className="text-red-600 w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">คำขอลาสะสม</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">{leaveRequests.length}</h3>
              <p className="text-xs text-zinc-400 mt-1">ประวัติทั้งหมด</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-full">
              <Icons.Leave className="text-amber-500 w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-zinc-800 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">บันทึกสงคราม</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">{warHistory.length}</h3>
              <p className="text-xs text-zinc-400 mt-1">ที่บันทึกแล้ว</p>
            </div>
            <div className="p-3 bg-zinc-100 rounded-full">
              <Icons.Sword className="text-zinc-800 w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">ขาดลาบ่อย</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">{highLeaveMembers}</h3>
              <p className="text-xs text-zinc-400 mt-1">ลาวอร์เกิน 2 ครั้ง</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Icons.Alert className="text-blue-500 w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <div className="xl:col-span-2">
           <Card className="h-full flex flex-col">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold text-zinc-900 rpg-font flex items-center gap-2">
                    <Icons.Calendar className="w-5 h-5 text-red-600" />
                    ปฏิทินกิลด์
                  </h3>
                  <div className="flex items-center bg-zinc-100 rounded-md p-1">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm transition-all"><Icons.ChevronRight className="w-4 h-4 rotate-180" /></button>
                    <span className="px-3 text-sm font-bold text-zinc-700 min-w-[120px] text-center">{monthNames[month]} {year}</span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm transition-all"><Icons.ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <Button size="sm" onClick={() => setIsEventModalOpen(true)}>
                   <div className="flex items-center gap-1">
                     <span className="text-lg leading-none mb-0.5">+</span> กิจกรรม
                   </div>
                </Button>
             </div>

             {/* Days Header */}
             <div className="grid grid-cols-7 border-b border-zinc-200 mb-2">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => (
                  <div key={d} className={`text-center text-xs font-bold uppercase py-2 ${i === 6 ? 'text-red-600' : 'text-zinc-400'}`}>{d}</div>
                ))}
             </div>

             {/* Calendar Grid */}
             <div className="grid grid-cols-7 bg-zinc-100 border-l border-t border-zinc-200">
                {renderCalendarDays()}
             </div>
             
             <div className="mt-4 flex gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> วอกิลด์</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> ประชุม</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> กิจกรรม</div>
             </div>
           </Card>
        </div>

        {/* Sidebar Stats (Combined) */}
        <div className="space-y-6">
           {/* Chart */}
           <Card className="h-72">
             <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
               <Icons.Activity className="w-4 h-4 text-zinc-400" />
               ประวัติการลา (รายเดือน)
             </h3>
             <ResponsiveContainer width="100%" height="85%">
               <BarChart data={monthlyStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                 <XAxis dataKey="name" stroke="#a1a1aa" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                 <YAxis stroke="#a1a1aa" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                 <Tooltip 
                    cursor={{ fill: '#f4f4f5' }}
                    contentStyle={{ fontSize: '12px' }}
                 />
                 <Bar dataKey="leaves" name="การลา" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={20} />
                 <Bar dataKey="wars" name="วอ" fill="#18181b" radius={[2, 2, 0, 0]} barSize={20} />
               </BarChart>
             </ResponsiveContainer>
           </Card>

           {/* Alerts */}
           <Card className="flex-1">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2 uppercase tracking-wide">
                 <Icons.Alert className="w-4 h-4 text-amber-500" />
                 แจ้งเตือนขาดลา
               </h3>
               {highLeaveMembers > 0 && <Badge color="red">{highLeaveMembers}</Badge>}
             </div>
             
             <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {members
                  .filter(m => (m.warLeaveCount || 0) > 2)
                  .map(m => (
                   <div key={m.id} className="flex gap-3 p-3 rounded bg-amber-50 border border-amber-100">
                      <div>
                        <p className="text-sm text-zinc-900 font-semibold">{m.name}</p>
                        <p className="text-xs text-zinc-500">ลาวอร์ {m.warLeaveCount} ครั้ง</p>
                      </div>
                    </div>
                ))}
                {highLeaveMembers === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-4">ไม่มีสมาชิกที่ลาวอร์เกิน 2 ครั้ง</p>
                )}
             </div>
           </Card>
        </div>
      </div>

      {/* Add Event Modal */}
      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="เพิ่มกิจกรรมกิลด์">
        <form onSubmit={handleSaveEvent} className="space-y-4">
           <div>
             <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">ชื่อกิจกรรม</label>
             <Input 
               required
               placeholder="เช่น ประชุมหัวหน้าทีม" 
               value={newEventTitle}
               onChange={e => setNewEventTitle(e.target.value)}
             />
           </div>
           
           <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">วันที่</label>
              <Input 
                type="date"
                required
                value={newEventDate}
                onChange={e => setNewEventDate(e.target.value)}
              />
           </div>

           <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">ประเภท</label>
              <Select 
                value={newEventType}
                onChange={e => setNewEventType(e.target.value as any)}
              >
                <option value="Activity">กิจกรรมในเกม</option>
                <option value="Meeting">ประชุม</option>
                <option value="Other">อื่นๆ</option>
              </Select>
           </div>

           <div className="flex justify-end gap-2 pt-4">
             <Button type="button" variant="ghost" onClick={() => setIsEventModalOpen(false)}>ยกเลิก</Button>
             <Button type="submit">สร้างกิจกรรม</Button>
           </div>
        </form>
      </Modal>
    </div>
  );
};
