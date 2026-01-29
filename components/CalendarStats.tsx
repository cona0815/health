import React, { useState, useMemo } from 'react';
import { FoodAnalysis, RiskLevel, WorkoutLog, SavedAppointment } from '../types';
import { ChevronLeft, ChevronRight, Flame, Filter, Target, TrendingUp, Utensils, AlertTriangle, CheckCircle, Droplets, Wheat, Beef, Calendar as CalendarIcon, Dumbbell, Zap, MapPin, Syringe, Bell } from 'lucide-react';
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
            const visitDate = new Date(year, month, day);

            if (!isNaN(visitDate.getTime())) {
                 // 1. Visit Date
                 const visitStr = visitDate.toISOString().split('T')[0];
                 events.push({ date: visitStr, type: 'VISIT', original: apt });

                 // 2. Blood Test (7 days before)
                 const bloodDate = new Date(visitDate);
                 bloodDate.setDate(visitDate.getDate() - 7);
                 const bloodStr = bloodDate.toISOString().split('T')[0];
                 events.push({ date: bloodStr, type: 'BLOOD', original: apt });

                 // 3. Reminder (21 days before blood test)
                 const remindDate = new Date(bloodDate);
                 remindDate.setDate(bloodDate.getDate() - 21);
                 const remindStr = remindDate.toISOString().split('T')[0];
                 events.push({ date: remindStr, type: 'REMIND', original: apt });
            }
        }
    } catch (e) {
        console.error("Date parsing error", e);
    }
    return events;
};

