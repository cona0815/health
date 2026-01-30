import React, { useState, useEffect } from 'react';
import { User, FileText, Calendar, Ruler, Weight, Activity, Pill, UserCircle, Settings, Key, Database, Save, Eye, EyeOff, Code, Copy, Check } from 'lucide-react';
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
        name: tempName, 
        height: tempHeight, 
        weight: tempWeight 
    };
    onUpdateProfile(updatedProfile);
    alert("個人資料已更新並保存！");
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
                              <p className="text-[10px] text-gray-400 mt-1">用於圖像辨識與 AI 建議生成</p>
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