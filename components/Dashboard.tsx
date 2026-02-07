import React, { useMemo, useState } from 'react';
import { Activity, Calendar, Dumbbell, Flame, CheckCircle2, ChevronDown, ChevronUp, MapPin, User, Clock, FileText, Utensils, Zap, Trophy, AlertTriangle, Sparkles, AlertCircle, Target, Plus, CheckSquare, Save, Loader2, Camera, ArrowRight } from 'lucide-react';
import { FoodAnalysis, SavedAppointment, WorkoutPlanDay, WorkoutLog, UserProfile, ViewState, ActivityLevel } from '../types';
import { calculateExerciseCalories } from '../services/geminiService';

interface Props {
  userProfile: UserProfile;
  foodLogs: FoodAnalysis[];
  appointments: SavedAppointment[];
  workoutPlan: WorkoutPlanDay[];
  workoutLogs: WorkoutLog[];
  onNavigate: (view: ViewState) => void;
  onAddWorkout: (log: WorkoutLog) => void;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9
};

const COMMON_QUICK_EXERCISES = [
    "快走 (Brisk Walking)", 
    "慢跑 (Jogging)", 
    "游泳 (Swimming)", 
    "重訓 (Weight Training)", 
    "瑜珈 (Yoga)", 
    "皮拉提斯 (Pilates)", 
    "騎腳踏車 (Cycling)", 
    "跳繩 (Jump Rope)", 
    "HIIT 間歇運動",
    "登山 (Hiking)"
];