const CalendarStats: React.FC<Props> = ({ logs, workoutLogs, appointments, onUpdateLog }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'ALL' | 'SAFE' | 'RISKY'>('ALL');

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
      const map: Record<string, Array<{ type: string, original: SavedAppointment }>> = {};
      appointments.forEach(apt => {
          const events = expandAppointmentEvents(apt);
          events.forEach(evt => {
              if (!map[evt.date]) map[evt.date] = [];
              map[evt.date].push({ type: evt.type, original: evt.original });
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
  
  // Aggregate Nutrients
  const totalNutrients = useMemo(() => {
    const totals: Record<string, number> = { '蛋白質': 0, '脂肪': 0, '碳水化合物': 0 };
    selectedFoodLogs.forEach(log => {
        log.nutrients.forEach(n => {
            if (n.name.includes('蛋白')) totals['蛋白質'] += parseFloat(n.amount) || 0;
            if (n.name.includes('脂肪') || n.name.includes('油脂')) totals['脂肪'] += parseFloat(n.amount) || 0;
            if (n.name.includes('碳水') || n.name.includes('醣')) totals['碳水化合物'] += parseFloat(n.amount) || 0;
        });
    });
    return totals;
  }, [selectedFoodLogs]);

  const filteredLogs = selectedFoodLogs.filter(log => {
    if (filterType === 'SAFE') return log.riskLevel === RiskLevel.SAFE;
    if (filterType === 'RISKY') return log.riskLevel === RiskLevel.MODERATE || log.riskLevel === RiskLevel.DANGEROUS;
    return true;
  });

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
    setFilterType('ALL');
  };

  const getCalorieColor = (cals: number) => {
    if (cals > DAILY_CALORIE_GOAL * 1.2) return 'text-red-500';
    if (cals > DAILY_CALORIE_GOAL) return 'text-yellow-600';
    return 'text-emerald-600';
  };

  const renderCalendarDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 md:h-24 bg-gray-50/30 border-r border-b border-gray-100"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLogs = logsByDate[dateStr];
      const dayWorkouts = workoutsByDate[dateStr];
      const dayApptEvents = appointmentsEventsByDate[dateStr];
      const dayCalories = dayLogs?.reduce((sum, l) => sum + l.calories, 0) || 0;
      const isSelected = selectedDate === dateStr;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;
      
      const riskCounts = dayLogs?.reduce((acc, log) => {
         if (log.riskLevel === RiskLevel.SAFE) acc.safe++;
         if (log.riskLevel === RiskLevel.MODERATE) acc.mod++;
         if (log.riskLevel === RiskLevel.DANGEROUS) acc.dang++;
         return acc;
      }, { safe: 0, mod: 0, dang: 0 }) || { safe: 0, mod: 0, dang: 0 };

      const calsPercent = Math.min(100, (dayCalories / DAILY_CALORIE_GOAL) * 100);

      days.push(
        <div 
          key={d} 
          onClick={() => handleDateClick(d)}
          className={`h-20 md:h-24 border-r border-b border-gray-100 p-1 md:p-2 cursor-pointer transition-all relative group flex flex-col justify-between
            ${isSelected ? 'bg-indigo-50/50' : 'bg-white hover:bg-gray-50'}
          `}
        >
          {isSelected && <div className="absolute inset-0 border-2 border-indigo-500 z-10 pointer-events-none"></div>}
          
          <div className="flex justify-between items-start">
             <span className={`text-[10px] md:text-sm font-semibold w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                {d}
             </span>
             <div className="flex gap-0.5 mt-0.5 md:mt-1 flex-wrap justify-end max-w-[50%]">
                {/* Dots for Food Risk */}
                {dayLogs && (
                    <div className="flex gap-0.5">
                        {riskCounts.dang > 0 && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500"></div>}
                        {riskCounts.mod > 0 && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-400"></div>}
                        {riskCounts.safe > 0 && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500"></div>}
                    </div>
                )}
             </div>
          </div>
          
          {/* Middle Icons Area */}
          <div className="flex flex-col items-end gap-1 mt-1">
             {dayApptEvents && dayApptEvents.map((evt, i) => (
                 <div key={i} className={`w-2 h-2 rounded-full ${
                     evt.type === 'VISIT' ? 'bg-purple-600' : 
                     evt.type === 'BLOOD' ? 'bg-pink-500' : 'bg-gray-400'
                 }`} title={evt.type === 'VISIT' ? '回診' : evt.type === 'BLOOD' ? '抽血' : '提醒'}></div>
             ))}
          </div>

          <div className="flex flex-col w-full justify-end pb-0.5 gap-0.5 md:gap-1 mt-auto">
             {/* Workout Indicator */}
             {dayWorkouts && dayWorkouts.length > 0 && (
                 <div className="flex items-center justify-center bg-orange-100 rounded text-[9px] md:text-[10px] text-orange-700 font-bold py-0.5 overflow-hidden">
                     <Dumbbell className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" /> <span className="hidden sm:inline">運動</span>
                 </div>
             )}

             {/* Calorie Bar */}
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
             ) : (!dayWorkouts || dayWorkouts.length === 0) && (
                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[10px] text-gray-300 font-medium">+</span>
                </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-24 md:h-28">
           <div className="flex items-center gap-1.5 text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> 平均攝取
           </div>
           <div>
              <span className="text-2xl md:text-3xl font-black text-gray-800">{monthlyStats.avgCals}</span>
              <span className="text-[10px] md:text-xs text-gray-400 ml-1">kcal/日</span>
           </div>
           <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(100, (monthlyStats.avgCals / DAILY_CALORIE_GOAL) * 100)}%` }}></div>
           </div>
        </div>

        <div className="bg-orange-50 p-3 md:p-4 rounded-xl shadow-sm border border-orange-100 flex flex-col justify-between h-24 md:h-28">
           <div className="flex items-center gap-1.5 text-orange-700 text-[10px] md:text-xs font-bold uppercase tracking-wider">
              <Dumbbell className="w-3.5 h-3.5" /> 運動天數
           </div>
           <div>
               <span className="text-2xl md:text-3xl font-black text-orange-800">{monthlyStats.workoutDays}</span>
               <span className="text-[10px] md:text-xs text-orange-600 ml-1">天</span>
           </div>
        </div>

        <div className="bg-emerald-50 p-3 md:p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between h-24 md:h-28">
           <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] md:text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" /> 綠燈餐點
           </div>
           <span className="text-2xl md:text-3xl font-black text-emerald-800">{monthlyStats.green}</span>
        </div>

        <div className="bg-red-50 p-3 md:p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between h-24 md:h-28">
           <div className="flex items-center gap-1.5 text-red-700 text-[10px] md:text-xs font-bold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5" /> 紅燈餐點
           </div>
           <span className="text-2xl md:text-3xl font-black text-red-800">{monthlyStats.red}</span>
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
        
        <div className="grid grid-cols-7 text-center py-2 md:py-3 bg-gray-50/50 border-b border-gray-100 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
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

      {/* Daily Summary & Details */}
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" />
              {selectedDate} 日誌
            </h3>
        </div>

        {/* Appointments Section */}
        {selectedApptEvents.length > 0 && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-3 md:p-4">
                 <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-3 text-sm md:text-base">
                    <CalendarIcon className="w-4 h-4 md:w-5 md:h-5" /> 醫療行程
                 </h4>
                 <div className="space-y-2">
                    {selectedApptEvents.map((evt, idx) => {
                        const apt = evt.original;
                        return (
                            <div key={idx} className={`bg-white p-3 rounded-lg border shadow-sm ${
                                evt.type === 'VISIT' ? 'border-purple-200' :
                                evt.type === 'BLOOD' ? 'border-pink-200' : 'border-gray-200'
                            }`}>
                                <div className="flex justify-between items-start">
                                     <div className="flex items-center gap-2">
                                        {evt.type === 'VISIT' && <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">回診</span>}
                                        {evt.type === 'BLOOD' && <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Syringe className="w-3 h-3"/>抽血</span>}
                                        {evt.type === 'REMIND' && <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Bell className="w-3 h-3"/>提醒</span>}
                                        <span className="font-bold text-gray-800">{apt.title}</span>
                                     </div>
                                     <span className="text-purple-600 font-bold text-sm">{evt.type === 'VISIT' ? apt.time : '全天'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                                    <MapPin className="w-3 h-3" /> {apt.location} ({apt.doctor})
                                </div>
                                {evt.type === 'BLOOD' && <p className="text-xs text-pink-600 mt-1">※ 建議今日進行空腹抽血</p>}
                                {evt.type === 'REMIND' && <p className="text-xs text-gray-500 mt-1">※ 還有三週抽血，請多吃清淡食物與運動</p>}
                            </div>
                        );
                    })}
                 </div>
            </div>
        )}

        {/* Workout Log Section */}
        {selectedWorkouts.length > 0 && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 md:p-4">
                <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-3 text-sm md:text-base">
                    <Dumbbell className="w-4 h-4 md:w-5 md:h-5" /> 運動記錄
                </h4>
                <div className="space-y-2">
                    {selectedWorkouts.map(w => (
                        <div key={w.id} className="bg-white p-3 rounded-lg border border-orange-100 flex justify-between items-center shadow-sm">
                            <span className="font-semibold text-gray-700 text-sm md:text-base">{w.activity}</span>
                            <span className="text-xs md:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{w.duration}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {selectedFoodLogs.length > 0 ? (
          <>
            {/* Daily Nutrition Card - Responsive Stack */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Calories - Center on mobile */}
               <div className="flex items-center gap-6 justify-center md:justify-start">
                  <div className="relative w-24 h-24 flex-shrink-0">
                     <svg className="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
                        <circle 
                            cx="48" cy="48" r="40" 
                            stroke="currentColor" strokeWidth="8" fill="transparent" 
                            strokeDasharray={251.2} 
                            strokeDashoffset={251.2 - (251.2 * caloriePercentage) / 100} 
                            className={`${totalCalories > DAILY_CALORIE_GOAL ? 'text-red-500' : 'text-emerald-500'} transition-all duration-1000 ease-out`}
                            strokeLinecap="round"
                        />
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-xl font-black text-gray-800">{caloriePercentage}%</span>
                     </div>
                  </div>
                  <div>
                     <p className="text-gray-500 text-sm font-medium mb-1">今日熱量</p>
                     <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{totalCalories} <span className="text-xs md:text-sm font-normal text-gray-400">/ {DAILY_CALORIE_GOAL}</span></p>
                     <p className="text-xs text-gray-400">Kcal</p>
                  </div>
               </div>

               {/* Nutrients - Grid on mobile */}
               <div className="grid grid-cols-3 gap-3 md:gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                  <div className="text-center">
                     <div className="w-8 h-8 md:w-10 md:h-10 mx-auto bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-1.5 md:mb-2">
                        <Beef className="w-4 h-4 md:w-5 md:h-5" />
                     </div>
                     <p className="text-[10px] md:text-xs text-gray-500 mb-0.5">蛋白質</p>
                     <p className="font-bold text-gray-800 text-sm md:text-base">{totalNutrients['蛋白質'].toFixed(1)}g</p>
                  </div>
                  <div className="text-center">
                     <div className="w-8 h-8 md:w-10 md:h-10 mx-auto bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mb-1.5 md:mb-2">
                        <Droplets className="w-4 h-4 md:w-5 md:h-5" />
                     </div>
                     <p className="text-[10px] md:text-xs text-gray-500 mb-0.5">脂肪</p>
                     <p className="font-bold text-gray-800 text-sm md:text-base">{totalNutrients['脂肪'].toFixed(1)}g</p>
                  </div>
                  <div className="text-center">
                     <div className="w-8 h-8 md:w-10 md:h-10 mx-auto bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-1.5 md:mb-2">
                        <Wheat className="w-4 h-4 md:w-5 md:h-5" />
                     </div>
                     <p className="text-[10px] md:text-xs text-gray-500 mb-0.5">碳水</p>
                     <p className="font-bold text-gray-800 text-sm md:text-base">{totalNutrients['碳水化合物'].toFixed(1)}g</p>
                  </div>
               </div>
            </div>

            {/* Filter Controls - Horizontal Scroll on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 font-medium mr-1 flex-shrink-0">篩選:</span>
                {(['ALL', 'SAFE', 'RISKY'] as const).map(type => (
                   <button 
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 md:px-4 text-xs rounded-full border font-medium transition-all whitespace-nowrap flex-shrink-0 ${filterType === type 
                          ? 'bg-gray-800 text-white border-gray-800 shadow-md transform scale-105' 
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                   >
                      {type === 'ALL' ? '全部餐點' : type === 'SAFE' ? '只看綠燈' : '只看紅/黃燈'}
                   </button>
                ))}
            </div>

            {/* Meal List */}
            <div className="space-y-4">
              {filteredLogs.length > 0 ? (
                 filteredLogs.map((log, index) => (
                  <div key={log.timestamp + index} className="relative pl-4 md:pl-6 border-l-2 border-gray-100">
                      <div className="absolute left-[-5px] top-6 w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-white"></div>
                      <AnalysisResultCard 
                        data={log} 
                        onUpdateLog={onUpdateLog}
                      />
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                     <Utensils className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">沒有符合此篩選條件的記錄</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {selectedWorkouts.length === 0 && selectedApptEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 md:py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-4">
                    <CalendarIcon className="w-8 h-8 md:w-10 md:h-10" />
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-gray-700 mb-1">今日尚無記錄</h4>
                    <p className="text-gray-400 text-sm">開始記錄，追蹤健康平衡！</p>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CalendarStats;