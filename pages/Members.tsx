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
  onImportMembers: (members: Member[]) => Promise<void>;
}

export const Members: React.FC<MembersProps> = ({
  members,
  leaveRequests,
  isLoading = false,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onReportLeave,
  onImportMembers
}) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch | 'All'>('All');

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<CharacterClass | 'All'>('All');

  // ✅ NEW: Special filter (ศิษย์เอก / ไม่ใช่ / ทั้งหมด)
  const [filterSpecial, setFilterSpecial] = useState<'All' | 'Special' | 'Normal'>('All');

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
  const [importSheets, setImportSheets] = useState<Partial<Record<Branch, string>>>({});

  // Form State
  const [formData, setFormData] = useState<Partial<Member>>({
    name: '',
    class: 'Ironclan',
    power: 0,
    branch: 'Inferno-1',
    status: 'Active',
    leaveCount: 0,
    isSpecial: false, // ✅ NEW
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
  const bookingWarDateStr = (() => {
    const d = getThaiDate();
    const day = d.getUTCDay();
    const daysToAdd = (6 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    return toISOStringDate(d);
  })();

  const formatBookingDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  };

  // --- Filtering Logic ---
  const filteredMembers = members.filter(m => {
    const matchBranch = selectedBranch === 'All' || m.branch === selectedBranch;

    const lowerSearch = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      m.name.toLowerCase().includes(lowerSearch) ||
      CLASS_CONFIG[m.class].display.toLowerCase().includes(lowerSearch) ||
      CLASS_CONFIG[m.class].th.includes(lowerSearch);

    const matchClass = filterClass === 'All' || m.class === filterClass;

    // ✅ NEW: Filter ศิษย์เอก
    const matchSpecial =
      filterSpecial === 'All' ||
      (filterSpecial === 'Special' && !!m.isSpecial) ||
      (filterSpecial === 'Normal' && !m.isSpecial);

    return matchBranch && matchSearch && matchClass && matchSpecial;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterClass('All');
    setFilterSpecial('All'); // ✅ NEW
  };

  const handleExport = () => {
    if (filteredMembers.length === 0) {
      console.warn('ไม่พบข้อมูลสมาชิกสำหรับส่งออก');
      return;
    }

    const HEADERS = ['ชื่อ', 'อาชีพ', 'พลัง', 'กิลด์'];

    const toRows = (list: Member[]) =>
      list.map(m => ([
        m.name,
        CLASS_CONFIG[m.class].th,
        m.power,
        m.branch.split('-')[1] || ''
      ]));

    const makeSheet = (rows: any[][]) => {
      const ws = utils.aoa_to_sheet([HEADERS]);
      if (rows.length > 0) {
        utils.sheet_add_aoa(ws, rows, { origin: 'A2' });
      }
      ws['!ref'] = ws['!ref'] || 'A1:D1';
      return ws;
    };

    const m1 = filteredMembers.filter(m => m.branch === 'Inferno-1');
    const m2 = filteredMembers.filter(m => m.branch === 'Inferno-2');
    const m3 = filteredMembers.filter(m => m.branch === 'Inferno-3');

    const wb = utils.book_new();
    utils.book_append_sheet(wb, makeSheet(toRows(m1)), 'Members1');
    utils.book_append_sheet(wb, makeSheet(toRows(m2)), 'Members2');
    utils.book_append_sheet(wb, makeSheet(toRows(m3)), 'Members3');

    const dateStr = new Date().toISOString().split('T')[0];
    const fileSuffix = selectedBranch === 'All' ? 'All' : selectedBranch;

    writeFile(wb, `Inferno_Members_${fileSuffix}_${dateStr}.xlsx`);
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
        leaveCount: 0,
        isSpecial: false, // ✅ NEW
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
    setImportSheets({});

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);

      const sheetToText = (sheetName: string) => {
        const ws = workbook.Sheets[sheetName];
        if (!ws) return '';

        const rows = utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        if (!rows || rows.length === 0) return '';

        return rows
          .map(r => (r || []).map(c => String(c ?? '').trim()).join('\t'))
          .join('\n')
          .trim();
      };

      const t1 = sheetToText('Members1');
      const t2 = sheetToText('Members2');
      const t3 = sheetToText('Members3');

      const hasMultiSheets = !!(t1 || t2 || t3);

      if (hasMultiSheets) {
        const sheets: Partial<Record<Branch, string>> = {
          'Inferno-1': t1,
          'Inferno-2': t2,
          'Inferno-3': t3,
        };
        setImportSheets(sheets);

        const preview = [
          t1 ? `# Members1\n${t1}` : `# Members1\n(ไม่มีข้อมูล)`,
          t2 ? `# Members2\n${t2}` : `# Members2\n(ไม่มีข้อมูล)`,
          t3 ? `# Members3\n${t3}` : `# Members3\n(ไม่มีข้อมูล)`,
        ].join('\n\n');

        setImportText(preview);
      } else {
        const firstSheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[firstSheetName];
        const textData = utils.sheet_to_csv(ws, { FS: '\t' });
        setImportText(textData);
      }
    } catch (error) {
      setImportErrors(['ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง']);
      setIsErrorModalOpen(true);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleImportSubmit = async () => {
    setIsImporting(true);
    setImportErrors([]);

    try {
      const errors: string[] = [];
      const newMembers: Member[] = [];
      let idCounter = 1000;

      const parseTextToMembers = (text: string, branch: Branch) => {
        const rows = (text || '').trim().split('\n').filter(Boolean);
        rows.forEach((row, index) => {
          const cols = row.split(/\t|,/).map(c => c.trim());

          if (cols[0] === 'ชื่อ' || cols[0]?.toLowerCase() === 'name') return;

          const name = cols[0];
          if (!name) { errors.push(`(${branch}) แถว ${index + 1}: ไม่พบชื่อ`); return; }

          const rawClass = (cols[1] || '').toLowerCase();
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
              if (
                rawClass.includes(cfg.en.toLowerCase()) ||
                (cols[1] || '').includes(cfg.th) ||
                rawClass.includes(cfg.display.toLowerCase())
              ) {
                matchedClass = key;
                break;
              }
            }
          }

          if (!matchedClass) { errors.push(`(${branch}) ${name}: ไม่รู้จักอาชีพ '${cols[1]}'`); return; }

          const powerStr = (cols[2] || '').replace(/,/g, '').replace(/\D/g, '');
          const power = parseInt(powerStr, 10);
          if (!powerStr || isNaN(power)) { errors.push(`(${branch}) ${name}: พลังไม่ถูกต้อง '${cols[2]}'`); return; }

          newMembers.push({
            id: `temp-${branch}-${idCounter++}`,
            name,
            class: matchedClass,
            power,
            branch,
            status: 'Active',
            joinDate: new Date().toISOString().split('T')[0],
            leaveCount: 0,
            warLeaveCount: 0,
            generalLeaveCount: 0,
            isSpecial: false, // ✅ NEW default
          });
        });
      };

      const hasSheets = importSheets && (
        importSheets['Inferno-1'] || importSheets['Inferno-2'] || importSheets['Inferno-3']
      );

      if (hasSheets) {
        if (importSheets['Inferno-1']) parseTextToMembers(importSheets['Inferno-1']!, 'Inferno-1');
        if (importSheets['Inferno-2']) parseTextToMembers(importSheets['Inferno-2']!, 'Inferno-2');
        if (importSheets['Inferno-3']) parseTextToMembers(importSheets['Inferno-3']!, 'Inferno-3');
      } else {
        parseTextToMembers(importText, selectedBranch !== 'All' ? selectedBranch : 'Inferno-1');
      }

      if (errors.length > 0) {
        setImportErrors(errors);
        setIsErrorModalOpen(true);
        return;
      }

      if (newMembers.length === 0) {
        setImportErrors(['ไม่พบข้อมูลสำหรับนำเข้า']);
        setIsErrorModalOpen(true);
        return;
      }

      await onImportMembers(newMembers);

      setIsImportModalOpen(false);
      setImportText('');
      setImportSheets({});
    } catch (e: any) {
      setImportErrors([`เกิดข้อผิดพลาดในการอ่าน/บันทึกข้อมูล: ${e?.message || 'Unknown error'}`]);
      setIsErrorModalOpen(true);
    } finally {
      setIsImporting(false);
    }
  };

  const modalMemberLeaveStatus = leaveModalMember ? {
    isPersonalTaken: leaveRequests.some(r => r.memberId === leaveModalMember.id && r.warDate === todayStr),
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

            {/* ✅ ปรับ col-span เพื่อให้ใส่ filter ศิษย์เอกได้ */}
            <div className="lg:col-span-3">
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

            {/* ✅ NEW: Filter ศิษย์เอก */}
            <div className="lg:col-span-2">
              <Select
                value={filterSpecial}
                onChange={e => setFilterSpecial(e.target.value as 'All' | 'Special' | 'Normal')}
                className="w-full bg-white shadow-sm border-zinc-300 text-sm"
              >
                <option value="All">ทุกสถานะ</option>
                <option value="Special">ศิษย์เอก</option>
                <option value="Normal">ไม่ใช่ศิษย์เอก</option>
              </Select>
            </div>

            <div className="lg:col-span-2 flex justify-end">
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
                      {isBookedForWar && <Badge color="red">ลาวอ</Badge>}

                      {isBookedForPersonal && (
                        <div className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200">
                          ลาวันนี้
                        </div>
                      )}

                      {/* ✅ NEW: ถ้าเป็นศิษย์เอก ให้แสดงศิษย์เอกแทน "พร้อม" (เฉพาะตอนที่ไม่ได้ลา) */}
                      {!isBookedForWar && !isBookedForPersonal && member.isSpecial && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                          ศิษย์เอก
                        </div>
                      )}

                      {/* เดิม: พร้อม */}
                      {!isBookedForWar && !isBookedForPersonal && !member.isSpecial && (
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

                  <div className={`grid gap-2 ${member.isSpecial ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => handleOpenModal(member)}
                    >
                      <Icons.Edit className="w-3 h-3 mr-1.5" /> แก้ไข
                    </Button>

                    {/* ✅ แสดงปุ่มแจ้งลาเฉพาะคนที่ไม่ใช่ศิษย์เอก */}
                    {!member.isSpecial && (
                      <Button
                        variant={isFullyBooked ? "secondary" : "danger"}
                        size="sm"
                        disabled={isFullyBooked}
                        className={`w-full text-xs h-8 ${isFullyBooked ? 'text-zinc-400 cursor-not-allowed' : ''}`}
                        onClick={() => handleLeaveClick(member)}
                      >
                        {isFullyBooked ? 'ลาครบแล้ว' : 'แจ้งลา'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMember ? 'แก้ไขข้อมูลสมาชิก' : 'ลงทะเบียนสมาชิกใหม่'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">ชื่อตัวละคร</label>
              <Input
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="ชื่อในเกม"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">อาชีพ</label>
              <Select
                value={formData.class}
                onChange={e => setFormData({ ...formData, class: e.target.value as CharacterClass })}
              >
                {CLASSES.map(c => <option key={c} value={c}>{CLASS_CONFIG[c].th}</option>)}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">ระดับพลัง</label>
              <Input
                type="number"
                required
                value={Number(formData.power || 0)}
                onChange={e => setFormData({ ...formData, power: parseInt(e.target.value || '0', 10) })}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">สาขากิลด์</label>
              <Select
                value={formData.branch}
                onChange={e => setFormData({ ...formData, branch: e.target.value as Branch })}
                disabled={!!editingMember}
              >
                {BRANCHES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>

            {/* ✅ NEW: Checkbox ศิษย์เอก */}
            <div className="col-span-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 bg-white">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-red-600"
                  checked={!!formData.isSpecial}
                  onChange={(e) => setFormData({ ...formData, isSpecial: e.target.checked })}
                />
                <div className="leading-tight">
                  <div className="text-sm font-bold text-zinc-900">ศิษย์เอก</div>
                  <div className="text-xs text-zinc-500">เมื่อเลือกแล้ว สถานะการ์ดจะแสดง “ศิษย์เอก” แทน “พร้อม”</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-zinc-100">
            {editingMember && (
              <Button type="button" variant="danger" className="mr-auto" onClick={() => initiateDelete(editingMember)}>
                ลบสมาชิก
              </Button>
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
                    ? 'ลาวอร์เท่านั้น'
                    : modalMemberLeaveStatus.isPersonalTaken
                      ? 'ลาวันนี้ไปแล้ว'
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
              <div className={`p-2 rounded-full ${modalMemberLeaveStatus.isWarTaken ? 'bg-zinc-200' : 'bg-white/20'}`}>
                <Icons.Sword className={`w-5 h-5 ${modalMemberLeaveStatus.isWarTaken ? 'text-zinc-400' : 'text-white'}`} />
              </div>
              <div className="text-center">
                <span className={`block font-bold ${modalMemberLeaveStatus.isWarTaken ? 'text-zinc-400' : 'text-white'}`}>ลาวอ</span>
                <span className={`block text-[10px] ${modalMemberLeaveStatus.isWarTaken ? 'text-zinc-400' : 'text-red-100'}`}>
                  {modalMemberLeaveStatus.isWarTaken
                    ? `บันทึกแล้ว (${formatBookingDate(bookingWarDateStr)})`
                    : `บันทึก${isSaturdayToday ? 'วันนี้' : 'เสาร์ที่'} ${formatBookingDate(bookingWarDateStr)}`
                  }
                </span>
              </div>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => !isImporting && setIsImportModalOpen(false)} title="นำเข้าสมาชิก" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            นำเข้าข้อมูลผ่าน <strong>ไฟล์ Excel / CSV</strong> สำหรับสาขา:{' '}
            <Badge color="red">{selectedBranch !== 'All' ? selectedBranch : 'Inferno-1'}</Badge>
          </p>

          <div className="relative group">
            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isImporting ? 'bg-zinc-100 border-zinc-300' : 'bg-white border-zinc-300'}`}>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center">
                {isImporting
                  ? <div className="w-8 h-8 border-4 border-zinc-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                  : <Icons.Share2 className="w-8 h-8 text-zinc-400 mb-2 rotate-180" />
                }
                <p className="text-sm font-medium text-zinc-700">{isImporting ? 'กำลังอ่านไฟล์...' : 'คลิกเพื่ออัปโหลด'}</p>
              </div>
            </div>
          </div>

          <textarea
            className="w-full h-48 p-3 text-sm font-mono bg-zinc-50 border border-zinc-300 rounded-lg"
            placeholder={`ชื่อ\tอาชีพ\tพลัง\tกิลด์\nHero1\t1\t55000\t1`}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            disabled={isImporting}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} disabled={isImporting}>ยกเลิก</Button>
            <Button onClick={handleImportSubmit} disabled={isImporting || !importText} className="min-w-[140px]">
              {isImporting ? 'กำลังประมวลผล...' : 'ประมวลผล'}
            </Button>
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
              {importErrors.map((error, idx) => (
                <li key={idx} className="p-3 text-sm text-zinc-700 flex items-start gap-2">
                  <span className="font-mono text-red-500 font-bold">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsErrorModalOpen(false)} variant="secondary">ปิดและแก้ไข</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
