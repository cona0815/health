import React, { useState, useRef } from 'react';
import { Calendar, Loader2, MapPin, User, Clock, Hash, Save, Trash2, CalendarCheck, Bell, Syringe, X, ArrowRight, Edit3, Check } from 'lucide-react';
import { extractAppointmentDetails, fileToGenerativePart } from '../services/geminiService';
import { AppointmentDetails, SavedAppointment } from '../types';

interface Props {
  appointments?: SavedAppointment[];
  onSaveAppointment?: (appointment: SavedAppointment) => void;
  onDeleteAppointment?: (id: string) => void;
}

const AppointmentScheduler: React.FC<Props> = ({ appointments = [], onSaveAppointment, onDeleteAppointment }) => {
  const [loading, setLoading] = useState(false);
  const [isNew, setIsNew] = useState(false); // Track if editing a new or existing appointment
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<AppointmentDetails | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFormData(null);
    setIsNew(true);
    setEditingId(null);

    try {
      const base64 = await fileToGenerativePart(file);
      const details = await extractAppointmentDetails(base64, file.type);
      setFormData(details);
    } catch (err) {
      console.error(err);
      alert("無法讀取預約單，請確認照片清晰。");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (apt: SavedAppointment) => {
      setEditingId(apt.id);
      setIsNew(false);
      setFormData({ ...apt });
      // Scroll to top or form area if needed
  };

  const handleCancelEdit = () => {
      setFormData(null);
      setEditingId(null);
      setIsNew(false);
  };

  const handleFormChange = (field: keyof AppointmentDetails, value: string) => {
      if (formData) {
          setFormData({ ...formData, [field]: value });
      }
  };

  const handleSave = () => {
    if (!formData || !onSaveAppointment) return;
    
    const newAppointment: SavedAppointment = {
        ...formData,
        id: isNew ? Date.now().toString() : (editingId || Date.now().toString()),
        createdAt: isNew ? new Date().toISOString() : (appointments.find(a => a.id === editingId)?.createdAt || new Date().toISOString())
    };
    
    if (!isNew && editingId) {
        onDeleteAppointment?.(editingId);
    }

    onSaveAppointment(newAppointment);
    alert(isNew ? "預約已新增！" : "預約已更新！");
    setFormData(null);
    setEditingId(null);
    setIsNew(false);
  };

  const handleDelete = (id: string) => {
      if (confirm("確定要刪除此預約記錄嗎？")) {
          onDeleteAppointment?.(id);
      }
  };

  // Helper to safely format time display (removes 1899-12-30 etc)
  const formatTimeDisplay = (timeStr?: string) => {
      if (!timeStr) return "00:00";
      
      // If it's an ISO string (e.g. 1899-12-30T09:00:00.000Z) from Google Sheets
      if (timeStr.includes('T')) {
          const date = new Date(timeStr);
          if (!isNaN(date.getTime())) {
              // Adjust for timezone offset if needed, but often Sheets passes UTC or local. 
              // We'll trust the simple getHours/Minutes here or fallback to parsing string
              const h = date.getHours().toString().padStart(2, '0');
              const m = date.getMinutes().toString().padStart(2, '0');
              return `${h}:${m}`;
          }
      }
      
      // Try to find HH:MM pattern
      const match = timeStr.match(/(\d{1,2})[:：](\d{1,2})/);
      if (match) {
          return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
      }
      
      // Fallback: if it's afternoon/evening text
      return timeStr.substring(0, 5); 
  };

  // --- Robust Date Calculation Logic ---
  const calculateDates = (details: AppointmentDetails) => {
    try {
        if (!details.date) return null;
        
        let year = new Date().getFullYear();
        let month = 0;
        let day = 1;

        // Clean string
        const cleanDate = details.date.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\//g, '-').replace(/\./g, '-').trim();
        const parts = cleanDate.split('-').filter(p => p.trim() !== '');

        if (parts.length === 3) {
            // YYYY-MM-DD
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            day = parseInt(parts[2]);
        } else if (parts.length === 2) {
             // MM-DD (Assume current year or next year if passed)
             month = parseInt(parts[0]) - 1;
             day = parseInt(parts[1]);
             if (month < new Date().getMonth()) year++; 
        } else if (cleanDate.length === 8 && !isNaN(parseInt(cleanDate))) {
             // 20241231
             year = parseInt(cleanDate.substring(0,4));
             month = parseInt(cleanDate.substring(4,6)) - 1;
             day = parseInt(cleanDate.substring(6,8));
        }

        let hour = 9; let minute = 0;
        const timeStr = details.time ? details.time.trim() : "09:00";
        // Extract numbers
        const timeMatch = timeStr.match(/(\d{1,2})[:：](\d{1,2})/);
        
        if (timeMatch) {
             hour = parseInt(timeMatch[1]);
             minute = parseInt(timeMatch[2]);
             if ((timeStr.includes('下午') || timeStr.toLowerCase().includes('pm')) && hour < 12) hour += 12;
        } else {
             // Rough estimate
             if (timeStr.includes('下午') || timeStr.toLowerCase().includes('pm')) hour = 14; 
             else if (timeStr.includes('晚上')) hour = 19;
             else hour = 9;
        }

        const visitDateStart = new Date(year, month, day, hour, minute);
        
        // Validation
        if (isNaN(visitDateStart.getTime())) return null;

        const visitDateEnd = new Date(visitDateStart.getTime() + 60 * 60 * 1000); 

        // 7 days before for Blood Test
        const bloodTestDateStart = new Date(visitDateStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        bloodTestDateStart.setHours(8, 0, 0, 0); 
        const bloodTestDateEnd = new Date(bloodTestDateStart.getTime() + 60 * 60 * 1000);

        // 1 day before Blood Test for Reminder
        const notifyDateStart = new Date(bloodTestDateStart.getTime() - 1 * 24 * 60 * 60 * 1000);
        notifyDateStart.setHours(20, 0, 0, 0); 
        const notifyDateEnd = new Date(notifyDateStart.getTime() + 30 * 60 * 1000);

        return { 
          visit: { start: visitDateStart, end: visitDateEnd },
          blood: { start: bloodTestDateStart, end: bloodTestDateEnd },
          notify: { start: notifyDateStart, end: notifyDateEnd }
        };
    } catch (e) { 
        console.error("Date parse error", e);
        return null; 
    }
  };

  const getGoogleCalendarUrl = (title: string, start: Date, end: Date, location: string, description: string) => {
    const formatTime = (date: Date) => {
        return date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0') + 'T' +
        date.getHours().toString().padStart(2, '0') +
        date.getMinutes().toString().padStart(2, '0') + '00';
    };
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.append("action", "TEMPLATE");
    url.searchParams.append("text", title);
    url.searchParams.append("dates", `${formatTime(start)}/${formatTime(end)}`);
    url.searchParams.append("details", description);
    url.searchParams.append("location", location);
    return url.toString();
  };

  const formatDateShort = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

  // Custom Button Component matching the exact style requested
  const CalendarButton = ({ date, label, url, icon: Icon, styleType }: { date: Date, label: string, url: string, icon: any, styleType: 'reminder' | 'blood' | 'visit' }) => {
      let baseClasses = "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-all active:scale-95 w-full text-center shadow-sm";
      let colorClasses = "";
      
      if (styleType === 'reminder') {
          // 1. 提醒 (White bg, Gray border)
          colorClasses = "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50";
      } else if (styleType === 'blood') {
          // 2. 抽血 (Pink bg)
          colorClasses = "bg-pink-50 border border-pink-100 text-pink-700 hover:bg-pink-100";
      } else {
          // 3. 回診 (Solid Purple)
          colorClasses = "bg-purple-600 text-white hover:bg-purple-700 shadow-md border border-purple-600";
      }

      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`${baseClasses} ${colorClasses}`}>
             <div className="flex items-center gap-1.5">
                <Icon className="w-4 h-4" />
                <span className="font-bold text-sm">{label}</span>
             </div>
             <span className={`text-xs font-bold font-mono ${styleType === 'visit' ? 'opacity-90' : 'opacity-70'}`}>
                {formatDateShort(date)}
             </span>
        </a>
      );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 rounded-2xl text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> 預約管理中心</h2>
        <p className="opacity-90 mt-2">上傳預約單，AI 自動規劃行程，您也可以手動編輯。</p>
      </div>

      {/* Upload & Editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!formData && !loading && (
             <div 
               className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-6 hover:bg-gray-50 transition-colors cursor-pointer active:scale-95 duration-200 bg-white min-h-[200px]"
               onClick={() => fileInputRef.current?.click()}
             >
               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
                 <Calendar className="w-6 h-6" />
               </div>
               <p className="text-gray-600 font-bold">上傳預約單/掛號證</p>
               <p className="text-xs text-gray-400 mt-1">AI 自動辨識</p>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
             </div>
          )}

          {loading && (
             <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-purple-600 min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="font-bold">AI 正在讀取預約資訊...</p>
             </div>
          )}

          {formData && (
             <div className="bg-white rounded-2xl p-4 border-2 border-purple-200 shadow-lg relative col-span-1 md:col-span-2">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                    <h3 className="font-bold text-lg text-purple-900 flex items-center gap-2">
                        {isNew ? <><Calendar className="w-5 h-5"/> 新增預約</> : <><Edit3 className="w-5 h-5"/> 編輯預約</>}
                    </h3>
                    <button onClick={handleCancelEdit} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500"><X className="w-4 h-4"/></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">醫院/診所名稱</label>
                        <input value={formData.title} onChange={(e) => handleFormChange('title', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" placeholder="例如: 台大醫院" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">醫師姓名</label>
                        <input value={formData.doctor} onChange={(e) => handleFormChange('doctor', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" placeholder="例如: 王小明" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">日期 (YYYY-MM-DD)</label>
                        <input type="date" value={formData.date} onChange={(e) => handleFormChange('date', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">時間 (HH:MM)</label>
                        <input type="time" value={formData.time} onChange={(e) => handleFormChange('time', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">診號</label>
                        <input value={formData.appointmentNumber} onChange={(e) => handleFormChange('appointmentNumber', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" placeholder="例如: 15號" />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-gray-500 mb-1 block">地點/診間</label>
                        <input value={formData.location} onChange={(e) => handleFormChange('location', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" placeholder="例如: 二樓 205 診" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">備註</label>
                        <textarea value={formData.notes} onChange={(e) => handleFormChange('notes', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-200 outline-none" rows={2} placeholder="注意事項..." />
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                   <button onClick={handleSave} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all">
                      <Save className="w-4 h-4" /> {isNew ? "確認並新增" : "儲存變更"}
                   </button>
                   {editingId && (
                       <button onClick={() => { if(confirm("取消編輯將不會儲存變更，確定嗎？")) handleCancelEdit(); }} className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors">
                           取消
                       </button>
                   )}
                </div>
             </div>
          )}
      </div>

      {/* Appointment Cards List */}
      <div className="space-y-4">
         <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-lg">
                <CalendarCheck className="w-5 h-5 text-purple-600"/> 我的預約行程 ({appointments.length})
            </h3>
         </div>
         
         {appointments.length === 0 ? (
             <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">目前沒有預約記錄</p>
             </div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {appointments.map((apt) => {
                     // Don't show if editing in form
                     if (editingId === apt.id) return null;

                     const dates = calculateDates(apt);
                     let visitUrl = '#', bloodUrl = '#', notifyUrl = '#';

                     if (dates) {
                        const visitTitle = `【回診】${apt.title} (${apt.doctor})`;
                        visitUrl = getGoogleCalendarUrl(visitTitle, dates.visit.start, dates.visit.end, apt.location, `診號: ${apt.appointmentNumber || ''}`);
                        bloodUrl = getGoogleCalendarUrl(`【抽血】${apt.title} 檢驗`, dates.blood.start, dates.blood.end, apt.location, "建議空腹");
                        notifyUrl = getGoogleCalendarUrl(`【提醒】明日預約抽血`, dates.notify.start, dates.notify.end, "", "記得禁食");
                     }

                     return (
                        <div key={apt.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow relative group">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-black text-gray-800 text-xl">{apt.title}</h4>
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1 font-medium"><MapPin className="w-4 h-4 text-gray-400" /> {apt.location}</p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1 font-medium"><User className="w-4 h-4 text-gray-400" /> {apt.doctor || "未指定醫師"}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-3xl font-black text-purple-600 leading-none mb-1">
                                        {formatTimeDisplay(apt.time)}
                                    </span>
                                    <span className="text-sm font-bold text-gray-400">{apt.date}</span>
                                </div>
                            </div>

                            {/* Info Badges */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {apt.appointmentNumber && (
                                    <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg text-sm font-bold border border-purple-100">診號: {apt.appointmentNumber}</span>
                                )}
                            </div>

                            {/* Calendar Actions - Grid Layout matching specific design */}
                            {dates ? (
                                <div className="grid grid-cols-3 gap-3 mb-6">
                                   <CalendarButton 
                                      date={dates.notify.start} 
                                      label="1. 提醒" 
                                      url={notifyUrl} 
                                      icon={Bell} 
                                      styleType="reminder"
                                    />
                                   <CalendarButton 
                                      date={dates.blood.start} 
                                      label="2. 抽血" 
                                      url={bloodUrl} 
                                      icon={Syringe} 
                                      styleType="blood"
                                    />
                                   <CalendarButton 
                                      date={dates.visit.start} 
                                      label="3. 回診" 
                                      url={visitUrl} 
                                      icon={CalendarCheck} 
                                      styleType="visit"
                                    />
                                </div>
                            ) : (
                                <div className="bg-red-50 text-red-500 text-xs p-2 rounded mb-4 text-center">日期格式有誤，無法計算行程</div>
                            )}

                            {/* Footer Actions */}
                            <div className="flex items-center gap-4 mt-2 pt-4 border-t border-gray-50">
                                <button onClick={() => handleStartEdit(apt)} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-purple-600 transition-colors">
                                    <Edit3 className="w-4 h-4" /> 編輯
                                </button>
                                <button onClick={() => handleDelete(apt.id)} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors ml-auto">
                                    <Trash2 className="w-4 h-4" /> 刪除
                                </button>
                            </div>
                        </div>
                     );
                 })}
             </div>
         )}
      </div>
    </div>
  );
};

export default AppointmentScheduler;