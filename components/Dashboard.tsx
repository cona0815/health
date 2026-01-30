import React, { useMemo, useState } from 'react';
import { Activity, Calendar, Dumbbell, Flame, CheckCircle2, ChevronDown, ChevronUp, MapPin, User, Clock, FileText } from 'lucide-react';
import { FoodAnalysis, SavedAppointment, WorkoutPlanDay, WorkoutLog, UserProfile, ViewState } from '../types';

interface Props {
  userProfile: UserProfile;
  foodLogs: FoodAnalysis[];
  appointments: SavedAppointment[];
  workoutPlan: WorkoutPlanDay[];
  workoutLogs: WorkoutLog[];
  onNavigate: (view: ViewState) => void;
}

const Dashboard: React.FC<Props> = ({ 
  userProfile, foodLogs, appointments, workoutPlan, workoutLogs, onNavigate 
}) => {
  const [isAptExpanded, setIsAptExpanded] = useState(false);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dailyGoal = 2000; 

  // 1. Calories
  const todayCalories = useMemo(() => {
    return foodLogs
        .filter(log => log.timestamp && log.timestamp.startsWith(todayStr))
        .reduce((sum, log) => sum + (Number(log.calories) || 0), 0);
  }, [foodLogs, todayStr]);

  const caloriePercent = Math.min(100, (todayCalories / dailyGoal) * 100);
  const remainingCalories = dailyGoal - todayCalories;

  // 2. Next Appointment
  const upcomingAppointment = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    // Find first one today or after
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    
    return sorted.find(apt => {
        try {
            const dateStr = apt.date.replace(/[\/\.年月]/g, '-').replace(/日/g, '');
            const parts = dateStr.split('-');
            const aptDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
            return aptDate >= todayDate;
        } catch { return false; }
    });
  }, [appointments]);

  // 3. Today's Workout
  const todayWorkout = useMemo(() => {
      if (!workoutPlan || workoutPlan.length === 0) return null;
      try {
          const weekDay = today.toLocaleDateString('zh-TW', { weekday: 'long' }); // "星期五"
          return workoutPlan.find(p => p.day && (p.day.includes(weekDay.replace('星期', '週')) || p.day.includes(weekDay)));
      } catch (e) { return null; }
  }, [workoutPlan]);

  const isWorkoutDone = useMemo(() => {
      if (!todayWorkout) return false;
      return workoutLogs.some(log => 
          log.timestamp.startsWith(todayStr) && 
          log.activity.includes(todayWorkout.activity)
      );
  }, [todayWorkout, workoutLogs, todayStr]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
       {/* Greeting Header */}
       <div className="flex justify-between items-end mb-2 px-1">
          <div>
            <h2 className="text-2xl font-black text-gray-800">
              早安，{userProfile.name || '健康夥伴'}
            </h2>
            <p className="text-gray-500 text-sm font-medium">今天是 {today.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm">
             <Activity className="w-5 h-5 text-teal-600" />
          </div>
       </div>

       {/* Main Calorie Card */}
       <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden" onClick={() => onNavigate('FOOD')}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
             <div>
                <p className="text-teal-100 font-bold text-sm mb-1 uppercase tracking-wider">今日熱量攝取</p>
                <h3 className="text-4xl font-black mb-1">{todayCalories} <span className="text-lg font-medium opacity-80">kcal</span></h3>
                <p className="text-sm font-medium text-teal-100">
                    目標: {dailyGoal} / {remainingCalories > 0 ? `剩餘 ${remainingCalories}` : `超過 ${Math.abs(remainingCalories)}`}
                </p>
             </div>
             {/* Adjusted Chart Size and Added viewBox */}
             <div className="w-24 h-24 relative flex-shrink-0">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="transparent" />
                    <circle 
                        cx="32" cy="32" r="26" 
                        stroke="white" 
                        strokeWidth="5" fill="transparent" 
                        strokeDasharray={163.3} 
                        strokeDashoffset={163.3 - (163.3 * caloriePercent) / 100} 
                        strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">
                    {Math.round(caloriePercent)}%
                 </div>
             </div>
          </div>
          <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white py-2.5 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all w-full justify-center">
             <Flame className="w-4 h-4" /> 記錄新餐點
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Collapsible Appointment Card */}
           <div 
             className={`bg-white rounded-3xl shadow-sm border border-indigo-50 transition-all cursor-pointer relative overflow-hidden group ${
                 isAptExpanded ? 'p-6 ring-2 ring-indigo-100' : 'p-5 hover:shadow-md'
             }`}
             onClick={() => setIsAptExpanded(!isAptExpanded)}
           >
              <div className="flex items-center justify-between mb-3 relative z-10">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-gray-800">下一次回診</h4>
                 </div>
                 {upcomingAppointment && (
                     <div className="text-gray-400">
                         {isAptExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                     </div>
                 )}
              </div>
              
              {upcomingAppointment ? (
                  <div className="relative z-10">
                      <div className="flex items-end gap-2 mb-1">
                          <p className="text-2xl font-black text-indigo-900 leading-none">
                              {new Date(upcomingAppointment.date).getDate()} 
                          </p>
                          <span className="text-sm font-bold text-gray-500 mb-0.5">
                             {new Date(upcomingAppointment.date).toLocaleDateString('zh-TW', { month: 'short' })}
                          </span>
                      </div>
                      <p className="font-bold text-gray-800 truncate text-lg">{upcomingAppointment.title}</p>
                      
                      {/* Expanded Content */}
                      {isAptExpanded && (
                          <div className="mt-4 pt-4 border-t border-indigo-50 space-y-3 animate-fade-in">
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <Clock className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                                  <span>{upcomingAppointment.time}</span>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <User className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                                  <span>{upcomingAppointment.doctor}</span>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                                  <span>{upcomingAppointment.location}</span>
                              </div>
                              {upcomingAppointment.notes && (
                                  <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <span>{upcomingAppointment.notes}</span>
                                  </div>
                              )}
                              
                              <button 
                                onClick={(e) => { e.stopPropagation(); onNavigate('HEALTH_MANAGEMENT'); }}
                                className="w-full mt-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 py-2 rounded-lg transition-colors"
                              >
                                  前往預約管理
                              </button>
                          </div>
                      )}

                      {!isAptExpanded && (
                          <p className="text-xs text-indigo-400 mt-2 font-medium">點擊查看完整資訊</p>
                      )}
                  </div>
              ) : (
                  <div className="relative z-10 py-2" onClick={(e) => { e.stopPropagation(); onNavigate('HEALTH_MANAGEMENT'); }}>
                      <p className="text-gray-400 font-medium text-sm">目前無預約行程</p>
                      <p className="text-xs text-indigo-400 mt-1">點擊新增預約</p>
                  </div>
              )}
           </div>

           {/* Workout Card */}
           <div 
             className={`p-5 rounded-3xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group ${
                 isWorkoutDone ? 'bg-orange-500 border-orange-600' : 'bg-white border-orange-50'
             }`}
             onClick={() => onNavigate('WORKOUT')}
           >
              <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 ${
                  isWorkoutDone ? 'bg-white/10' : 'bg-orange-50'
              }`}></div>

              <div className="flex items-center gap-3 mb-3 relative z-10">
                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                     isWorkoutDone ? 'bg-white text-orange-500' : 'bg-orange-100 text-orange-600'
                 }`}>
                    <Dumbbell className="w-5 h-5" />
                 </div>
                 <h4 className={`font-bold ${isWorkoutDone ? 'text-white' : 'text-gray-800'}`}>今日運動計畫</h4>
              </div>

              {todayWorkout ? (
                  <div className="relative z-10">
                      <p className={`text-xl font-black mb-1 ${isWorkoutDone ? 'text-white' : 'text-gray-800'}`}>
                          {todayWorkout.activity}
                      </p>
                      <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              isWorkoutDone ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-600'
                          }`}>
                              {todayWorkout.duration}
                          </span>
                          {isWorkoutDone && (
                              <span className="flex items-center gap-1 text-xs font-bold text-white bg-green-500/20 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" /> 已完成
                              </span>
                          )}
                      </div>
                  </div>
              ) : (
                  <div className="relative z-10 py-2">
                      <p className="text-gray-400 font-medium text-sm">今日無特定行程</p>
                      <p className="text-xs text-orange-400 mt-1">點擊查看建議</p>
                  </div>
              )}
           </div>
       </div>

       {/* Removed Quick Actions */}
    </div>
  );
};

export default Dashboard;