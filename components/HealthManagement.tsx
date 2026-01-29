import React, { useState } from 'react';
import { User, FileText, Calendar, Ruler, Weight, Activity, Pill, UserCircle } from 'lucide-react';
import { UserProfile, HealthReport, SavedAppointment } from '../types';
import HealthReportAnalyzer from './HealthReportAnalyzer';
import AppointmentScheduler from './AppointmentScheduler';
import MedicationManager from './MedicationManager';

interface Props {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  healthReports: HealthReport[];
  onReportAnalyzed: (report: HealthReport) => void;
  appointments: SavedAppointment[];
  onSaveAppointment: (appointment: SavedAppointment) => void;
}

type SubTab = 'PROFILE' | 'REPORTS' | 'APPOINTMENTS' | 'MEDICATION';

const HealthManagement: React.FC<Props> = ({ 
  userProfile, 
  onUpdateProfile, 
  healthReports, 
  onReportAnalyzed,
  appointments,
  onSaveAppointment
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('PROFILE');
  const [tempName, setTempName] = useState(userProfile.name || '');
  const [tempHeight, setTempHeight] = useState(userProfile.height);
  const [tempWeight, setTempWeight] = useState(userProfile.weight);

  const calculateBMI = (h: string, w: string) => {
    if (!h || !w) return null;
    const heightM = parseFloat(h) / 100;
    const weightKg = parseFloat(w);
    if (isNaN(heightM) || isNaN(weightKg) || heightM === 0) return null;
    return (weightKg / (heightM * heightM)).toFixed(1);
  };

  const bmi = calculateBMI(tempHeight, tempWeight);

  const handleSaveProfile = () => {
    onUpdateProfile({ name: tempName, height: tempHeight, weight: tempWeight });
    alert("個人資料已更新！");
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
            <AppointmentScheduler appointments={appointments} onSaveAppointment={onSaveAppointment} />
          )}

        </div>
      </div>
    </div>
  );
};
export default HealthManagement;