const Dashboard: React.FC<Props> = ({ 
  userProfile, foodLogs, appointments, workoutPlan, workoutLogs, onNavigate, onAddWorkout
}) => {
  const [isAptExpanded, setIsAptExpanded] = useState(false);
  const [quickActivity, setQuickActivity] = useState("");
  const [quickDuration, setQuickDuration] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(false);
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. Calculate TDEE
  const tdee = useMemo(() => {
      const w = parseFloat(userProfile.weight);
      const h = parseFloat(userProfile.height);
      const birthDate = userProfile.birthDate;
      const gender = userProfile.gender || 'male';
      const activity = userProfile.activityLevel || 'sedentary';

      if (!w || !h || !birthDate) return 2000; 

      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
      }

      // Mifflin-St Jeor Equation
      let bmr = (10 * w) + (6.25 * h) - (5 * age);
      if (gender === 'male') bmr += 5;
      else bmr -= 161;

      const factor = ACTIVITY_FACTORS[activity] || 1.2;
      return Math.round(bmr * factor);
  }, [userProfile]);

  // 2. Calories Calculation
  const targetDeficit = userProfile.targetDeficit || 0;
  
  const todayFoodCalories = useMemo(() => {
    return foodLogs
        .filter(log => log.timestamp && log.timestamp.startsWith(todayStr))
        .reduce((sum, log) => sum + (Number(log.calories) || 0), 0);
  }, [foodLogs, todayStr]);

  const todayExerciseCalories = useMemo(() => {
    return workoutLogs
        .filter(log => log.timestamp && log.timestamp.startsWith(todayStr))
        .reduce((sum, log) => sum + (Number(log.caloriesBurned) || 0), 0);
  }, [workoutLogs, todayStr]);

  // Logic: 
  // Daily Budget = TDEE - Deficit Goal
  // Net Intake = Food - Exercise
  // Remaining = Daily Budget - Net Intake
  
  const dailyBudget = tdee - targetDeficit;
  const netIntake = todayFoodCalories - todayExerciseCalories;
  const remainingCalories = dailyBudget - netIntake;
  
  // Progress for the circle (0 to 100%)
  // If remaining is full (didn't eat), percent is 0 used. 
  // We want to show how much "Budget" is used.
  const usedPercent = Math.max(0, (netIntake / dailyBudget) * 100);
  // Clone for visual capping at 100 for the stroke, but keep logic for color
  const visualPercent = Math.min(100, usedPercent);
  
  // Status Colors & Feedback
  let statusColor = "text-teal-100";
  let cardGradient = "from-teal-500 to-emerald-600"; // Default Safe (Green/Teal)
  let ringColor = "stroke-teal-200";
  let ringBgColor = "stroke-teal-500/30";
  let statusMessage = "攝取量控制良好";

  if (remainingCalories < 0) {
      // 爆表 (Over Budget) -> Red Alert
      cardGradient = "from-red-600 to-rose-700";
      ringColor = "stroke-red-200";
      ringBgColor = "stroke-red-900/30";
      statusMessage = "⚠️ 熱量已超標！";
      statusColor = "text-red-100";
  } else if (remainingCalories < 200) {
      // Warning Zone -> Orange
      cardGradient = "from-orange-500 to-amber-600";
      ringColor = "stroke-orange-200";
      ringBgColor = "stroke-orange-800/30";
      statusMessage = "即將達標，注意晚餐";
  }

  // 3. Next Appointment
  const upcomingAppointment = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
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

  // 4. Today's Workout
  const todayWorkout = useMemo(() => {
      if (!workoutPlan || workoutPlan.length === 0) return null;
      try {
          const weekDay = today.toLocaleDateString('zh-TW', { weekday: 'long' });
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

  const handleCheckPlan = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!todayWorkout || isWorkoutDone) return;
      
      setCheckingPlan(true);
      try {
          const calories = await calculateExerciseCalories(todayWorkout.activity, todayWorkout.duration, userProfile);
          const newLog: WorkoutLog = {
              id: Date.now().toString(),
              activity: todayWorkout.activity,
              duration: todayWorkout.duration,
              timestamp: new Date().toISOString(),
              caloriesBurned: calories
          };
          onAddWorkout(newLog);
          alert(`運動目標達成！消耗熱量約 ${calories} kcal`);
      } catch (e) {
          console.error(e);
          const newLog: WorkoutLog = {
              id: Date.now().toString(),
              activity: todayWorkout.activity,
              duration: todayWorkout.duration,
              timestamp: new Date().toISOString(),
              caloriesBurned: 0
          };
          onAddWorkout(newLog);
      } finally {
          setCheckingPlan(false);
      }
  };

  const handleQuickAdd = async () => {
      if (!quickActivity || !quickDuration) return alert("請選擇運動項目並輸入時間");
      
      setIsCalculating(true);
      try {
          const durationStr = quickDuration.includes("分") ? quickDuration : quickDuration + "分鐘";
          const calories = await calculateExerciseCalories(quickActivity, durationStr, userProfile);

          const newLog: WorkoutLog = {
              id: Date.now().toString(),
              activity: quickActivity,
              duration: durationStr,
              timestamp: new Date().toISOString(),
              caloriesBurned: calories
          };
          onAddWorkout(newLog);
          
          setQuickActivity("");
          setQuickDuration("");
          alert(`運動記錄已新增！(預估消耗 ${calories} kcal)`);
      } catch (e) {
          console.error(e);
          const durationStr = quickDuration.includes("分") ? quickDuration : quickDuration + "分鐘";
          const newLog: WorkoutLog = {
              id: Date.now().toString(),
              activity: quickActivity,
              duration: durationStr,
              timestamp: new Date().toISOString(),
              caloriesBurned: 0
          };
          onAddWorkout(newLog);
          setQuickActivity("");
          setQuickDuration("");
          alert("運動記錄已新增 (無法計算熱量)");
      } finally {
          setIsCalculating(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
       {/* Header with Greeting & Quick Action */}
       <div className="flex justify-between items-center mb-2 px-1">
          <div>
            <h2 className="text-2xl font-black text-gray-800">
              早安，{userProfile.name || '健康夥伴'}
            </h2>
            <p className="text-gray-500 text-sm font-medium">今天是 {today.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          
          {/* NEW: Camera Shortcut Button */}
          <button 
             onClick={() => onNavigate('FOOD')}
             className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
             <Camera className="w-5 h-5" />
             <span className="hidden sm:inline">餐點分析</span>
          </button>
       </div>

       {/* MAIN HERO CARD: REMAINING CALORIES CIRCLE */}
       <div 
         className={`bg-gradient-to-br ${cardGradient} rounded-3xl p-6 text-white shadow-xl relative overflow-hidden transition-all duration-500 cursor-pointer group`}
         onClick={() => onNavigate('FOOD')}
       >
          {/* Decorative Blur */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center justify-center py-2">
             
             {/* Circular Progress */}
             <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Track */}
                    <circle cx="50" cy="50" r="42" className={ringBgColor} strokeWidth="8" fill="transparent" />
                    {/* Progress Fill */}
                    <circle 
                        cx="50" cy="50" r="42" 
                        className={`transition-all duration-1000 ${ringColor} drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`}
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray={264} 
                        strokeDashoffset={264 - (264 * visualPercent) / 100} 
                        strokeLinecap="round"
                    />
                 </svg>
                 
                 {/* Center Content */}
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-sm sm:text-base font-medium opacity-90 mb-1">剩餘</p>
                    <h3 className="text-5xl sm:text-6xl font-black tracking-tighter drop-shadow-md">
                        {remainingCalories}
                    </h3>
                    <p className="text-sm sm:text-base font-bold opacity-80 mt-1">千卡</p>
                 </div>
             </div>

             {/* Status Message */}
             <div className={`mt-6 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/10 flex items-center gap-2 ${statusColor} animate-fade-in-up`}>
                {remainingCalories < 0 ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span className="font-bold text-sm">{statusMessage}</span>
             </div>

             {/* Bottom Stats Grid */}
             <div className="grid grid-cols-3 gap-8 mt-6 w-full max-w-sm border-t border-white/10 pt-4">
                 <div className="text-center">
                    <p className="text-xs opacity-70 mb-1">攝取</p>
                    <p className="font-bold text-lg">{todayFoodCalories}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-xs opacity-70 mb-1">消耗</p>
                    <p className="font-bold text-lg text-teal-200">-{todayExerciseCalories}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-xs opacity-70 mb-1">目標</p>
                    <p className="font-bold text-lg">{dailyBudget}</p>
                 </div>
             </div>
          </div>
       </div>

       {/* Quick Add Workout Section - Changed to Select Dropdown */}
       <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100">
           <div className="flex items-center gap-2 mb-3">
               <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                  <Zap className="w-4 h-4" />
               </div>
               <h3 className="font-bold text-gray-800 text-sm">手動記運動</h3>
           </div>
           
           <div className="flex flex-col sm:flex-row gap-3 items-center">
               <div className="relative w-full flex-1">
                   <select 
                       value={quickActivity}
                       onChange={(e) => setQuickActivity(e.target.value)}
                       className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 appearance-none font-medium text-gray-700"
                   >
                       <option value="" disabled>選擇運動項目...</option>
                       {COMMON_QUICK_EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                   </select>
                   <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
               </div>

               <div className="flex w-full sm:w-auto gap-2">
                   <input 
                       type="number"
                       value={quickDuration}
                       onChange={(e) => setQuickDuration(e.target.value)}
                       placeholder="分鐘"
                       className="flex-1 sm:w-24 text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 text-center font-medium"
                   />
                   <button 
                       onClick={handleQuickAdd}
                       disabled={isCalculating}
                       className="bg-orange-500 hover:bg-orange-600 text-white px-5 rounded-xl transition-colors flex-shrink-0 flex items-center justify-center font-bold shadow-sm active:scale-95 disabled:opacity-70"
                   >
                       {isCalculating ? <Loader2 className="w-5 h-5 animate-spin" /> : "記錄"}
                   </button>
               </div>
           </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex items-center justify-between mb-3 relative z-10">
                 <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                        isWorkoutDone ? 'bg-white text-orange-500' : 'bg-orange-100 text-orange-600'
                    }`}>
                        <Dumbbell className="w-5 h-5" />
                    </div>
                    <h4 className={`font-bold ${isWorkoutDone ? 'text-white' : 'text-gray-800'}`}>今日運動計畫</h4>
                 </div>
                 
                 {todayWorkout && !isWorkoutDone && (
                     <button 
                        onClick={handleCheckPlan}
                        disabled={checkingPlan}
                        className="bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-600 p-2 rounded-full transition-all shadow-sm z-20 disabled:opacity-70 disabled:cursor-not-allowed"
                        title="標記為已完成"
                     >
                         {checkingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckSquare className="w-5 h-5" />}
                     </button>
                 )}
                 {isWorkoutDone && (
                     <span className="bg-white/20 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                         <CheckCircle2 className="w-3 h-3" /> 完成
                     </span>
                 )}
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
                      </div>
                  </div>
              ) : (
                  <div className="relative z-10 py-2">
                      <p className="text-gray-400 font-medium text-sm">今日無特定行程</p>
                      <p className="text-xs text-orange-400 mt-1">點擊查看建議</p>
                  </div>
              )}
           </div>

           {/* Appointment Card */}
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
       </div>
    </div>
  );
};

export default Dashboard;