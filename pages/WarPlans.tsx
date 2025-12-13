
import React, { useState } from 'react';
import { RegularWar, Branch } from '../types';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Icons } from '../components/Icons';
import { BRANCHES } from '../constants';

interface RegularWarHistoryProps {
  wars: RegularWar[];
  onAddWar: (war: RegularWar) => void;
  onDeleteWar: (id: string) => void;
}

export const RegularWarHistory: React.FC<RegularWarHistoryProps> = ({ wars, onAddWar, onDeleteWar }) => {
  // Filter State
  const [selectedBranch, setSelectedBranch] = useState<Branch>('Inferno-1');
  
  // Accordion State
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Main View State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Image Viewer Modal (Optional: for clicking specific image in expanded view)
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  // Form State
  const [newWar, setNewWar] = useState<Partial<RegularWar>>({
    branch: 'Inferno-1',
    date: new Date().toISOString().split('T')[0],
    opponent: '',
    outcome: 'Victory',
    images: []
  });

  // --- Handlers ---

  const filteredWars = wars
    .filter(w => w.branch === selectedBranch)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleToggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages: string[] = [];
      const fileList = Array.from(files);
      
      let processedCount = 0;

      fileList.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            newImages.push(reader.result as string);
          }
          processedCount++;
          if (processedCount === fileList.length) {
             setNewWar(prev => ({ 
               ...prev, 
               images: [...(prev.images || []), ...newImages] 
             }));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImageFromPreview = (index: number) => {
    setNewWar(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index)
    }));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWar.opponent || !newWar.date) return;

    const war: RegularWar = {
      id: Date.now().toString(),
      branch: newWar.branch || 'Inferno-1',
      date: newWar.date || '',
      opponent: newWar.opponent || 'Unknown',
      outcome: newWar.outcome || 'Victory',
      images: newWar.images || []
    };

    onAddWar(war);
    setIsAddModalOpen(false);
    setNewWar({
        branch: 'Inferno-1',
        date: new Date().toISOString().split('T')[0],
        opponent: '',
        outcome: 'Victory',
        images: []
    });
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('คุณต้องการลบบันทึกนี้ใช่หรือไม่?')) {
      onDeleteWar(id);
    }
  };

  // Helper formatting date (Full)
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  // Helper for Date Box (Day / Month)
  const getDateBox = (dateStr: string) => {
     const d = new Date(dateStr);
     const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
     return {
        day: d.getDate(),
        month: months[d.getMonth()]
     };
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-zinc-900 rpg-font">ประวัติวอ-ธรรมดา</h2>
           <p className="text-zinc-500">บันทึกผลการวอและรูปภาพประกอบ (ระหว่างสัปดาห์)</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
           <Icons.Plus className="w-4 h-4 mr-2" /> เพิ่มบันทึก
        </Button>
      </div>

      {/* Branch Selector */}
      <div className="flex gap-2 border-b border-zinc-200 pb-2 overflow-x-auto hide-scrollbar">
         {BRANCHES.map(b => (
            <Button 
               key={b} 
               size="sm" 
               variant={selectedBranch === b ? 'primary' : 'outline'} 
               onClick={() => setSelectedBranch(b)}
            >
               {b}
            </Button>
         ))}
      </div>

      {/* List (Accordion Style) */}
      <div className="space-y-4">
        {filteredWars.map(war => {
          const isExpanded = expandedId === war.id;
          const isVictory = war.outcome === 'Victory';
          const dateBox = getDateBox(war.date);

          return (
            <div 
              key={war.id} 
              className={`bg-white rounded-lg shadow-sm border transition-all duration-200 overflow-hidden cursor-pointer hover:shadow-md
                ${isExpanded ? (isVictory ? 'ring-2 ring-blue-500/20 border-blue-200' : 'ring-2 ring-red-500/20 border-red-200') : 'border-zinc-200'}
              `}
              onClick={() => handleToggleExpand(war.id)}
            >
              {/* Card Header */}
              <div className={`
                 p-4 flex items-center justify-between gap-4
                 ${!isExpanded ? (isVictory ? 'bg-gradient-to-r from-blue-50 to-white' : 'bg-gradient-to-r from-red-50 to-white') : 'bg-white'}
              `}>
                 <div className="flex items-center gap-4">
                    {/* Date Box */}
                    <div className="flex flex-col items-center justify-center bg-white border border-zinc-200 rounded p-2 min-w-[60px] shadow-sm">
                       <span className="text-[10px] text-zinc-400 font-bold uppercase">{dateBox.month}</span>
                       <span className="text-xl font-bold text-zinc-800 leading-none">{dateBox.day}</span>
                    </div>

                    {/* Basic Info */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">
                              {war.branch}
                           </span>
                           <span className={`text-xs font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${isVictory ? 'bg-blue-600 text-white border-blue-700' : 'bg-red-600 text-white border-red-700'}`}>
                              {isVictory ? <Icons.Trophy className="w-3 h-3" /> : <Icons.Skull className="w-3 h-3" />}
                              {war.outcome.toUpperCase()}
                           </span>
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 mt-1 flex items-center gap-2">
                           VS {war.opponent}
                        </h3>
                    </div>
                 </div>

                 {/* Right Side: Image Count & Chevron */}
                 <div className="flex items-center gap-4">
                    {war.images.length > 0 && (
                       <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 bg-white px-2 py-1 rounded-full border border-zinc-200 shadow-sm">
                          <Icons.Image className="w-4 h-4" />
                          <span>{war.images.length} รูป</span>
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
                   <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex justify-between items-center">
                      <span className="text-xs text-zinc-400 font-bold">บันทึกเมื่อ: {formatDate(war.date)}</span>
                      <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-red-600" onClick={(e) => handleDelete(war.id, e)}>
                         <Icons.Trash className="w-4 h-4 mr-1" /> ลบรายการ
                      </Button>
                   </div>

                   {/* Content: Images Grid */}
                   <div className="p-4 bg-zinc-50/30">
                      {war.images.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                           {war.images.map((img, idx) => (
                              <div 
                                key={idx} 
                                className="aspect-square rounded-lg border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-all bg-white group relative"
                                onClick={() => setViewImage(img)}
                              >
                                 <img src={img} className="w-full h-full object-cover" loading="lazy" />
                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                    <Icons.Plus className="text-white opacity-0 group-hover:opacity-100 w-8 h-8 drop-shadow-md" />
                                 </div>
                              </div>
                           ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-zinc-400 border-2 border-dashed border-zinc-200 rounded-lg bg-zinc-50">
                           <Icons.Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                           <p className="text-sm">ไม่มีรูปภาพประกอบ</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {filteredWars.length === 0 && (
           <div className="col-span-full py-16 text-center border-2 border-dashed border-zinc-200 rounded-lg bg-zinc-50/50">
              <Icons.Sword className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">ไม่พบประวัติการวอสำหรับสาขา {selectedBranch}</p>
              <Button onClick={() => setIsAddModalOpen(true)} variant="outline" className="mt-4">เพิ่มรายการแรก</Button>
           </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="เพิ่มบันทึกวอธรรมดา" size="lg">
         <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">สาขา</label>
                  <Select 
                    value={newWar.branch} 
                    onChange={e => setNewWar({...newWar, branch: e.target.value as Branch})}
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </Select>
               </div>

               <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">วันที่</label>
                  <Input 
                    type="date" 
                    required
                    value={newWar.date}
                    onChange={e => setNewWar({...newWar, date: e.target.value})}
                  />
               </div>
            </div>

            <div>
               <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">กิลด์คู่แข่ง</label>
               <Input 
                 required
                 placeholder="ชื่อกิลด์คู่ต่อสู้"
                 value={newWar.opponent}
                 onChange={e => setNewWar({...newWar, opponent: e.target.value})}
               />
            </div>

            <div>
               <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">ผลการแข่งขัน</label>
               <div className="flex gap-2">
                  <button 
                    type="button"
                    className={`flex-1 py-3 rounded border font-bold flex items-center justify-center gap-2 transition-all ${newWar.outcome === 'Victory' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'}`}
                    onClick={() => setNewWar({...newWar, outcome: 'Victory'})}
                  >
                     <Icons.Trophy className="w-5 h-5" /> Victory
                  </button>
                  <button 
                    type="button"
                    className={`flex-1 py-3 rounded border font-bold flex items-center justify-center gap-2 transition-all ${newWar.outcome === 'Defeat' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'}`}
                    onClick={() => setNewWar({...newWar, outcome: 'Defeat'})}
                  >
                     <Icons.Skull className="w-5 h-5" /> Defeat
                  </button>
               </div>
            </div>

            <div>
               <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">
                  รูปภาพประกอบ ({newWar.images?.length || 0})
               </label>
               <div className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center hover:border-red-400 transition-colors cursor-pointer relative bg-zinc-50">
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="py-2 text-zinc-400 pointer-events-none">
                     <Icons.Image className="w-8 h-8 mx-auto mb-2" />
                     <span className="text-sm">คลิกเพื่ออัปโหลดรูปภาพ (ได้หลายรูป)</span>
                  </div>
               </div>

               {/* Preview Grid */}
               {newWar.images && newWar.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                     {newWar.images.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded overflow-hidden border border-zinc-200 group">
                           <img src={img} className="w-full h-full object-cover" />
                           <button 
                              type="button"
                              onClick={() => removeImageFromPreview(idx)}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                              <Icons.X className="w-3 h-3" />
                           </button>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
               <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>ยกเลิก</Button>
               <Button type="submit">บันทึก</Button>
            </div>
         </form>
      </Modal>

      {/* Full Size Image Modal */}
      <Modal 
         isOpen={!!viewImage} 
         onClose={() => setViewImage(null)} 
         title="ดูรูปภาพ" 
         size="xl"
      >
         <div className="flex items-center justify-center bg-zinc-900 rounded-lg overflow-hidden min-h-[300px]">
            {viewImage && <img src={viewImage} className="max-w-full max-h-[80vh] object-contain" />}
         </div>
         <div className="flex justify-end pt-4">
             <Button variant="secondary" onClick={() => setViewImage(null)}>ปิด</Button>
         </div>
      </Modal>
    </div>
  );
};
