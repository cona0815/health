import React, { useState, useRef } from 'react';
import { Calendar, Download, Loader2, MapPin, User, Clock, Hash, ExternalLink, Save, Trash2, CalendarCheck, Bell, Syringe } from 'lucide-react';
import { extractAppointmentDetails, fileToGenerativePart } from '../services/geminiService';
import { AppointmentDetails, SavedAppointment } from '../types';

interface Props {
  appointments?: SavedAppointment[];
  onSaveAppointment?: (appointment: SavedAppointment) => void;
}

const AppointmentScheduler: React.FC<Props> = ({ appointments = [], onSaveAppointment }) => {
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setAppointment(null);

    try {
      const base64 = await fileToGenerativePart(file);
      const details = await extractAppointmentDetails(base64, file.type);
      setAppointment(details);
    } catch (err) {
      console.error(err);
      alert("無法讀取預約單，請確認照片清晰。");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!appointment || !onSaveAppointment) return;
    const newAppointment: SavedAppointment = {
        ...appointment,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
    };
    onSaveAppointment(newAppointment);
    alert("預約已儲存！請至「日曆統計」分頁查看完整行程。");
    setAppointment(null); // Clear after save
  };

  // Helper to calculate dates
  const calculateDates = (details: AppointmentDetails) => {
    try {
        if (!details.date) return null;
        
        // Robust date parsing (YYYY-MM-DD or YYYY/MM/DD)
        let dateStr = details.date
            .trim()
            .replace(/\//g, '-')
            .replace(/\./g, '-')
            .replace(/年/g, '-')
            .replace(/月/g, '-')
            .replace(/日/g, '');
            
        const dateParts = dateStr.split('-').filter(p => p.trim() !== '');

        if (dateParts.length !== 3) return null;

        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
        const day = parseInt(dateParts[2]);

        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

        let hour = 9; 
        let minute = 0;
        const timeStr = details.time ? details.time.trim() : "09:00";
        const normalizedTime = timeStr.replace('：', ':');
        
        if (normalizedTime.includes(':')) {
             const timeParts = normalizedTime.split(':');
             const h = parseInt(timeParts[0]);
             const m = parseInt(timeParts[1]);
             if (!isNaN(h)) {
                 hour = h;
                 if (!isNaN(m)) minute = m;
                 if ((timeStr.includes('下午') || timeStr.toLowerCase().includes('pm')) && hour < 12) hour += 12;
                 if ((timeStr.includes('下午') || timeStr.toLowerCase().includes('pm')) && hour === 12) hour = 12;
                 if ((timeStr.includes('上午') || timeStr.toLowerCase().includes('am')) && hour === 12) hour = 0;
             }
        } else {
             if (timeStr.includes('下午') || timeStr.toLowerCase().includes('pm') || timeStr.includes('午后')) hour = 14; 
             else if (timeStr.includes('晚上') || timeStr.includes('晚')) hour = 19;
        }

        const visitDateStart = new Date(year, month, day, hour, minute);
        if (isNaN(visitDateStart.getTime())) return null;
        
        // Visit Date
        const visitDateEnd = new Date(visitDateStart.getTime() + 60 * 60 * 1000); 

        // Blood Test: 7 days before visit
        const bloodTestDateStart = new Date(visitDateStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        bloodTestDateStart.setHours(9, 0, 0, 0); 
        const bloodTestDateEnd = new Date(bloodTestDateStart.getTime() + 60 * 60 * 1000);

        // Reminder: 21 days before blood test (approx 3 weeks)
        // This means it's 28 days before the visit
        const notifyDateStart = new Date(bloodTestDateStart.getTime() - 21 * 24 * 60 * 60 * 1000);
        notifyDateStart.setHours(9, 0, 0, 0);
        const notifyDateEnd = new Date(notifyDateStart.getTime() + 30 * 60 * 1000);

        return { 
          visit: { start: visitDateStart, end: visitDateEnd },
          blood: { start: bloodTestDateStart, end: bloodTestDateEnd },
          notify: { start: notifyDateStart, end: notifyDateEnd }
        };
    } catch (e) {
        return null;
    }
  };

  const getGoogleCalendarUrl = (title: string, start: Date, end: Date, location: string, description: string) => {
    const toISOStringClean = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.append("action", "TEMPLATE");
    url.searchParams.append("text", title);
    url.searchParams.append("dates", `${toISOStringClean(start)}/${toISOStringClean(end)}`);
    url.searchParams.append("details", description);
    url.searchParams.append("location", location);
    return url.toString();
  };

  const renderGoogleButton = (label: string, url: string) => (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-sm active:bg-blue-200">
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );

  let dates, visitUrl, bloodUrl, notifyUrl;
  if (appointment) {
    dates = calculateDates(appointment);
    if (dates) {
        const visitTitle = `${appointment.title} (診號: ${appointment.appointmentNumber || '未指定'})`;
        const visitDesc = `${appointment.notes || ''} \n醫師: ${appointment.doctor || '未指定'}`;
        visitUrl = getGoogleCalendarUrl(`回診: ${visitTitle}`, dates.visit.start, dates.visit.end, appointment.location, visitDesc);
        bloodUrl = getGoogleCalendarUrl(`抽血: ${appointment.title} 檢查`, dates.blood.start, dates.blood.end, appointment.location, "請記得回診前一週抽血");
        
        // Updated Reminder Text
        const reminderDesc = "還有三週抽血，請多吃清淡食物與運動";
        notifyUrl = getGoogleCalendarUrl(`提醒: 預約抽血 (${appointment.title})`, dates.notify.start, dates.notify.end, "", reminderDesc);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
       <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-5 md:p-6 rounded-2xl text-white shadow-lg">
        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 md:w-6 md:h-6" />
          預約單管理
        </h2>
        <p className="opacity-90 mt-2 text-sm md:text-base">
          AI 自動排程：回診日、前一週抽血日、與抽血前三週的健康提醒。
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div 
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 md:p-8 hover:bg-gray-50 transition-colors cursor-pointer active:scale-95 duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 md:w-16 md:h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-7 h-7 md:w-8 md:h-8" />
            </div>
            <p className="text-gray-600 font-medium text-center">上傳預約單/掛號單</p>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
        {loading && (
          <div className="mt-6 flex flex-col items-center text-purple-600">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm font-medium">正在讀取預約資訊...</p>
          </div>
        )}
      </div>

      {/* Saved Appointments List */}
      {appointments.length > 0 && (
         <div className="space-y-3">
             <h3 className="font-bold text-gray-700 flex items-center gap-2"><CalendarCheck className="w-5 h-5"/> 已排程的預約</h3>
             {appointments.map((apt) => (
                 <div key={apt.id} className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                             <h4 className="font-bold text-gray-900">{apt.title}</h4>
                             {apt.appointmentNumber && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">診號 {apt.appointmentNumber}</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" /> 回診: {apt.date} {apt.time}
                        </p>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                             <MapPin className="w-3.5 h-3.5" /> {apt.location} ({apt.doctor})
                        </p>
                    </div>
                 </div>
             ))}
         </div>
      )}

      {/* Analysis Result */}
      {appointment && dates && (
        <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-4 md:p-6 animate-fade-in ring-4 ring-purple-50">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-3">
             <div className="w-full">
                <h3 className="text-xl font-bold text-gray-900 break-words">{appointment.title || "醫療預約"}</h3>
                <p className="text-sm text-gray-500 mt-1">AI 識別結果</p>
             </div>
             {appointment.appointmentNumber && (
                <span className="self-start sm:self-center bg-purple-100 text-purple-700 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-base md:text-lg font-bold flex items-center gap-1 shadow-sm whitespace-nowrap">
                  <Hash className="w-4 h-4" /> {appointment.appointmentNumber}
                </span>
             )}
          </div>
          
          <div className="bg-purple-50 p-4 md:p-5 rounded-2xl border border-purple-100 mb-6 space-y-4">
             <p className="font-bold flex items-center gap-2 text-purple-900">
               <Calendar className="w-5 h-5"/> AI 自動規劃行程:
             </p>
             <ul className="space-y-3">
                <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl shadow-sm border border-purple-100">
                  <div className="flex items-center gap-3">
                    <span className="bg-gray-100 text-gray-600 font-bold w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs">
                       <Bell className="w-4 h-4"/>
                    </span>
                    <div>
                        <span className="font-bold block text-gray-800">抽血預約提醒</span>
                        <span className="text-xs text-gray-500">
                            {dates.notify.start.toLocaleDateString()} (還有三週抽血，請多吃清淡食物與運動)
                        </span>
                    </div>
                  </div>
                  {notifyUrl && renderGoogleButton("加入提醒", notifyUrl)}
                </li>

                <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl shadow-sm border border-purple-100">
                  <div className="flex items-center gap-3">
                    <span className="bg-pink-100 text-pink-600 font-bold w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs">
                        <Syringe className="w-4 h-4"/>
                    </span>
                    <div>
                        <span className="font-bold block text-gray-800">抽血日 (建議)</span>
                        <span className="text-xs text-gray-500">
                             {dates.blood.start.toLocaleDateString()} (回診前 1 週)
                        </span>
                    </div>
                  </div>
                  {bloodUrl && renderGoogleButton("加入抽血", bloodUrl)}
                </li>

                <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl shadow-sm border border-purple-100">
                  <div className="flex items-center gap-3">
                    <span className="bg-purple-100 text-purple-600 font-bold w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs">
                        <Calendar className="w-4 h-4"/>
                    </span>
                    <div>
                        <span className="font-bold block text-gray-800">回診日 (含診號)</span>
                        <span className="text-xs text-gray-500">
                            {appointment.date} {appointment.time}
                        </span>
                    </div>
                  </div>
                  {visitUrl && renderGoogleButton("加入回診", visitUrl)}
                </li>
             </ul>
          </div>

          <div className="grid grid-cols-1">
              <button 
                onClick={handleSave}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                <Save className="w-5 h-5" />
                儲存至 App 行事曆
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentScheduler;