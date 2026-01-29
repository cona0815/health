import React, { useState, useRef } from 'react';
import { Pill, Upload, Loader2, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { analyzeMedication, fileToGenerativePart } from '../services/geminiService';
import { HealthReport, Medication, RiskLevel } from '../types';

interface Props {
  healthReport: HealthReport | null;
}

const MedicationManager: React.FC<Props> = ({ healthReport }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Medication | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const base64 = await fileToGenerativePart(file);
      const data = await analyzeMedication(base64, file.type, healthReport || undefined);
      setResult(data);
    } catch (e) {
      alert("分析失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-red-400 to-pink-500 p-6 rounded-2xl text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Pill className="w-6 h-6" />
          智慧藥師
        </h2>
        <p className="opacity-90 mt-2">拍下藥袋或保健品，AI 自動檢查是否與您的健檢報告有衝突。</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <p className="text-gray-600 font-medium">上傳藥品/保健品照片</p>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
        {loading && <div className="mt-4 text-center text-red-500"><Loader2 className="w-6 h-6 animate-spin mx-auto"/>正在分析藥物成分與交互作用...</div>}
      </div>

      {result && (
        <div className={`rounded-xl border p-6 shadow-lg ${result.riskLevel === RiskLevel.DANGEROUS ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-900">{result.name}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${result.riskLevel === RiskLevel.DANGEROUS ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {result.riskLevel === RiskLevel.DANGEROUS ? <ShieldAlert className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}
              {result.riskLevel === RiskLevel.DANGEROUS ? '風險警示' : '安全通行'}
            </span>
          </div>

          <div className="space-y-4">
             <div className="bg-white/60 p-3 rounded-lg">
               <p className="text-xs text-gray-500 font-bold uppercase">適應症</p>
               <p className="text-gray-800">{result.indication}</p>
             </div>
             <div className="bg-white/60 p-3 rounded-lg">
               <p className="text-xs text-gray-500 font-bold uppercase">用法用量</p>
               <p className="text-gray-800">{result.usage}</p>
             </div>
             
             {result.riskLevel === RiskLevel.DANGEROUS && (
               <div className="bg-red-100 p-4 rounded-lg border border-red-300 animate-pulse">
                 <p className="font-bold text-red-800 flex items-center gap-2">
                   <AlertTriangle className="w-5 h-5" /> 交互作用警告
                 </p>
                 <p className="text-red-700 mt-1">{result.interactionWarning}</p>
               </div>
             )}
             
             {result.riskLevel === RiskLevel.SAFE && (
                <div className="bg-green-100 p-3 rounded-lg border border-green-300">
                    <p className="text-green-800 text-sm">{result.interactionWarning || "與目前健檢報告無明顯衝突。"}</p>
                </div>
             )}

             <div className="text-sm text-gray-500 mt-2">
               <span className="font-bold">常見副作用:</span> {result.sideEffects}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MedicationManager;
