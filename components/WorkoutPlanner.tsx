import React, { useState } from 'react';
import { Dumbbell, PlayCircle, Activity, Loader2, CheckSquare, Plus, Clock, CheckCircle2, Edit2, Save, Video, Flame, Zap } from 'lucide-react';
import { generateWorkoutPlan, calculateExerciseCalories } from '../services/geminiService';
import { HealthReport, UserProfile, WorkoutPlanDay, WorkoutLog } from '../types';

interface Props {
  userProfile: UserProfile;
  healthReport: HealthReport | null;
  workoutLogs: WorkoutLog[];
  onAddWorkout: (log: WorkoutLog) => void;
  currentPlan: WorkoutPlanDay[];
  onSavePlan: (plan: WorkoutPlanDay[]) => void;
}

const COMMON_EXERCISES = [
  "快走 (Brisk Walking)", "慢跑 (Jogging)", "游泳 (Swimming)", "騎腳踏車 (Cycling)", 
  "瑜珈 (Yoga)", "皮拉提斯 (Pilates)", "HIIT 高強度間歇", "深蹲 (Squats)", 
  "棒式 (Plank)", "太極拳 (Tai Chi)", "跳繩 (Jump Rope)", "重量訓練 (Weight Training)",
  "登山 (Hiking)", "羽球 (Badminton)", "籃球 (Basketball)"
];

