
import React, { useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { Member, Branch, CharacterClass, LeaveRequest } from '../types';
import { Card, Button, Badge, Input, Select, Modal } from '../components/UI';
import { Icons, ClassIcon, CLASS_DATA } from '../components/Icons';
import { BRANCHES, CLASSES, CLASS_CONFIG } from '../constants';

interface MembersProps {
  members: Member[];
  leaveRequests: LeaveRequest[];
  isLoading?: boolean; 
  onAddMember: (member: Member) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onReportLeave: (memberId: string, type: 'War' | 'Personal') => void; 
  onImportMembers: (members: Member[]) => void;
}

export const Members: React.FC<MembersProps> = ({ members, leaveRequests, isLoading = false, onAddMember, onUpdateMember, onDeleteMember, onReportLeave, onImportMembers }) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch | 'All'>('All');
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<CharacterClass | 'All'>('All');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  
  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetMember, setDeleteTargetMember] = useState<Member | null>(null);
  
  // Leave Modal
  const [leaveModalMember, setLeaveModalMember] = useState<Member | null>(null);
  
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Import Error State
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<Member>>({
    name: '',
    class: 'Ironclan',
    power: 0,
    branch: 'Inferno-1',
    status: 'Active',
    leaveCount: 0
  });

  // Import State
  const [importText, setImportText] = useState('');

  // --- TIME & DATE LOGIC (THAI TIME) ---
  const getThaiDate = () => {
    const d = new Date();
    return new Date(d.getTime() + (7 * 60 * 60 * 1000));
  };

  const toISOStringDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentThaiDate = getThaiDate();
  const todayStr = toISOStringDate(currentThaiDate);
  const isSaturdayToday = currentThaiDate.getUTCDay() === 6;

  // Booking Target Date Calculation
  // If today is Saturday (6), booking targets TODAY (0 days).
  // If today is Sun(0), booking targets Next Sat (6 days).
  const bookingWarDateStr = (() => {
    const d = getThaiDate();
    const day = d.getUTCDay();
    
    // Calculate days to next Saturday (0 if today is Saturday)
    const daysToAdd = (6 - day + 7) % 7;
    
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    return toISOStringDate(d);
  })();

  // Formatting booking date for display
  const formatBookingDate = (dateStr: string) => {
     const [y, m, d] = dateStr.split('-');
     return `${d}/${m}`;
  };

  // --- Filtering Logic ---
  const filteredMembers = members.filter(m => {
    // 1. Branch Filter
    const matchBranch = selectedBranch === 'All' || m.branch === selectedBranch;
    
    // 2. Name Search
    const lowerSearch = searchTerm.toLowerCase();
    const matchSearch = !searchTerm || 
                        m.name.toLowerCase().includes(lowerSearch) || 
                        CLASS_CONFIG[m.class].display.toLowerCase().includes(lowerSearch) ||
                        CLASS_CONFIG[m.class].th.includes(lowerSearch);

    // 3. Class Filter
    const matchClass = filterClass === 'All' || m.class === filterClass;

    return matchBranch && matchSearch && matchClass;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterClass('All');
  };

  const handleExport = () => {
    if (filteredMembers.length === 0) {
      // Use simple console log if alert blocked
      console.warn("ไม่พบข้อมูลสมาชิกสำหรับส่งออก");
      return;
    }

    const exportData = filteredMembers.map(m => ({
      'ชื่อ': m.name,
      'อาชีพ': CLASS_CONFIG[m.class].th, 
      'พลัง': m.power,
      'กิลด์': m.branch.split('-')[1] || '' // Extract 1, 2, 3
    }));

    const ws = utils.json_to_sheet(exportData);
    
    // Apply styling to header row
    const range = utils.decode_range(ws['!ref'] || 'A1:D1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = utils.encode_cell({ r: 0, c: C }); // Row 0 is header
      if (!ws[address]) continue;
      
      // Style object (supported by some xlsx versions/forks)
      ws[address].s = {
        fill: { fgColor: { rgb: "FFFF00" } }, // Yellow Background
        font: { bold: true }
      };
    }

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Members");
    
    const dateStr = new Date().toISOString().split('T')[0];
    const branchStr = selectedBranch === 'All' ? 'All' : selectedBranch;
    writeFile(wb, `Inferno_Members_${branchStr}_${dateStr}.xlsx`);
  };

  const handleOpenModal = (member?: Member) => {
    if (member) {
      setEditingMember(member);
      setFormData(member);
    } else {
      setEditingMember(null);
      const defaultBranch = selectedBranch !== 'All' ? selectedBranch : 'Inferno-1';
      setFormData({
        name: '',
        class: 'Ironclan',
        power: 0,
        branch: defaultBranch,
        status: 'Active',
        leaveCount: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      onUpdateMember({ ...editingMember, ...formData } as Member);
    } else {
      const newMember: Member = {
        id: `temp-${Date.now()}`, 
        joinDate: new Date().toISOString().split('T')[0],
        ...formData
      } as Member;
      onAddMember(newMember);
    }
    setIsModalOpen(false);
  };

  const initiateDelete = (member: Member) => {
    setDeleteTargetMember(member);
    setIsDeleteModalOpen(true);
    // Close edit modal if open
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteTargetMember) {
      onDeleteMember(deleteTargetMember.id);
      setIsDeleteModalOpen(false);
      setDeleteTargetMember(null);
    }
  };

  const handleLeaveClick = (member: Member) => {
    setLeaveModalMember(member);
  };

  const confirmLeave = (type: 'War' | 'Personal') => {
    if (leaveModalMember) {
      onReportLeave(leaveModalMember.id, type);
      setLeaveModalMember(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const textData = utils.sheet_to_csv(worksheet, { FS: '\t' });
      setImportText(textData);
    } catch (error) {
      setImportErrors(["ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง"]);
      setIsErrorModalOpen(true);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleImportSubmit = () => {
    setIsImporting(true);
    setImportErrors([]);

    setTimeout(() => {
      try {
        const rows = importText.trim().split('\n');
        const newMembers: Member[] = [];
        const errors: string[] = [];
        let idCounter = 1000;

        rows.forEach((row, index) => {
          const trimmedRow = row.trim();
          if (!trimmedRow) return;

          const cols = trimmedRow.split(/[\t,]+/).map(c => c.trim());
          if (cols[0].toLowerCase() === 'name' || cols[0].toLowerCase() === 'id' || cols[0] === 'ชื่อ') return;

          const name = cols[0];
          if (!name) { errors.push(`Row ${index + 1}: ไม่พบชื่อ`); return; }

          const rawClass = cols[1]?.toLowerCase() || '';
          let charClass: CharacterClass = 'Ironclan';
          
          let matchedClass: CharacterClass | null = null;
          if (rawClass === '1') matchedClass = 'Ironclan';
          else if (rawClass === '2') matchedClass = 'Bloodstorm';
          else if (rawClass === '3') matchedClass = 'Celestune';
          else if (rawClass === '4') matchedClass = 'Sylph';
          else if (rawClass === '5') matchedClass = 'Numina';
          else if (rawClass === '6') matchedClass = 'Nightwalker';
          else {
            for (const key of CLASSES) {
              const cfg = CLASS_CONFIG[key];
              if (rawClass.includes(cfg.en.toLowerCase()) || rawClass.includes(cfg.th) || rawClass.includes(cfg.display)) {
                matchedClass = key;
                break;
              }
            }
          }

          if (matchedClass) { charClass = matchedClass; } 
          else { errors.push(`${name}: ไม่รู้จักอาชีพ '${cols[1]}'`); return; }

          const powerStr = cols[2]?.replace(/[^0-9]/g, '');
          if (!powerStr || isNaN(parseInt(powerStr))) { errors.push(`${name}: พลังไม่ถูกต้อง`); return; }
          const power = parseInt(powerStr);

          // Handle Branch from 4th column if exists
          let branch: Branch = selectedBranch !== 'All' ? selectedBranch : 'Inferno-1';
          const guildCol = cols[3]?.trim();
          if (guildCol) {
             if (guildCol === '1') branch = 'Inferno-1';
             else if (guildCol === '2') branch = 'Inferno-2';
             else if (guildCol === '3') branch = 'Inferno-3';
             // If invalid 4th column, fallback to current default
          }

          newMembers.push({
            id: `imp-${branch}-${idCounter++}`,
            name: name,
            class: charClass,
            power: power,
            branch: branch,
            status: 'Active',
            joinDate: new Date().toISOString().split('T')[0],
            leaveCount: 0,
            warLeaveCount: 0,
            generalLeaveCount: 0
          });
        });

        if (errors.length > 0) {
          setImportErrors(errors);
          setIsErrorModalOpen(true);
        } else if (newMembers.length > 0) {
          onImportMembers(newMembers);
          setIsImportModalOpen(false);
          setImportText('');
        }
      } catch (e) {
        setImportErrors(["เกิดข้อผิดพลาดในการอ่านข้อมูล"]);
        setIsErrorModalOpen(true);
      } finally {
        setIsImporting(false);
      }
    }, 500);
  };

  // Check leave status for modal member
  const modalMemberLeaveStatus = leaveModalMember ? {
    isPersonalTaken: leaveRequests.some(r => r.memberId === leaveModalMember.id && r.warDate === todayStr),
    // Check if booked for the TARGET date (not necessarily today if Saturday)
    isWarTaken: leaveRequests.some(r => r.memberId === leaveModalMember.id && r.warDate === bookingWarDateStr)
  } : { isPersonalTaken: false, isWarTaken: false };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Toolbar */}
      <Card noPadding className="sticky top-0 z-10 shadow-sm transition-all border border-zinc-200">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center p-4 border-b border-zinc-100 bg-white rounded-t-lg">
          <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 hide-scrollbar">
            <div className="flex gap-2 min-w-max">
              <Button 
                variant={selectedBranch === 'All' ? 'primary' : 'ghost'} 
                onClick={() => setSelectedBranch('All')}
                size="sm"
              >
                ทุกสาขา
              </Button>
              {BRANCHES.map(b => (
                <Button
                  key={b}
                  variant={selectedBranch === b ? 'primary' : 'ghost'}
                  onClick={() => setSelectedBranch(b)}
                  size="sm"
                >
                  {b}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 w-full xl:w-auto justify-end">
             <Button onClick={handleExport} variant="secondary" className="flex-1 md:flex-none whitespace-nowrap bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                 <Icons.Share2 className="w-4 h-4 mr-2" /> นำออก
             </Button>
             <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" className="flex-1 md:flex-none whitespace-nowrap">
                 <Icons.Activity className="w-4 h-4 mr-2" /> นำเข้า
             </Button>
             <Button onClick={() => handleOpenModal()} className="flex-1 md:flex-none whitespace-nowrap">
                 <Icons.Users className="w-4 h-4 mr-2" /> เพิ่มสมาชิก
             </Button>
          </div>
        </div>

        <div className="p-4 bg-zinc-50/80 rounded-b-lg">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              <div className="lg:col-span-5 relative group">
                <Icons.Crosshair className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 group-focus-within:text-red-500 transition-colors" />
                <Input 
                  placeholder="ค้นหาชื่อ..." 
                  className="pl-9 w-full bg-white shadow-sm border-zinc-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="lg:col-span-4">
                 <Select 
                   value={filterClass} 
                   onChange={e => setFilterClass(e.target.value as CharacterClass | 'All')}
                   className="w-full bg-white shadow-sm border-zinc-300 text-sm"
                 >
                   <option value="All">ทุกอาชีพ</option>
                   {CLASSES.map(c => (
                     <option key={c} value={c}>{CLASS_CONFIG[c].th}</option>
                   ))}
                 </Select>
              </div>

              <div className="lg:col-span-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full md:w-auto h-10 border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-500">
                  <Icons.X className="w-4 h-4 mr-1" /> ล้างตัวกรอง
                </Button>
              </div>
           </div>
        </div>
      </Card>

      <div className="flex justify-end px-1">
        <p className="text-sm text-zinc-500">
           แสดง <span className="font-bold text-zinc-900">{filteredMembers.length}</span> สมาชิก
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
             <div key={i} className="bg-white rounded-lg h-40 border border-zinc-200 animate-pulse p-4"></div>
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
         <div className="text-center py-16 px-4 bg-white border border-dashed border-zinc-300 rounded-lg">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 mb-4">
               <Icons.Users className="w-8 h-8 text-zinc-400" />
             </div>
             <h3 className="text-lg font-bold text-zinc-900 mb-2">ไม่พบข้อมูลสมาชิก</h3>
             <p className="text-zinc-500 max-w-sm mx-auto mb-6">
                ยังไม่มีสมาชิกในรายการ หรือไม่พบตามเงื่อนไขการค้นหา
             </p>
             <Button variant="outline" onClick={clearFilters}>ล้างตัวกรอง</Button>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map(member => {
            // Check status against booking target
            const isBookedForWar = leaveRequests.some(r => r.memberId === member.id && r.warDate === bookingWarDateStr);
            const isBookedForPersonal = leaveRequests.some(r => r.memberId === member.id && r.warDate === todayStr);
            const isFullyBooked = isBookedForWar && isBookedForPersonal;
            
            const classBgColor = CLASS_DATA[member.class].color.split(' ')[0].replace('border-', 'bg-');
            
            return (
              <Card 
                key={member.id} 
                noPadding 
                className={`
                  relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg bg-white
                  ${isBookedForWar || isBookedForPersonal ? 'border-amber-200' : 'border-zinc-200 hover:border-red-300'}
                `}
              >
                <div className={`h-1.5 w-full ${classBgColor}`}></div>
                <div className="p-4">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <div className="relative">
                            <ClassIcon type={member.class} size={52} />
                            <div className="absolute -bottom-1 -right-1 bg-zinc-800 text-white text-[9px] px-1.5 py-0.5 rounded-full border border-white font-bold shadow-sm">
                               {member.branch.split('-')[1]}
                            </div>
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-bold text-zinc-900 text-base leading-tight truncate max-w-[120px]" title={member.name}>
                               {member.name}
                            </h4>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mt-0.5">
                               {CLASS_CONFIG[member.class].th}
                            </p>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isBookedForWar && (
                            <Badge color="red">ลาวอ</Badge>
                        )}
                        {isBookedForPersonal && (
                          <div className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200">
                             ลาวันนี้
                          </div>
                        )}
                        {!isBookedForWar && !isBookedForPersonal && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                พร้อม
                            </div>
                        )}
                      </div>
                   </div>
                   
                   <div className="bg-zinc-50 rounded p-2 border border-zinc-100 flex items-center justify-between mb-4">
                       <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Power</span>
                       <span className="text-sm font-bold text-zinc-800 font-sans-num">{member.power.toLocaleString()}</span>
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                       <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => handleOpenModal(member)}>
                           <Icons.Edit className="w-3 h-3 mr-1.5" /> แก้ไข
                       </Button>
                       <Button 
                          variant={isFullyBooked ? "secondary" : "danger"} 
                          size="sm" 
                          disabled={isFullyBooked}
                          className={`w-full text-xs h-8 ${isFullyBooked ? 'text-zinc-400 cursor-not-allowed' : ''}`}
                          onClick={() => handleLeaveClick(member)}
                       >
                          {isFullyBooked ? 'ลาครบแล้ว' : 'แจ้งลา'}
                       </Button>
                   </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Add Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMember ? "แก้ไขข้อมูลสมาชิก" : "ลงทะเบียนสมาชิกใหม่"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">ชื่อตัวละคร</label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="ชื่อในเกม"/>
             </div>
             <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">อาชีพ</label>
                <Select value={formData.class} onChange={e => setFormData({...formData, class: e.target.value as CharacterClass})}>
                  {CLASSES.map(c => <option key={c} value={c}>{CLASS_CONFIG[c].th}</option>)}
                </Select>
            </div>
            <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">ระดับพลัง</label>
                <Input type="number" required value={formData.power} onChange={e => setFormData({...formData, power: parseInt(e.target.value)})} />
            </div>
            <div>
               <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">สาขากิลด์</label>
               <Select 
                 value={formData.branch} 
                 onChange={e => setFormData({...formData, branch: e.target.value as Branch})}
                 disabled={!!editingMember}
               >
                  {BRANCHES.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
               </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-zinc-100">
            {editingMember && (
               <Button type="button" variant="danger" className="mr-auto" onClick={() => initiateDelete(editingMember)}>ลบสมาชิก</Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ยกเลิก</Button>
            <Button type="submit">บันทึก</Button>
          </div>
        </form>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="ยืนยันการลบสมาชิก"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Icons.Trash className="w-8 h-8 text-red-600" />
             </div>
             <h3 className="text-lg font-bold text-zinc-900 mb-2">ลบสมาชิก {deleteTargetMember?.name}?</h3>
             <p className="text-sm text-zinc-500">
               การกระทำนี้จะลบข้อมูลสมาชิกและประวัติการลาทั้งหมดอย่างถาวร
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

      {/* Leave Type Selection Modal */}
      <Modal isOpen={!!leaveModalMember} onClose={() => setLeaveModalMember(null)} title="เลือกประเภทการลา" size="sm">
         <div className="space-y-4">
            <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
               <p className="text-sm text-zinc-600">กำลังทำรายการให้: <strong className="text-zinc-900">{leaveModalMember?.name}</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <Button 
                  disabled={isSaturdayToday || modalMemberLeaveStatus.isPersonalTaken}
                  variant="secondary" 
                  className={`h-24 flex flex-col gap-2 items-center justify-center p-2 transition-all ${isSaturdayToday || modalMemberLeaveStatus.isPersonalTaken ? 'opacity-50 cursor-not-allowed bg-zinc-100' : 'hover:bg-zinc-200 hover:border-zinc-300'}`} 
                  onClick={() => confirmLeave('Personal')}
               >
                  <div className="p-2 bg-zinc-200 rounded-full"><Icons.Activity className="w-5 h-5 text-zinc-600" /></div>
                  <div className="text-center">
                    <span className="block font-bold text-zinc-800">ลากิจ</span>
                    <span className="block text-[10px] text-zinc-500">
                       {isSaturdayToday 
                         ? "ลาวอร์เท่านั้น" 
                         : modalMemberLeaveStatus.isPersonalTaken 
                            ? "ลาวันนี้ไปแล้ว" 
                            : `บันทึกสำหรับ ${todayStr.split('-')[2]}/${todayStr.split('-')[1]}`
                       }
                    </span>
                  </div>
               </Button>
               <Button 
                   disabled={modalMemberLeaveStatus.isWarTaken}
                   variant="primary" 
                   className={`h-24 flex flex-col gap-2 items-center justify-center p-2 transition-all ${modalMemberLeaveStatus.isWarTaken ? 'bg-zinc-100 border-zinc-200 opacity-50 cursor-not-allowed text-zinc-400' : 'bg-red-600 border-red-700 hover:bg-red-700 text-white'}`} 
                   onClick={() => confirmLeave('War')}
                >
                  <div className={`p-2 rounded-full ${modalMemberLeaveStatus.isWarTaken ? 'bg-zinc-200' : 'bg-white/20'}`}><Icons.Sword className={`w-5 h-5 ${modalMemberLeaveStatus.isWarTaken ? 'text-zinc-400' : 'text-white'}`} /></div>
                  <div className="text-center">
                    <span className={`block font-bold ${modalMemberLeaveStatus.isWarTaken ? 'text-zinc-400' : 'text-white'}`}>ลาวอ</span>
                    <span className={`block text-[10px] ${modalMemberLeaveStatus.isWarTaken ? 'text-zinc-400' : 'text-red-100'}`}>
                        {modalMemberLeaveStatus.isWarTaken 
                          ? `บันทึกแล้ว (${formatBookingDate(bookingWarDateStr)})` 
                          : `บันทึก${isSaturdayToday ? 'วันนี้' : 'เสาร์ที่'} ${formatBookingDate(bookingWarDateStr)}`}
                    </span>
                  </div>
               </Button>
            </div>
         </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => !isImporting && setIsImportModalOpen(false)} title="นำเข้าสมาชิก" size="lg">
         <div className="space-y-4">
          <p className="text-sm text-zinc-600">นำเข้าข้อมูลผ่าน <strong>ไฟล์ Excel / CSV</strong> สำหรับสาขา: <Badge color="red">{selectedBranch !== 'All' ? selectedBranch : 'Inferno-1'}</Badge></p>
          <div className="relative group">
            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isImporting ? 'bg-zinc-100 border-zinc-300' : 'bg-white border-zinc-300'}`}>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} disabled={isImporting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="flex flex-col items-center justify-center">
                {isImporting ? <div className="w-8 h-8 border-4 border-zinc-400 border-t-transparent rounded-full animate-spin mb-2"></div> : <Icons.Share2 className="w-8 h-8 text-zinc-400 mb-2 rotate-180" />}
                <p className="text-sm font-medium text-zinc-700">{isImporting ? 'กำลังอ่านไฟล์...' : 'คลิกเพื่ออัปโหลด'}</p>
              </div>
            </div>
          </div>
          <textarea className="w-full h-48 p-3 text-sm font-mono bg-zinc-50 border border-zinc-300 rounded-lg" placeholder={`ชื่อ\tอาชีพ\tพลัง\tกิลด์\nHero1\t1\t55000\t1`} value={importText} onChange={e => setImportText(e.target.value)} disabled={isImporting} />
          <div className="flex justify-end gap-2">
             <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} disabled={isImporting}>ยกเลิก</Button>
             <Button onClick={handleImportSubmit} disabled={isImporting || !importText} className="min-w-[140px]">{isImporting ? "กำลังประมวลผล..." : "ประมวลผล"}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} title="นำเข้าข้อมูลล้มเหลว" size="md">
         <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
             <h3 className="text-sm font-medium text-red-800">พบ {importErrors.length} ข้อผิดพลาด</h3>
          </div>
          <div className="bg-white border border-zinc-200 rounded-md shadow-inner max-h-60 overflow-y-auto">
            <ul className="divide-y divide-zinc-100">
              {importErrors.map((error, idx) => (<li key={idx} className="p-3 text-sm text-zinc-700 flex items-start gap-2"><span className="font-mono text-red-500 font-bold">•</span>{error}</li>))}
            </ul>
          </div>
          <div className="flex justify-end pt-2"><Button onClick={() => setIsErrorModalOpen(false)} variant="secondary">ปิดและแก้ไข</Button></div>
        </div>
      </Modal>
    </div>
  );
};
