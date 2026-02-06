import React, { useMemo, useState } from 'react';
import { Activity, Calendar, Dumbbell, Flame, CheckCircle2, ChevronDown, ChevronUp, MapPin, User, Clock, FileText, Utensils, Zap, Trophy, AlertTriangle, Sparkles, AlertCircle, Target, Plus, CheckSquare, Save, Loader2 } from 'lucide-react';
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

const COMMON_QUICK_EXERCISES = ["跑步", "快走", "游泳", "重訓", "瑜珈"];

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
  // Net Intake = Food - Exercise
  // Goal: Net Intake <= (TDEE - Deficit)
  // Current Deficit Created = TDEE - Net Intake
  
  const netIntake = todayFoodCalories - todayExerciseCalories;
  const deficitCreated = tdee - netIntake;
  const budgetLimit = tdee - targetDeficit;
  
  // Calculations for Progress
  // rawPercent is used for logic (can go over 100%)
  const rawPercent = budgetLimit > 0 ? (netIntake / budgetLimit) * 100 : 0;
  // progressPercent is clamped for the visual ring
  const progressPercent = Math.min(100, Math.max(0, rawPercent));
  
  // Status Determination
  let statusColor = "text-gray-500";
  let statusText = "維持平衡";
  let statusIcon = <Activity className="w-5 h-5" />;
  let cardGradient = "from-gray-700 to-gray-900"; // Default neutral
  let ringColor = "stroke-gray-400";

  // Dynamic Feedback Message Logic
  let feedbackMessage = "";
  let feedbackIcon = <Sparkles className="w-4 h-4" />;
  let feedbackBg = "bg-white/20";

  if (deficitCreated >= targetDeficit && targetDeficit > 0) {
      // Hit the target deficit!
      statusColor = "text-green-300";
      statusText = "🔥 脂肪燃燒中 (達成目標)";
      statusIcon = <Flame className="w-5 h-5 animate-pulse" />;
      cardGradient = "from-emerald-600 to-teal-700";
      ringColor = "stroke-emerald-300";
  } else if (deficitCreated > 0) {
      // In deficit, but maybe not hitting the full target yet
      statusColor = "text-yellow-300";
      statusText = "⚡ 熱量赤字累積中";
      statusIcon = <Zap className="w-5 h-5" />;
      cardGradient = "from-amber-500 to-orange-600";
      ringColor = "stroke-yellow-300";
  } else {
      // Surplus (Eating more than TDEE)
      statusColor = "text-red-300";
      statusText = "⚠️ 熱量盈餘 (注意攝取)";
      statusIcon = <AlertTriangle className="w-5 h-5" />;
      cardGradient = "from-red-600 to-pink-700";
      ringColor = "stroke-red-300";
  }

  // Determine specific feedback text based on raw percentage
  if (rawPercent < 40) {
      feedbackMessage = "🌞 活力滿滿的一天！記得要吃飽才有力氣減重喔 💪";
      feedbackIcon = <Utensils className="w-4 h-4" />;
      feedbackBg = "bg-white/20 text-white";
  } else if (rawPercent < 80) {
      feedbackMessage = "✨ 節奏很棒！熱量控制在完美範圍內，繼續保持 🎵";
      feedbackIcon = <CheckCircle2 className="w-4 h-4" />;
      feedbackBg = "bg-green-400/30 text-green-100";
  } else if (rawPercent <= 100) {
      feedbackMessage = "🎯 即將達標！今日額度剩餘不多，晚餐請精打細算 🥗";
      feedbackIcon = <Target className="w-4 h-4" />;
      feedbackBg = "bg-yellow-400/30 text-yellow-100";
  } else {
      // Over budget limit
      if (netIntake < tdee) {
          // Over budget (target deficit), but still under TDEE (maintenance)
          feedbackMessage = "😮 稍微超出赤字目標，但還在 TDEE 範圍內！多動動補回來吧 🏃";
          feedbackIcon = <Dumbbell className="w-4 h-4" />;
          feedbackBg = "bg-orange-400/30 text-orange-100";
      } else {
          // Over TDEE (Surplus)
          feedbackMessage = "🚨 熱量爆表啦！明天繼續努力，今晚少吃點讓腸胃休息 🛑";
          feedbackIcon = <AlertCircle className="w-4 h-4" />;
          feedbackBg = "bg-red-500/40 text-red-100";
      }
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
          // 計算熱量
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
          // Fallback
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
      if (!quickActivity || !quickDuration) return alert("請輸入運動項目與時間");
      
      setIsCalculating(true);
      try {
          const durationStr = quickDuration.includes("分") ? quickDuration : quickDuration + "分鐘";
          // 透過 AI 計算熱量
          const calories = await calculateExerciseCalories(quickActivity, durationStr, userProfile);

          const newLog: WorkoutLog = {
              id: Date.now().toString(),
              activity: quickActivity,
              duration: durationStr,
              timestamp: new Date().toISOString(),
              caloriesBurned: calories // 加入計算後的熱量
          };
          onAddWorkout(newLog);
          
          setQuickActivity("");
          setQuickDuration("");
          alert(`運動記錄已新增！(預估消耗 ${calories} kcal)`);
      } catch (e) {
          console.error(e);
          // 失敗時仍新增，但熱量為 0
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
       {/* Greeting */}
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

       {/* MAIN HERO CARD: CALORIE DEFICIT */}
       <div className={`bg-gradient-to-br ${cardGradient} rounded-3xl p-6 text-white shadow-xl relative overflow-hidden transition-colors duration-500`} onClick={() => onNavigate('FOOD')}>
          {/* Background decoration */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
             <div>
                <div className={`flex items-center gap-2 font-bold text-sm mb-2 ${statusColor} bg-black/20 px-3 py-1 rounded-full w-fit backdrop-blur-sm`}>
                    {statusIcon}
                    {statusText}
                </div>
                
                <p className="text-xs opacity-80 uppercase tracking-wider mb-1">今日淨攝取 (Net Intake)</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-5xl font-black">{netIntake < 0 ? 0 : netIntake}</h3>
                    <span className="text-sm font-medium opacity-70">kcal</span>
                </div>
                
                <div className="mt-2 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-white opacity-50"></div>
                        <span className="opacity-80">預算上限 (TDEE - 赤字): </span>
                        <span className="font-bold">{budgetLimit}</span>
                    </div>
                    {targetDeficit > 0 && (
                         <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-white opacity-50"></div>
                            <span className="opacity-80">目標赤字: </span>
                            <span className="font-bold text-yellow-300">-{targetDeficit}</span>
                        </div>
                    )}
                </div>
             </div>

             {/* Progress Visual */}
             <div className="relative w-28 h-28 flex-shrink-0">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Track */}
                    <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.15)" strokeWidth="8" fill="transparent" />
                    {/* Progress Fill */}
                    <circle 
                        cx="50" cy="50" r="42" 
                        className={`transition-all duration-1000 ${ringColor}`}
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray={264} 
                        strokeDashoffset={264 - (264 * progressPercent) / 100} 
                        strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs opacity-60">已使用</span>
                    <span className="text-xl font-bold">{Math.round(rawPercent)}%</span>
                 </div>
             </div>
          </div>

          {/* Feedback Message Banner */}
          <div className={`mb-4 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold ${feedbackBg} backdrop-blur-md border border-white/10 transition-colors duration-300 relative z-10`}>
              {feedbackIcon}
              <span>{feedbackMessage}</span>
          </div>

          {/* Breakdown Stats Row */}
          <div className="grid grid-cols-3 gap-2 bg-black/20 rounded-xl p-3 backdrop-blur-sm relative z-10">
               <div className="text-center border-r border-white/10">
                   <div className="flex items-center justify-center gap-1 text-xs opacity-70 mb-1">
                       <Utensils className="w-3 h-3" /> 飲食
                   </div>
                   <p className="font-bold text-lg">{todayFoodCalories}</p>
               </div>
               <div className="text-center border-r border-white/10">
                   <div className="flex items-center justify-center gap-1 text-xs opacity-70 mb-1">
                       <Dumbbell className="w-3 h-3" /> 運動
                   </div>
                   <p className="font-bold text-lg text-green-300">-{todayExerciseCalories}</p>
               </div>
               <div className="text-center">
                   <div className="flex items-center justify-center gap-1 text-xs opacity-70 mb-1">
                       <Activity className="w-3 h-3" /> TDEE
                   </div>
                   <p className="font-bold text-lg opacity-80">{tdee}</p>
               </div>
          </div>
       </div>

       {/* Quick Add Workout Section */}
       <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col sm:flex-row gap-3 items-center">
           <h3 className="font-bold text-orange-600 flex items-center gap-2 whitespace-nowrap text-sm">
               <Zap className="w-4 h-4" /> 
               手動記運動
           </h3>
           <div className="flex-1 w-full flex gap-2">
               <input 
                   list="exercises" 
                   value={quickActivity}
                   onChange={(e) => setQuickActivity(e.target.value)}
                   placeholder="選擇或輸入項目..."
                   className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
               />
               <datalist id="exercises">
                   {COMMON_QUICK_EXERCISES.map(ex => <option key={ex} value={ex} />)}
               </datalist>
               <input 
                   type="number"
                   value={quickDuration}
                   onChange={(e) => setQuickDuration(e.target.value)}
                   placeholder="分鐘"
                   className="w-20 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
               />
               <button 
                   onClick={handleQuickAdd}
                   disabled={isCalculating}
                   className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition-colors flex-shrink-0 flex items-center justify-center min-w-[40px]"
               >
                   {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
               </button>
           </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Workout Card (Swapped to Left/Top) */}
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
                 
                 {/* Quick Check Button */}
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

           {/* Appointment Card (Swapped to Right/Bottom) */}
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