const WorkoutPlanner: React.FC<Props> = ({ userProfile, healthReport, workoutLogs, onAddWorkout, currentPlan, onSavePlan }) => {
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<WorkoutPlanDay | null>(null);

  // Manual Entry State
  const [manualActivity, setManualActivity] = useState("");
  const [manualCustomActivity, setManualCustomActivity] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [calcLoading, setCalcLoading] = useState(false);
  
  // Filter logs for today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = workoutLogs.filter(log => log.timestamp && log.timestamp.startsWith(todayStr));

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateWorkoutPlan(userProfile, healthReport || undefined);
      onSavePlan(data);
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

  const handleManualAdd = async () => {
      const activity = manualActivity === "custom" ? manualCustomActivity : manualActivity;
      
      if (!activity || !manualDuration) {
          alert("請選擇運動項目並輸入時間");
          return;
      }

      setCalcLoading(true);
      try {
          const calories = await calculateExerciseCalories(activity, manualDuration, userProfile);
          
          const newLog: WorkoutLog = {
              id: Date.now().toString(),
              activity: activity,
              duration: manualDuration + (manualDuration.includes("分鐘") ? "" : "分鐘"),
              timestamp: new Date().toISOString(),
              caloriesBurned: calories
          };
          
          onAddWorkout(newLog);
          
          // Reset
          setManualActivity("");
          setManualCustomActivity("");
          setManualDuration("");
          alert(`已新增記錄！AI 估算消耗熱量: ${calories} kcal`);
      } catch (e) {
          console.error(e);
          alert("新增失敗，請稍後再試");
      } finally {
          setCalcLoading(false);
      }
  };

  const startEditing = (index: number, plan: WorkoutPlanDay) => {
      setEditingIndex(index);
      setEditForm({ ...plan });
  };

  const saveEdit = () => {
      if (editForm && editingIndex !== null) {
          const newPlan = [...currentPlan];
          newPlan[editingIndex] = editForm;
          onSavePlan(newPlan);
          setEditingIndex(null);
          setEditForm(null);
      }
  };

  const isPlanCompleted = (dayPlan: WorkoutPlanDay) => {
      return todayLogs.some(log => log.activity.includes(dayPlan.activity) || dayPlan.activity.includes(log.activity));
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-20">
      <div className="bg-gradient-to-r from-orange-400 to-red-500 p-5 md:p-6 rounded-2xl text-white shadow-lg">
        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Dumbbell className="w-5 h-5 md:w-6 md:h-6" />
          個人化運動處方
        </h2>
        <p className="opacity-90 mt-2 text-sm md:text-base">根據您的 BMI 與健檢紅字，量身打造安全有效的運動計畫。</p>
      </div>

      {/* Manual Entry Section */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-100">
         <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
           <Zap className="w-5 h-5 text-orange-500" /> 手動記錄運動
         </h3>
         <div className="flex flex-col md:flex-row gap-3">
             <div className="flex-1">
                 <select 
                    value={manualActivity} 
                    onChange={(e) => setManualActivity(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 text-sm"
                 >
                     <option value="">選擇運動項目...</option>
                     {COMMON_EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                     <option value="custom">自訂項目...</option>
                 </select>
             </div>
             {manualActivity === "custom" && (
                 <div className="flex-1">
                     <input 
                        type="text" 
                        value={manualCustomActivity} 
                        onChange={(e) => setManualCustomActivity(e.target.value)}
                        placeholder="輸入運動名稱"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 text-sm"
                     />
                 </div>
             )}
             <div className="w-full md:w-32">
                 <input 
                    type="number" 
                    value={manualDuration} 
                    onChange={(e) => setManualDuration(e.target.value)}
                    placeholder="分鐘"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 text-sm"
                 />
             </div>
             <button 
                onClick={handleManualAdd}
                disabled={calcLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
             >
                 {calcLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5"/>}
                 記錄
             </button>
         </div>
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
                 <div className="flex items-center gap-2">
                     <span className="font-bold text-gray-800">{log.activity}</span>
                     {log.caloriesBurned && (
                         <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                             <Flame className="w-3 h-3" /> {log.caloriesBurned} kcal
                         </span>
                     )}
                 </div>
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
             <h3 className="font-bold text-gray-700">本週建議行程 (可編輯)</h3>
             <button onClick={handleGenerate} className="text-xs text-orange-500 hover:underline border border-orange-200 px-2 py-1 rounded">重新 AI 生成</button>
          </div>
          {currentPlan.map((day, idx) => {
            const isDone = isPlanCompleted(day);
            const isEditing = editingIndex === idx;

            if (isEditing && editForm) {
                return (
                    <div key={idx} className="bg-white p-4 rounded-xl border-2 border-orange-200 shadow-md animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-lg text-gray-800">{editForm.day}</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">運動項目</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="w-1/2 p-2 border border-gray-200 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none"
                                        onChange={(e) => {
                                            if (e.target.value) setEditForm({...editForm, activity: e.target.value})
                                        }}
                                        value={COMMON_EXERCISES.includes(editForm.activity) ? editForm.activity : ""}
                                    >
                                        <option value="">自訂項目...</option>
                                        {COMMON_EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                    </select>
                                    <input 
                                        type="text" 
                                        value={editForm.activity} 
                                        onChange={(e) => setEditForm({...editForm, activity: e.target.value})}
                                        className="w-1/2 p-2 border border-gray-200 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none"
                                        placeholder="輸入項目名稱"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">時間</label>
                                    <input 
                                        type="text" 
                                        value={editForm.duration} 
                                        onChange={(e) => setEditForm({...editForm, duration: e.target.value})}
                                        className="w-full p-2 border border-gray-200 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">強度</label>
                                    <input 
                                        type="text" 
                                        value={editForm.intensity} 
                                        onChange={(e) => setEditForm({...editForm, intensity: e.target.value})}
                                        className="w-full p-2 border border-gray-200 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">備註/建議</label>
                                <textarea 
                                    value={editForm.notes} 
                                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                                    className="w-full p-2 border border-gray-200 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none"
                                    rows={2}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={saveEdit} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-colors">
                                    <Save className="w-4 h-4" /> 儲存
                                </button>
                                <button onClick={() => setEditingIndex(null)} className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-bold text-sm transition-colors">取消</button>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
              <div key={idx} className={`bg-white p-4 rounded-xl border-l-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 group transition-all ${isDone ? 'border-green-500 bg-green-50/30' : 'border-orange-500 hover:shadow-md'}`}>
                
                <div className="flex justify-between items-start sm:block">
                    <div className="min-w-[50px] md:min-w-[60px]">
                      <span className={`text-xl md:text-2xl font-bold transition-colors ${isDone ? 'text-green-600' : 'text-gray-300 group-hover:text-orange-300'}`}>{day.day}</span>
                    </div>
                    {/* Mobile duration */}
                    <div className={`sm:hidden px-2 py-1 rounded-lg text-xs font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'}`}>
                       {day.duration}
                    </div>
                </div>

                <div className="flex-1 relative pr-8">
                   <h3 className={`text-base md:text-lg font-bold flex items-center gap-2 mb-1 ${isDone ? 'text-green-800 line-through opacity-70' : 'text-gray-800'}`}>
                     {day.activity}
                     {isDone && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                   </h3>
                   <p className={`text-sm leading-relaxed ${isDone ? 'text-green-700/60' : 'text-gray-500'}`}>{day.notes}</p>
                   
                   <div className="flex gap-2 mt-2">
                        <a 
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(day.activity + " 教學")}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition-colors"
                        >
                            <Video className="w-3 h-3" /> 觀看教學
                        </a>
                   </div>

                   {/* Edit Button */}
                   <button 
                        onClick={() => startEditing(idx, day)}
                        className="absolute top-0 right-0 p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors"
                   >
                       <Edit2 className="w-4 h-4" />
                   </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:border-none">
                    <div className={`hidden sm:block text-right p-2 rounded-lg min-w-[100px] ${isDone ? 'bg-green-100' : 'bg-orange-50'}`}>
                       <p className={`font-bold ${isDone ? 'text-green-700' : 'text-orange-600'}`}>{day.duration}</p>
                       <p className={`text-xs ${isDone ? 'text-green-600' : 'text-orange-400'}`}>{day.intensity}</p>
                    </div>

                    {isDone ? (
                        <div className="p-2 md:p-3 rounded-full bg-green-100 text-green-600">
                             <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    ) : (
                        <button 
                          onClick={() => handleLogWorkout(day)}
                          className="flex-shrink-0 p-2 md:p-3 rounded-full bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors active:scale-90"
                          title="標記為今日已完成"
                        >
                          <CheckSquare className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default WorkoutPlanner;