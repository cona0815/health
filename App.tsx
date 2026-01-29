import React, { useState, useEffect } from 'react';
import { Utensils, BarChart3, UserCog, Activity, Dumbbell, Loader2, LogOut, Database, User, Key } from 'lucide-react';
import FoodAnalyzer from './components/FoodAnalyzer';
import CalendarStats from './components/CalendarStats';
import AnalysisResultCard from './components/AnalysisResultCard';
import HealthManagement from './components/HealthManagement';
import WorkoutPlanner from './components/WorkoutPlanner';
import GasSetup from './components/GasSetup';
import ApiKeySetup from './components/ApiKeySetup'; // New component
import { HealthReport, FoodAnalysis, ViewState, UserProfile, WorkoutLog, SavedAppointment, WorkoutPlanDay, Recipe } from './types';
import { dbService, getGasUrl, clearGasUrl } from './services/dbService';
import { getGeminiKey, clearGeminiKey } from './services/geminiService';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!getGeminiKey());
  const [hasConnection, setHasConnection] = useState<boolean>(!!getGasUrl());
  const [activeTab, setActiveTab] = useState<ViewState>('FOOD');
  const [dataLoading, setDataLoading] = useState(false);
  
  const [healthReports, setHealthReports] = useState<HealthReport[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodAnalysis[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', height: '', weight: '' });
  
  const [appointments, setAppointments] = useState<SavedAppointment[]>([]);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<WorkoutPlanDay[]>([]);
  
  // 新增食譜狀態
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (hasApiKey && hasConnection) {
      loadUserData();
    }
  }, [hasApiKey, hasConnection]);

  const loadUserData = async () => {
    setDataLoading(true);
    try {
      const data = await dbService.loadAllData();
      setFoodLogs(data.foodLogs.reverse()); 
      setHealthReports(data.reports.reverse());
      setWorkoutLogs(data.workouts.reverse());
      if (data.profile) setUserProfile(data.profile);
      if (data.appointments) setAppointments(data.appointments.reverse());
      if (data.workoutPlan) setCurrentWorkoutPlan(data.workoutPlan);
      if (data.recipes) setSavedRecipes(data.recipes.reverse()); // Load recipes
    } catch (e) {
      console.error("Failed to load data", e);
      alert("讀取資料失敗，請確認您的 Google Sheet 權限設定");
    } finally {
      setDataLoading(false);
    }
  };

  const handleFoodAnalysisComplete = (result: FoodAnalysis) => {
    setFoodLogs(prev => [result, ...prev]);
    dbService.addFoodLog(result); 
  };

  const handleUpdateLog = (timestamp: string, updatedLog: FoodAnalysis) => {
    setFoodLogs(prev => prev.map(log => log.timestamp === timestamp ? updatedLog : log));
    dbService.updateFoodLog(timestamp, updatedLog);
  };

  const handleAddWorkout = (log: WorkoutLog) => {
    setWorkoutLogs(prev => [log, ...prev]);
    dbService.addWorkoutLog(log);
  };

  const handleReportAnalyzed = (report: HealthReport) => {
    setHealthReports(prev => [report, ...prev]);
    alert("健檢報告已上傳至 Google Sheets！");
    dbService.addHealthReport(report);
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    dbService.saveUserProfile(profile);
  };
  
  const handleSaveAppointment = (appointment: SavedAppointment) => {
    setAppointments(prev => [appointment, ...prev]);
    dbService.saveAppointment(appointment);
  };

  const handleSaveWorkoutPlan = (plan: WorkoutPlanDay[]) => {
    setCurrentWorkoutPlan(plan);
    dbService.saveWorkoutPlan(plan);
  };
  
  // Handle Save/Update Recipe
  const handleSaveRecipe = (recipe: Recipe) => {
    setSavedRecipes(prev => {
      const exists = prev.find(r => r.id === recipe.id);
      if (exists) {
        return prev.map(r => r.id === recipe.id ? recipe : r);
      }
      return [recipe, ...prev];
    });
    dbService.saveRecipe(recipe);
  };

  const handleDeleteRecipe = (id: string) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== id));
    dbService.deleteRecipe(id);
  };

  const handleDisconnect = () => {
    if (confirm("確定要登出並清除所有連線資訊嗎？")) {
        clearGasUrl();
        clearGeminiKey();
        setHasConnection(false);
        setHasApiKey(false);
        window.location.reload();
    }
  };

  const latestHealthReport = healthReports.length > 0 ? healthReports[0] : null;

  const renderContent = () => {
    switch (activeTab) {
      case 'FOOD':
        return (
          <div className="space-y-6 md:space-y-8 animate-fade-in">
            <FoodAnalyzer 
              healthReport={latestHealthReport}
              userProfile={userProfile}
              onAnalysisComplete={handleFoodAnalysisComplete}
              onUpdateLog={handleUpdateLog}
              savedRecipes={savedRecipes}
              onSaveRecipe={handleSaveRecipe}
              onDeleteRecipe={handleDeleteRecipe}
            />
            {foodLogs.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 px-1">最近分析記錄</h3>
                <div className="space-y-4 md:space-y-6">
                  {foodLogs.slice(0, 5).map((log, index) => (
                    <AnalysisResultCard key={index} data={log} onUpdateLog={handleUpdateLog}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 'CALENDAR':
        return <CalendarStats logs={foodLogs} workoutLogs={workoutLogs} appointments={appointments} onUpdateLog={handleUpdateLog} />;
      case 'WORKOUT':
        return (
          <WorkoutPlanner 
             userProfile={userProfile} 
             healthReport={latestHealthReport} 
             workoutLogs={workoutLogs} 
             onAddWorkout={handleAddWorkout}
             currentPlan={currentWorkoutPlan}
             onSavePlan={handleSaveWorkoutPlan}
          />
        );
      case 'HEALTH_MANAGEMENT':
        return (
          <HealthManagement 
             userProfile={userProfile} 
             onUpdateProfile={handleUpdateProfile} 
             healthReports={healthReports} 
             onReportAnalyzed={handleReportAnalyzed}
             appointments={appointments}
             onSaveAppointment={handleSaveAppointment}
          />
        );
      default:
        return null;
    }
  };

  const NavButton = ({ id, label, icon: Icon }: { id: ViewState, label: string, icon: any }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`relative flex flex-col items-center justify-center space-y-1 transition-all w-full h-full py-2 ${activeTab === id ? 'text-teal-600' : 'text-gray-400 hover:text-gray-500'}`}
    >
      <Icon className={`w-6 h-6 ${activeTab === id ? 'scale-110' : 'scale-100'} transition-transform`} />
      <span className="text-[10px] font-medium scale-90 sm:scale-100">{label}</span>
      {activeTab === id && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"></span>
      )}
    </button>
  );

  const DesktopNavButton = ({ id, label, icon: Icon, colorClass }: { id: ViewState, label: string, icon: any, colorClass: string }) => (
     <button 
        onClick={() => setActiveTab(id)}
        className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-bold transition-all ${activeTab === id ? `${colorClass} shadow-md translate-x-1` : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        <Icon className="w-5 h-5" /> {label}
      </button>
  );

  // 1. First time Setup: Gemini API Key
  if (!hasApiKey) {
    return <ApiKeySetup onComplete={() => setHasApiKey(true)} />;
  }

  // 2. Second time Setup: Google Sheet DB
  if (!hasConnection) {
    return <GasSetup onConnect={() => setHasConnection(true)} />;
  }

  // 3. Loading Data
  if (dataLoading) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-green-600" />
        <p className="animate-pulse font-medium">資料同步中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 shadow-sm transition-all">
        <div className="max-w-4xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-teal-500 to-blue-600 text-white p-1.5 rounded-lg shadow-sm">
                <Activity className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600">
              HealthGuardian
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200" title="已連線至您的 Google Sheets">
                <Database className="w-3 h-3" /> 雲端連線中
             </span>
             {userProfile.name && (
                <div className="hidden md:flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200">
                    Hi, {userProfile.name}
                </div>
             )}
             <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
               <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xs border border-teal-200">
                   {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
               </div>
               <button 
                 onClick={handleDisconnect} 
                 className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                 title="登出"
               >
                 <LogOut className="w-5 h-5" />
               </button>
             </div>
          </div>
        </div>
      </header>

      <div className="bg-green-600/90 backdrop-blur text-white text-[10px] font-medium text-center py-1 sm:hidden shadow-inner">
         雲端連線：資料自動同步至 Google Sheets
      </div>

      <main className="max-w-4xl mx-auto p-3 md:p-6">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 md:hidden z-30 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="grid grid-cols-4 h-16">
          <NavButton id="FOOD" label="飲食/購物" icon={Utensils} />
          <NavButton id="CALENDAR" label="統計" icon={BarChart3} />
          <NavButton id="WORKOUT" label="運動建議" icon={Dumbbell} />
          <NavButton id="HEALTH_MANAGEMENT" label="健康管理" icon={UserCog} />
        </div>
      </nav>

      <div className="hidden md:block fixed top-24 left-[max(2rem,calc(50%-48rem))] w-56 space-y-2">
        <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Menu</p>
        <DesktopNavButton id="FOOD" label="飲食分析與購物" icon={Utensils} colorClass="bg-teal-50 text-teal-700" />
        <DesktopNavButton id="CALENDAR" label="日曆統計" icon={BarChart3} colorClass="bg-indigo-50 text-indigo-700" />
        <DesktopNavButton id="WORKOUT" label="運動建議" icon={Dumbbell} colorClass="bg-orange-50 text-orange-700" />
        <DesktopNavButton id="HEALTH_MANAGEMENT" label="健康管理中心" icon={UserCog} colorClass="bg-blue-50 text-blue-700" />
      </div>
    </div>
  );
};

export default App;