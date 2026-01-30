import React, { useState, useMemo } from 'react';
import { FoodAnalysis, RiskLevel, WorkoutLog, SavedAppointment } from '../types';
import { ChevronLeft, ChevronRight, Flame, Filter, Target, TrendingUp, Utensils, Calendar as CalendarIcon, Dumbbell, MapPin, Syringe, Bell, ExternalLink, ChevronDown, ChevronUp, Pill, Clock } from 'lucide-react';
import AnalysisResultCard from './AnalysisResultCard';

interface Props {
  logs: FoodAnalysis[];
  workoutLogs: WorkoutLog[];
  appointments: SavedAppointment[];
  onUpdateLog: (timestamp: string, updatedLog: FoodAnalysis) => void;
}

const DAILY_CALORIE_GOAL = 2000;

// Helper to expand appointments into calendar events
const expandAppointmentEvents = (apt: SavedAppointment) => {
    const events = [];
    try {
        let dateStr = apt.date.trim().replace(/\//g, '-').replace(/\./g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
        const dateParts = dateStr.split('-').filter(p => p.trim() !== '');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1;
            const day = parseInt(dateParts[2]);
            
            // Handle Time
            let hour = 9;
            if (apt.time) {
               const t = apt.time.replace(/[^\d:]/g, '');
               if(t.includes(':')) {
                   const parts = t.split(':');
                   hour = parseInt(parts[0]);
                   if ((apt.time.includes('下午') || apt.time.includes('PM')) && hour < 12) hour += 12;
               } else if (apt.time.includes('下午') || apt.time.includes('PM')) hour = 14;
            }

            const visitDate = new Date(year, month, day, hour, 0);

            if (!isNaN(visitDate.getTime())) {
                 // 1. Visit Date
                 const visitStr = visitDate.toISOString().split('T')[0];
                 events.push({ date: visitStr, type: 'VISIT', original: apt, dateObj: visitDate });

                 // 2. Blood Test (7 days before)
                 const bloodDate = new Date(visitDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                 bloodDate.setHours(8, 0, 0, 0);
                 const bloodStr = bloodDate.toISOString().split('T')[0];
                 events.push({ date: bloodStr, type: 'BLOOD', original: apt, dateObj: bloodDate });

                 // 3. Reminder (1 day before blood test)
                 const remindDate = new Date(bloodDate.getTime() - 1 * 24 * 60 * 60 * 1000);
                 remindDate.setHours(20, 0, 0, 0);
                 const remindStr = remindDate.toISOString().split('T')[0];
                 events.push({ date: remindStr, type: 'REMIND', original: apt, dateObj: remindDate });
            }
        }
    } catch (e) {
        console.error("Date parsing error", e);
    }
    return events;
};

// Helper to generate Google Calendar URL
const getGoogleCalendarUrl = (type: string, dateObj: Date, apt: SavedAppointment) => {
    const formatTime = (date: Date) => {
        return date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0') + 'T' +
        date.getHours().toString().padStart(2, '0') +
        date.getMinutes().toString().padStart(2, '0') + '00';
    };

    let title = apt.title;
    let desc = "";
    let end = new Date(dateObj.getTime() + 60 * 60 * 1000); // 1 hour default

    if (type === 'VISIT') {
        title = `【回診】${apt.title} (${apt.doctor})`;
        desc = `診號: ${apt.appointmentNumber || ''}`;
    } else if (type === 'BLOOD') {
        title = `【抽血】${apt.title} 檢驗`;
        desc = "建議空腹";
    } else if (type === 'REMIND') {
        title = `【提醒】明日預約抽血`;
        desc = "記得禁食";
        end = new Date(dateObj.getTime() + 30 * 60 * 1000);
    }

    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.append("action", "TEMPLATE");
    url.searchParams.append("text", title);
    url.searchParams.append("dates", `${formatTime(dateObj)}/${formatTime(end)}`);
    url.searchParams.append("details", desc);
    url.searchParams.append("location", apt.location);
    return url.toString();
};

const CalendarStats: React.FC<Props> = ({ logs, workoutLogs, appointments, onUpdateLog }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Sections collapse state
  const [expandedSections, setExpandedSections] = useState({
      medical: true,
      workout: true,
      food: true
  });

  const toggleSection = (key: keyof typeof expandedSections) => {
      setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  // Group logs by date
  const logsByDate = useMemo(() => {
    const map: Record<string, FoodAnalysis[]> = {};
    logs.forEach(log => {
      try {
        const d = new Date(log.timestamp);
        if (isNaN(d.getTime())) return;
        const dateKey = d.toISOString().split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(log);
      } catch (e) {}
    });
    return map;
  }, [logs]);

  // Group workouts by date
  const workoutsByDate = useMemo(() => {
    const map: Record<string, WorkoutLog[]> = {};
    workoutLogs.forEach(log => {
        try {
            const d = new Date(log.timestamp);
            if (isNaN(d.getTime())) return;
            const dateKey = d.toISOString().split('T')[0];
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(log);
        } catch (e) {}
    });
    return map;
  }, [workoutLogs]);

  // Group Expanded Appointments by date
  const appointmentsEventsByDate = useMemo(() => {
      const map: Record<string, Array<{ type: string, original: SavedAppointment, dateObj: Date }>> = {};
      appointments.forEach(apt => {
          const events = expandAppointmentEvents(apt);
          events.forEach(evt => {
              if (!map[evt.date]) map[evt.date] = [];
              map[evt.date].push(evt);
          });
      });
      return map;
  }, [appointments]);

  // Selected Date Data
  const selectedFoodLogs = logsByDate[selectedDate] || [];
  const selectedWorkouts = workoutsByDate[selectedDate] || [];
  const selectedApptEvents = appointmentsEventsByDate[selectedDate] || [];
  
  const totalCalories = selectedFoodLogs.reduce((sum, log) => sum + log.calories, 0);
  const caloriePercentage = Math.min(100, Math.round((totalCalories / DAILY_CALORIE_GOAL) * 100));
  
  // Monthly Stats
  const monthlyStats = useMemo(() => {
    let green = 0, yellow = 0, red = 0, totalCals = 0, daysWithLogs = 0, workoutDays = 0;
    const uniqueDays = new Set<string>();

    Object.keys(logsByDate).forEach(dateKey => {
      const d = new Date(dateKey);
      if (d.getFullYear() === year && d.getMonth() === month) {
        uniqueDays.add(dateKey);
        logsByDate[dateKey].forEach(log => {
          totalCals += log.calories;
          if (log.riskLevel === RiskLevel.SAFE) green++;
          else if (log.riskLevel === RiskLevel.MODERATE) yellow++;
          else if (log.riskLevel === RiskLevel.DANGEROUS) red++;
        });
      }
    });

    Object.keys(workoutsByDate).forEach(dateKey => {
        const d = new Date(dateKey);
        if (d.getFullYear() === year && d.getMonth() === month) {
             if (workoutsByDate[dateKey].length > 0) workoutDays++;
        }
    });
    
    daysWithLogs = uniqueDays.size;
    const avgCals = daysWithLogs > 0 ? Math.round(totalCals / daysWithLogs) : 0;

    return { green, yellow, red, avgCals, workoutDays };
  }, [logsByDate, workoutsByDate, year, month]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    // Expand sections when user clicks a date to ensure they see data
    setExpandedSections({ medical: true, workout: true, food: true });
  };

  const getCalorieColor = (cals: number) => {
    if (cals > DAILY_CALORIE_GOAL * 1.2) return 'text-red-500';
    if (cals > DAILY_CALORIE_GOAL) return 'text-yellow-600';
    return 'text-emerald-600';
  };

  const renderCalendarDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 md:h-24 bg-gray-50/30 border-r border-b border-gray-100"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLogs = logsByDate[dateStr];
      const dayWorkouts = workoutsByDate[dateStr];
      const dayApptEvents = appointmentsEventsByDate[dateStr];
      const dayCalories = dayLogs?.reduce((sum, l) => sum + l.calories, 0) || 0;
      const isSelected = selectedDate === dateStr;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;
      
      const calsPercent = Math.min(100, (dayCalories / DAILY_CALORIE_GOAL) * 100);

      days.push(
        <div 
          key={d} 
          onClick={() => handleDateClick(d)}
          className={`h-16 md:h-24 border-r border-b border-gray-100 p-1 md:p-2 cursor-pointer transition-all relative group flex flex-col justify-between
            ${isSelected ? 'bg-indigo-50/50' : 'bg-white hover:bg-gray-50'}
          `}
        >
          {isSelected && <div className="absolute inset-0 border-2 border-indigo-500 z-10 pointer-events-none"></div>}
          
          <div className="flex justify-between items-start">
             <span className={`text-[10px] md:text-sm font-semibold w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                {d}
             </span>
             {/* Indicators */}
             <div className="flex flex-col items-end gap-0.5">
                 {dayApptEvents && dayApptEvents.length > 0 && (
                     <div className="flex gap-0.5">
                        {dayApptEvents.map((evt, i) => (
                             <div key={i} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                                 evt.type === 'VISIT' ? 'bg-purple-600' : 
                                 evt.type === 'BLOOD' ? 'bg-pink-500' : 'bg-gray-400'
                             }`}></div>
                        ))}
                     </div>
                 )}
                 {dayWorkouts && dayWorkouts.length > 0 && (
                     <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-500"></div>
                 )}
             </div>
          </div>
          
          <div className="flex flex-col w-full justify-end pb-0.5 gap-0.5 md:gap-1 mt-auto">
             {dayLogs && dayLogs.length > 0 ? (
                <>
                   <div className="h-1 md:h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                         className={`h-full rounded-full ${dayCalories > DAILY_CALORIE_GOAL ? 'bg-red-400' : 'bg-emerald-400'}`} 
                         style={{ width: `${calsPercent}%` }}
                      ></div>
                   </div>
                   <span className={`text-[9px] md:text-xs font-bold text-right leading-none ${getCalorieColor(dayCalories)}`}>
                     {dayCalories}
                   </span>
                </>
             ) : (
                <div className="h-4"></div>
             )}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-12">
      
      {/* Monthly Stats Dashboard - Compact Grid on Mobile */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white p-2 md:p-4 rounded-xl shadow-sm border border-gray-100 text-center">
           <span className="block text-xl md:text-2xl font-black text-gray-800">{monthlyStats.avgCals}</span>
           <span className="text-[10px] md:text-xs text-gray-400">平均熱量</span>
        </div>
        <div className="bg-orange-50 p-2 md:p-4 rounded-xl shadow-sm border border-orange-100 text-center">
           <span className="block text-xl md:text-2xl font-black text-orange-800">{monthlyStats.workoutDays}</span>
           <span className="text-[10px] md:text-xs text-orange-600">運動天數</span>
        </div>
        <div className="bg-emerald-50 p-2 md:p-4 rounded-xl shadow-sm border border-emerald-100 text-center">
           <span className="block text-xl md:text-2xl font-black text-emerald-800">{monthlyStats.green}</span>
           <span className="text-[10px] md:text-xs text-emerald-600">綠燈餐</span>
        </div>
        <div className="bg-red-50 p-2 md:p-4 rounded-xl shadow-sm border border-red-100 text-center">
           <span className="block text-xl md:text-2xl font-black text-red-800">{monthlyStats.red}</span>
           <span className="text-[10px] md:text-xs text-red-600">紅燈餐</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-3 md:p-4 flex items-center justify-between bg-white border-b border-gray-100">
          <button onClick={handlePrevMonth} className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-500" />
            {year}年 {month + 1}月
          </h2>
          <button onClick={handleNextMonth} className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"><ChevronRight className="w-5 h-5"/></button>
        </div>
        
        <div className="grid grid-cols-7 text-center py-2 bg-gray-50/50 border-b border-gray-100 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
          <div className="text-red-400">Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div className="text-blue-400">Sat</div>
        </div>

        <div className="grid grid-cols-7 bg-gray-100 gap-px border-b border-gray-100">
          {renderCalendarDays()}
        </div>
      </div>

      {/* Daily Details - Accordion Style */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              {selectedDate} 詳細日誌
            </h3>
        </div>

        {/* 1. Medical Events Section */}
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
            <button 
                onClick={() => toggleSection('medical')}
                className="w-full flex items-center justify-between p-4 bg-purple-50/50 hover:bg-purple-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-purple-600" />
                    <span className="font-bold text-gray-700">醫療行程</span>
                    {selectedApptEvents.length > 0 && (
                        <span className="bg-purple-200 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">{selectedApptEvents.length}</span>
                    )}
                </div>
                {expandedSections.medical ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
            </button>
            
            {expandedSections.medical && (
                <div className="p-4 space-y-3 animate-fade-in">
                    {selectedApptEvents.length > 0 ? (
                        selectedApptEvents.map((evt, idx) => {
                            const apt = evt.original;
                            const gCalUrl = getGoogleCalendarUrl(evt.type, evt.dateObj, apt);
                            return (
                                <div key={idx} className="flex gap-3 items-start border-l-2 border-gray-100 pl-3">
                                    <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                        evt.type === 'VISIT' ? 'bg-purple-100 text-purple-600' : 
                                        evt.type === 'BLOOD' ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {evt.type === 'VISIT' ? <Pill className="w-4 h-4"/> : evt.type === 'BLOOD' ? <Syringe className="w-4 h-4"/> : <Bell className="w-4 h-4"/>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-gray-800">{evt.type === 'VISIT' ? '回診' : evt.type === 'BLOOD' ? '預約抽血' : '抽血提醒'}</p>
                                            <span className="text-xs font-bold text-gray-500">{evt.dateObj.getHours()}:00</span>
                                        </div>
                                        <p className="text-sm text-gray-600">{apt.title} {apt.doctor ? `(${apt.doctor})` : ''}</p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3"/> {apt.location}</p>
                                        
                                        <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                                            <ExternalLink className="w-3 h-3"/> 加到 Google 日曆
                                        </a>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-2">本日無醫療行程</p>
                    )}
                </div>
            )}
        </div>

        {/* 2. Workout Section */}
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
            <button 
                onClick={() => toggleSection('workout')}
                className="w-full flex items-center justify-between p-4 bg-orange-50/50 hover:bg-orange-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-orange-600" />
                    <span className="font-bold text-gray-700">運動記錄</span>
                    {selectedWorkouts.length > 0 && (
                        <span className="bg-orange-200 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold">{selectedWorkouts.length}</span>
                    )}
                </div>
                {expandedSections.workout ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
            </button>
            
            {expandedSections.workout && (
                <div className="p-4 animate-fade-in">
                    {selectedWorkouts.length > 0 ? (
                        <div className="space-y-2">
                            {selectedWorkouts.map(w => (
                                <div key={w.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-orange-100">
                                    <span className="font-medium text-gray-700">{w.activity}</span>
                                    <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {w.duration}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-2">本日無運動記錄</p>
                    )}
                </div>
            )}
        </div>

        {/* 3. Food Log Section */}
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
            <button 
                onClick={() => toggleSection('food')}
                className="w-full flex items-center justify-between p-4 bg-emerald-50/50 hover:bg-emerald-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-gray-700">飲食記錄</span>
                    <span className="text-xs text-gray-400">({totalCalories} / {DAILY_CALORIE_GOAL} kcal)</span>
                </div>
                {expandedSections.food ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
            </button>
            
            {expandedSections.food && (
                <div className="p-4 space-y-4 animate-fade-in">
                    {selectedFoodLogs.length > 0 ? (
                        selectedFoodLogs.map((log, index) => (
                           <AnalysisResultCard 
                             key={index}
                             data={log} 
                             onUpdateLog={onUpdateLog}
                           />
                        ))
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-2">本日無飲食記錄</p>
                    )}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default CalendarStats;