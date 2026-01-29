import React, { useState } from 'react';
import { Dumbbell, PlayCircle, Activity, Loader2, CheckSquare, Plus, Clock } from 'lucide-react';
import { generateWorkoutPlan } from '../services/geminiService';
import { HealthReport, UserProfile, WorkoutPlanDay, WorkoutLog } from '../types';

interface Props {
  userProfile: UserProfile;
  healthReport: HealthReport | null;
  workoutLogs: WorkoutLog[];
  onAddWorkout: (log: WorkoutLog) => void;
  currentPlan: WorkoutPlanDay[]; // 接收父層狀態
  onSavePlan: (plan: WorkoutPlanDay[]) => void; // 接收父層更新函數
}

const WorkoutPlanner: React.FC<Props> = ({ userProfile, healthReport, workoutLogs, onAddWorkout, currentPlan, onSavePlan }) => {
  const [loading, setLoading] = useState(false);
  
  // Filter logs for today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = workoutLogs.filter(log => log.timestamp.startsWith(todayStr));

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateWorkoutPlan(userProfile, healthReport || undefined);
      onSavePlan(data); // 呼叫父層函數更新
    } catch (e) {
      alert("生成失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleLogWorkout = (dayPlan: WorkoutPlanDay) => {
    const newLog: WorkoutLog = {
      id: Date.now().toString(),
      activity: dayPlan.activity,
      duration: dayPlan.duration,
      timestamp: new Date().toISOString()
    };
    onAddWorkout(newLog);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-orange-400 to-red-500 p-5 md:p-6 rounded-2xl text-white shadow-lg">
        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Dumbbell className="w-5 h-5 md:w-6 md:h-6" />
          個人化運動處方
        </h2>
        <p className="opacity-90 mt-2 text-sm md:text-base">根據您的 BMI 與健檢紅字，量身打造安全有效的運動計畫。</p>
      </div>

      {/* Today's Progress */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-100">
         <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
           <Activity className="w-5 h-5 text-orange-500" /> 今日運動記錄
         </h3>
         {todayLogs.length > 0 ? (
           <div className="space-y-2">
             {todayLogs.map(log => (
               <div key={log.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg text-sm border border-orange-100">
                 <span className="font-bold text-gray-800">{log.activity}</span>
                 <span className="text-orange-600 flex items-center gap-1">
                   <Clock className="w-3 h-3" /> {log.duration}
                 </span>
               </div>
             ))}
           </div>
         ) : (
           <p className="text-sm text-gray-400 py-2">今天還沒有運動記錄，加油！</p>
         )}
      </div>

      {currentPlan.length === 0 ? (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm text-center border border-gray-100">
           <Activity className="w-12 h-12 md:w-16 md:h-16 text-orange-200 mx-auto mb-4" />
           <p className="text-gray-600 mb-6">還沒有運動計畫嗎？讓 AI 為您規劃。</p>
           <button 
             onClick={handleGenerate}
             disabled={loading}
             className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-70 active:scale-95"
           >
             {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
             {loading ? "AI 規劃中..." : "生成本週運動菜單"}
           </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
             <h3 className="font-bold text-gray-700">本週建議行程</h3>
             <button onClick={handleGenerate} className="text-xs text-orange-500 hover:underline">重新生成</button>
          </div>
          {currentPlan.map((day, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border-l-4 border-orange-500 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 group hover:shadow-md transition-shadow">
              
              <div className="flex justify-between items-start sm:block">
                  <div className="min-w-[50px] md:min-w-[60px]">
                    <span className="text-xl md:text-2xl font-bold text-gray-300 group-hover:text-orange-300 transition-colors">{day.day}</span>
                  </div>
                  {/* Mobile only duration badge */}
                  <div className="sm:hidden bg-orange-50 px-2 py-1 rounded-lg text-xs font-bold text-orange-600">
                     {day.duration}
                  </div>
              </div>

              <div className="flex-1">
                 <h3 className="text-base md:text-lg font-bold text-gray-800 flex items-center gap-2 mb-1">
                   {day.activity}
                 </h3>
                 <p className="text-sm text-gray-500 leading-relaxed">{day.notes}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:border-none">
                  <div className="hidden sm:block text-right bg-orange-50 p-2 rounded-lg min-w-[100px]">
                     <p className="font-bold text-orange-600">{day.duration}</p>
                     <p className="text-xs text-orange-400">{day.intensity}</p>
                  </div>
                  {/* Mobile intensity */}
                  <span className="sm:hidden text-xs text-orange-400 font-medium">{day.intensity}</span>

                  <button 
                    onClick={() => handleLogWorkout(day)}
                    className="flex-shrink-0 p-2 md:p-3 rounded-full bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors active:scale-90"
                    title="標記為今日已完成"
                  >
                    <CheckSquare className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default WorkoutPlanner;