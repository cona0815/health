import React, { useState, useEffect } from 'react';
import { User, FileText, Calendar, Ruler, Weight, Activity, Pill, UserCircle, Settings, Key, Database, Save, Eye, EyeOff, Code, Copy, Check, TrendingUp, Plus, History, Trash2 } from 'lucide-react';
import { UserProfile, HealthReport, SavedAppointment } from '../types';
import HealthReportAnalyzer from './HealthReportAnalyzer';
import AppointmentScheduler from './AppointmentScheduler';
import MedicationManager from './MedicationManager';
import { getGeminiKey, setGeminiKey } from '../services/geminiService';
import { getGasUrl, setGasUrl } from '../services/dbService';
import { GAS_CODE } from './GasSetup';

interface Props {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  healthReports: HealthReport[];
  onReportAnalyzed: (report: HealthReport) => void;
  appointments: SavedAppointment[];
  onSaveAppointment: (appointment: SavedAppointment) => void;
  onDeleteAppointment: (id: string) => void;
}

type SubTab = 'PROFILE' | 'REPORTS' | 'APPOINTMENTS' | 'MEDICATION' | 'SYSTEM';

const HealthManagement: React.FC<Props> = ({ 
  userProfile, 
  onUpdateProfile, 
  healthReports, 
  onReportAnalyzed,
  appointments,
  onSaveAppointment,
  onDeleteAppointment
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('PROFILE');
  
  // Profile State
  const [tempName, setTempName] = useState('');
  const [tempHeight, setTempHeight] = useState('');
  const [tempWeight, setTempWeight] = useState('');
  
  // Weight History State
  const [newWeight, setNewWeight] = useState('');
  const [showWeightInput, setShowWeightInput] = useState(false);

  // System Settings State
  const [apiKey, setApiKey] = useState('');
  const [gasUrl, setGasUrlState] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  // GAS Code View State
  const [showGasCode, setShowGasCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // 關鍵修正：當 userProfile 從 DB 載入或更新時，強制同步到輸入框
  useEffect(() => {
    if (userProfile) {
      setTempName(userProfile.name || '');
      setTempHeight(userProfile.height || '');
      setTempWeight(userProfile.weight || '');
    }
  }, [userProfile]);

  useEffect(() => {
      if (activeSubTab === 'SYSTEM') {
          setApiKey(getGeminiKey() || '');
          setGasUrlState(getGasUrl() || '');
      }
  }, [activeSubTab]);

  const calculateBMI = (h: string, w: string) => {
    if (!h || !w) return null;
    const heightM = parseFloat(h) / 100;
    const weightKg = parseFloat(w);
    if (isNaN(heightM) || isNaN(weightKg) || heightM === 0) return null;
    return (weightKg / (heightM * heightM)).toFixed(1);
  };

  const bmi = calculateBMI(tempHeight, tempWeight);

  const handleSaveProfile = () => {
    // 這裡會呼叫 App.tsx 的 handleUpdateProfile，進而寫入 DB
    const updatedProfile = { 
        ...userProfile,
        name: tempName, 
        height: tempHeight, 
        weight: tempWeight 
    };
    onUpdateProfile(updatedProfile);
    alert("個人資料已更新並保存！");
  };

  const handleAddWeight = () => {
      if (!newWeight || isNaN(parseFloat(newWeight))) {
          alert("請輸入有效的體重數字");
          return;
      }

      const today = new Date().toISOString().split('T')[0];
      const newRecord = { date: today, weight: newWeight };
      
      const currentHistory = userProfile.weightHistory || [];
      // 如果今天已經有紀錄，則更新它
      const existsIndex = currentHistory.findIndex(r => r.date === today);
      let updatedHistory = [...currentHistory];
      
      if (existsIndex >= 0) {
          updatedHistory[existsIndex] = newRecord;
      } else {
          updatedHistory.push(newRecord);
      }
      
      // Sort by date asc (for chart)
      updatedHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 更新目前顯示的體重
      setTempWeight(newWeight);

      const updatedProfile = {
          ...userProfile,
          name: tempName,
          height: tempHeight,
          weight: newWeight, // 同步更新當前體重
          weightHistory: updatedHistory
      };

      onUpdateProfile(updatedProfile);
      setNewWeight('');
      setShowWeightInput(false);
      alert("體重記錄已更新！");
  };

  const handleDeleteWeightRecord = (recordDate: string) => {
      if (!confirm(`確定要刪除 ${recordDate} 的體重紀錄嗎？`)) return;

      const currentHistory = userProfile.weightHistory || [];
      const updatedHistory = currentHistory.filter(r => r.date !== recordDate);
      
      const updatedProfile = {
          ...userProfile,
          weightHistory: updatedHistory
      };
      
      onUpdateProfile(updatedProfile);
  };

  const handleSaveSystem = () => {
      if (apiKey.trim()) setGeminiKey(apiKey.trim());
      if (gasUrl.trim()) setGasUrl(gasUrl.trim());
      alert("系統設定已更新！(部分變更可能需重整網頁生效)");
  };

  const copyGasCode = () => {
      navigator.clipboard.writeText(GAS_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      alert("程式碼已複製！請至 Google Apps Script 更新並重新部署。");
  };

  const getBMIStatus = (val: string | null) => {
    if (!val) return null;
    const num = parseFloat(val);
    if (num < 18.5) return { text: '體重過輕', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (num < 24) return { text: '健康體位', color: 'text-green-600', bg: 'bg-green-100' };
    if (num < 27) return { text: '過重', color: 'text-orange-600', bg: 'bg-orange-100' };
    return { text: '肥胖', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const bmiStatus = getBMIStatus(bmi);

  // Simple SVG Line Chart Logic
  const renderWeightChart = () => {
      const history = userProfile.weightHistory || [];
      if (history.length < 2) return null;

      // Take last 7 entries for cleaner chart
      const data = history.slice(-7);
      const weights = data.map(d => parseFloat(d.weight));
      const minW = Math.min(...weights) - 2;
      const maxW = Math.max(...weights) + 2;
      const range = maxW - minW;
      
      const points = data.map((d, i) => {
          const x = (i / (data.length - 1)) * 100;
          const y = 100 - ((parseFloat(d.weight) - minW) / range) * 100;
          return `${x},${y}`;
      }).join(' ');

      return (
          <div className="mt-4 mb-2">
              <div className="h-32 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Grid Lines */}
                      <line x1="0" y1="25" x2="100" y2="25" stroke="#f1f5f9" strokeWidth="0.5" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="0.5" />
                      <line x1="0" y1="75" x2="100" y2="75" stroke="#f1f5f9" strokeWidth="0.5" />
                      
                      {/* Trend Line */}
                      <polyline
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          points={points}
                      />
                      
                      {/* Points */}
                      {data.map((d, i) => {
                           const x = (i / (data.length - 1)) * 100;
                           const y = 100 - ((parseFloat(d.weight) - minW) / range) * 100;
                           return (
                               <circle key={i} cx={x} cy={y} r="2" fill="white" stroke="#3b82f6" strokeWidth="1.5" />
                           );
                      })}
                  </svg>
                  
                  {/* Labels */}
                  <div className="absolute top-0 left-0 w-full h-full flex justify-between items-end pointer-events-none">
                      {data.map((d, i) => (
                          <div key={i} className="text-[10px] text-gray-400 text-center w-8 -ml-4 flex flex-col items-center">
                              <span className="font-bold text-gray-800 mb-1">{d.weight}</span>
                              <span>{d.date.substring(5).replace('-','/')}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  };

  const TabButton = ({ id, label, icon: Icon }: { id: SubTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={`flex-1 min-w-[80px] py-3 md:py-4 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-colors whitespace-nowrap ${
        activeSubTab === id ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4 md:w-5 md:h-5" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Scrollable Sub Navigation - Hide Scrollbar */}
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
          <TabButton id="PROFILE" label="個人資料" icon={User} />
          <TabButton id="REPORTS" label="健檢報告" icon={FileText} />
          <TabButton id="MEDICATION" label="智慧藥師" icon={Pill} />
          <TabButton id="APPOINTMENTS" label="預約掛號" icon={Calendar} />
          <TabButton id="SYSTEM" label="系統設定" icon={Settings} />
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6">
          
          {activeSubTab === 'PROFILE' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">您的個人檔案</h3>
                <p className="text-gray-500 text-sm">輸入資料讓 AI 飲食建議更精準、更親切</p>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <UserCircle className="w-4 h-4" /> 您的稱呼
                  </label>
                  <input 
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="例如: Alex"
                    autoComplete="off"
                    className="w-full p-3 md:p-4 border border-slate-200 bg-white text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base md:text-lg font-medium placeholder-gray-400"
                  />
                 </div>

                 <div className="grid grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Ruler className="w-4 h-4" /> 身高 (cm)
                    </label>
                    <input 
                        type="number" 
                        value={tempHeight}
                        onChange={(e) => setTempHeight(e.target.value)}
                        placeholder="170"
                        autoComplete="off"
                        className="w-full p-3 md:p-4 border border-slate-600 bg-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-lg md:text-xl font-bold placeholder-slate-500"
                    />
                    </div>
                    <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Weight className="w-4 h-4" /> 體重 (kg)
                    </label>
                    <input 
                        type="number" 
                        value={tempWeight}
                        onChange={(e) => setTempWeight(e.target.value)}
                        placeholder="65"
                        autoComplete="off"
                        className="w-full p-3 md:p-4 border border-slate-600 bg-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-lg md:text-xl font-bold placeholder-slate-500"
                    />
                    </div>
                </div>

                {/* Weight Trend Section */}
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> 體重紀錄與趨勢
                        </h4>
                        <button 
                            onClick={() => setShowWeightInput(!showWeightInput)}
                            className="text-xs bg-white text-blue-600 px-2 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 font-bold flex items-center gap-1 shadow-sm"
                        >
                            <Plus className="w-3 h-3" /> 記錄今日
                        </button>
                    </div>

                    {showWeightInput && (
                        <div className="mb-4 flex gap-2 animate-fade-in-up">
                            <input 
                                type="number" 
                                value={newWeight}
                                onChange={(e) => setNewWeight(e.target.value)}
                                placeholder="輸入今日體重 (kg)"
                                className="flex-1 p-2 text-sm border border-gray-300 bg-white text-gray-900 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                                autoFocus
                            />
                            <button 
                                onClick={handleAddWeight}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md"
                            >
                                確定
                            </button>
                        </div>
                    )}

                    {renderWeightChart()}

                    {/* Weight History List */}
                    {userProfile.weightHistory && userProfile.weightHistory.length > 0 && (
                        <div className="mt-4 border-t border-blue-100 pt-3">
                            <h5 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                                <History className="w-3 h-3" /> 歷史紀錄 ({userProfile.weightHistory.length})
                            </h5>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                {[...userProfile.weightHistory].reverse().map((record, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-blue-100 text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-500 font-mono text-xs">{record.date}</span>
                                            <span className="font-bold text-gray-800">{record.weight} kg</span>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteWeightRecord(record.date)}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                            title="刪除紀錄"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {!userProfile.weightHistory?.length && (
                        <p className="text-xs text-center text-blue-400 py-4">
                            尚無紀錄，請點擊「記錄今日」開始追蹤
                        </p>
                    )}
                </div>
              </div>

              {bmi && (
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">BMI 指數</p>
                      <p className="text-xl md:text-2xl font-bold text-gray-900">{bmi}</p>
                    </div>
                  </div>
                  {bmiStatus && (
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${bmiStatus.bg} ${bmiStatus.color}`}>
                      {bmiStatus.text}
                    </span>
                  )}
                </div>
              )}

              <button 
                onClick={handleSaveProfile}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 md:py-4 px-4 rounded-xl transition-colors shadow-lg shadow-blue-200 active:scale-95 duration-200"
              >
                儲存更新
              </button>
            </div>
          )}

          {activeSubTab === 'REPORTS' && (
            <HealthReportAnalyzer reports={healthReports} onReportAnalyzed={onReportAnalyzed} />
          )}

          {activeSubTab === 'MEDICATION' && (
            <MedicationManager healthReport={healthReports[0] || null} />
          )}

          {activeSubTab === 'APPOINTMENTS' && (
            <AppointmentScheduler 
                appointments={appointments} 
                onSaveAppointment={onSaveAppointment}
                onDeleteAppointment={onDeleteAppointment}
            />
          )}

          {activeSubTab === 'SYSTEM' && (
              <div className="space-y-6 animate-fade-in">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-gray-500" /> 系統連線設定
                      </h3>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                                  <Key className="w-3 h-3" /> Gemini API Key
                              </label>
                              <div className="relative">
                                  <input 
                                      type={showKey ? "text" : "password"} 
                                      value={apiKey}
                                      onChange={(e) => setApiKey(e.target.value)}
                                      className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                                      placeholder="請輸入您的 API Key"
                                  />
                                  <button 
                                      onClick={() => setShowKey(!showKey)}
                                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                  >
                                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                              </div>
                              <p className="text-xs text-gray-400 mt-1 pl-1">API Key 僅儲存於瀏覽器，保障您的隱私</p>
                          </div>

                          <div>
                              <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                                  <Database className="w-3 h-3" /> Google Apps Script URL
                              </label>
                              <input 
                                  type="text" 
                                  value={gasUrl}
                                  onChange={(e) => setGasUrlState(e.target.value)}
                                  className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="https://script.google.com/..."
                              />
                              <p className="text-[10px] text-gray-400 mt-1">用於雲端資料同步</p>
                          </div>

                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                              <h4 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                                  <Code className="w-4 h-4" /> 試算表格式修復
                              </h4>
                              <p className="text-xs text-orange-700 mb-3 leading-relaxed">
                                  如果您發現個人資料無法保存，請點擊下方按鈕複製最新的後端程式碼，並至 Google Apps Script 貼上並重新部署。這將自動修復試算表格式問題。
                              </p>
                              <button 
                                  onClick={copyGasCode}
                                  className="w-full bg-white border border-orange-200 text-orange-700 font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors"
                              >
                                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  {copied ? "已複製！" : "複製更新版 GAS 程式碼"}
                              </button>
                          </div>

                          <button 
                            onClick={handleSaveSystem}
                            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
                          >
                            <Save className="w-4 h-4" /> 更新設定
                          </button>
                      </div>
                  </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};
export default HealthManagement;