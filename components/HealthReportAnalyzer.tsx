import React, { useState, useRef } from 'react';
import { FileText, Upload, Loader2, AlertCircle, History, ChevronDown, ChevronUp, ShieldAlert, GitCompare, ArrowRight, ArrowUpRight, ArrowDownRight, X, CheckSquare, Square, TrendingUp } from 'lucide-react';
import { analyzeHealthReport, fileToGenerativePart } from '../services/geminiService';
import { HealthReport } from '../types';

interface Props {
  reports: HealthReport[];
  onReportAnalyzed: (report: HealthReport) => void;
}

const HealthReportAnalyzer: React.FC<Props> = ({ reports, onReportAnalyzed }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedReportIndex, setExpandedReportIndex] = useState<number | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentReport = reports.length > 0 ? reports[0] : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const base64 = await fileToGenerativePart(file);
      const report = await analyzeHealthReport(base64, file.type);
      onReportAnalyzed(report);
    } catch (err) {
      setError("無法辨識健檢報告，請確認圖片清晰度。");
    } finally {
      setLoading(false);
    }
  };

  const toggleReport = (index: number) => setExpandedReportIndex(expandedReportIndex === index ? null : index);

  const toggleSelection = (index: number) => {
    if (selectedForCompare.includes(index)) {
      setSelectedForCompare(prev => prev.filter(i => i !== index));
    } else {
      if (selectedForCompare.length < 2) setSelectedForCompare(prev => [...prev, index]);
      else alert("請先取消勾選一份報告，最多只能對比兩份。");
    }
  };

  const startComparison = () => {
    if (selectedForCompare.length === 2) setShowComparison(true);
  };

  const closeComparison = () => {
    setShowComparison(false);
    setSelectedForCompare([]);
  };

  const getStatusWeight = (status: string) => {
    if (status === 'Critical') return 3;
    if (status === 'Warning') return 2;
    return 1; 
  };

  // Helper to safely parse number from string like "120 mg/dl"
  const safeParseFloat = (val: string) => {
      const match = val.match(/[\d\.]+/);
      return match ? parseFloat(match[0]) : 0;
  }

  const renderComparisonView = () => {
    if (selectedForCompare.length !== 2) return null;
    const r1 = reports[selectedForCompare[0]];
    const r2 = reports[selectedForCompare[1]];
    const [oldReport, newReport] = new Date(r1.analyzedAt) < new Date(r2.analyzedAt) ? [r1, r2] : [r2, r1];
    
    const allMetricNames = Array.from(new Set([...oldReport.metrics.map(m => m.name), ...newReport.metrics.map(m => m.name)]));

    return (
      <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden animate-fade-in">
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2"><GitCompare className="w-5 h-5" /> 健康趨勢比對</h3>
          <button onClick={closeComparison} className="p-1 hover:bg-indigo-200 rounded-full transition-colors text-indigo-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-x-auto">
          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
             <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500 mb-1">基準報告 (舊)</p>
                <p className="font-bold text-gray-800">{new Date(oldReport.analyzedAt).toLocaleDateString()}</p>
             </div>
             <div className="flex items-center justify-center"><ArrowRight className="w-6 h-6 text-gray-400" /></div>
             <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-500 mb-1">對照報告 (新)</p>
                <p className="font-bold text-blue-800">{new Date(newReport.analyzedAt).toLocaleDateString()}</p>
             </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left rounded-l-lg">檢查項目</th>
                <th className="px-4 py-2 text-center">舊數值</th>
                <th className="px-4 py-2 text-center">趨勢圖</th>
                <th className="px-4 py-2 text-center">新數值</th>
                <th className="px-4 py-2 text-right rounded-r-lg">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allMetricNames.map((name, idx) => {
                const oldM = oldReport.metrics.find(m => m.name === name);
                const newM = newReport.metrics.find(m => m.name === name);
                if (!oldM && !newM) return null;

                const oldWeight = oldM ? getStatusWeight(oldM.status) : 0;
                const newWeight = newM ? getStatusWeight(newM.status) : 0;
                
                let trendIcon = <span className="text-gray-300">-</span>;
                let trendColor = "text-gray-500";
                let statusText = "持平";

                const oldValNum = oldM ? safeParseFloat(oldM.value) : 0;
                const newValNum = newM ? safeParseFloat(newM.value) : 0;
                const maxVal = Math.max(oldValNum, newValNum) || 100; // avoid div by zero

                if (oldM && newM) {
                   if (newWeight > oldWeight) {
                      trendIcon = <ArrowUpRight className="w-4 h-4" />;
                      trendColor = "text-red-600 font-bold";
                      statusText = "變差";
                   } else if (newWeight < oldWeight) {
                      trendIcon = <ArrowDownRight className="w-4 h-4" />;
                      trendColor = "text-green-600 font-bold";
                      statusText = "改善";
                   } else if (newWeight > 1) {
                      trendColor = "text-yellow-600";
                      statusText = "未改善";
                   }
                } else if (!oldM) {
                   statusText = "新增";
                   trendColor = "text-blue-600";
                }

                return (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{oldM ? oldM.value : '--'}</td>
                    <td className="px-4 py-3 flex items-center justify-center h-full">
                       {/* Simple Bar Chart */}
                       {oldM && newM && maxVal > 0 && (
                           <div className="flex items-end h-8 gap-1 w-16">
                               <div className="w-3 bg-gray-300 rounded-t" style={{height: `${(oldValNum/maxVal)*100}%`}}></div>
                               <div className={`w-3 rounded-t ${newWeight > oldWeight ? 'bg-red-400' : newWeight < oldWeight ? 'bg-green-400' : 'bg-blue-400'}`} style={{height: `${(newValNum/maxVal)*100}%`}}></div>
                           </div>
                       )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{newM ? newM.value : '--'}</td>
                    <td className={`px-4 py-3 text-right ${trendColor} flex items-center justify-end gap-1`}>{statusText} {trendIcon}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> 健檢報告檔案庫</h2>
        <p className="opacity-90 mt-2">上傳健檢報告，AI 自動追蹤健康趨勢並提供飲食禁忌建議。</p>
      </div>

      {showComparison ? renderComparisonView() : (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><Upload className="w-8 h-8" /></div>
              <p className="text-gray-600 font-medium">上傳新的健檢報告</p>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            {loading && <div className="mt-6 flex flex-col items-center text-blue-600"><Loader2 className="w-8 h-8 animate-spin mb-2" /><p className="text-sm font-medium">AI 正在解讀報告數據並建檔...</p></div>}
            {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
          </div>

          {currentReport && (
            <div className="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden ring-1 ring-blue-100">
              <div className="p-4 border-b border-gray-100 bg-blue-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
                  <h3 className="font-bold text-gray-800">最新報告 (分析依據)</h3>
                </div>
                <span className="text-sm font-medium text-gray-600">{new Date(currentReport.analyzedAt).toLocaleDateString()}</span>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-700 italic border-l-4 border-blue-500 pl-4 py-1 bg-gray-50 rounded-r">"{currentReport.summary}"</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {currentReport.metrics.map((metric, idx) => (
                    <div key={idx} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-900">{metric.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${metric.status === 'Critical' ? 'bg-red-100 text-red-700' : metric.status === 'Warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{metric.value}</span>
                      </div>
                      <p className="text-xs text-gray-500">{metric.advice}</p>
                    </div>
                  ))}
                </div>
                {currentReport.dietaryRestrictions && currentReport.dietaryRestrictions.length > 0 && (
                  <div className="mt-4 bg-red-50 p-5 rounded-xl border border-red-200">
                    <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2 text-lg"><ShieldAlert className="w-5 h-5 text-red-600" /> AI 建議：飲食禁忌</h4>
                    <ul className="list-disc pl-5 space-y-2">{currentReport.dietaryRestrictions.map((item, i) => <li key={i} className="text-red-700 font-medium">{item}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {reports.length > 0 && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2"><History className="w-5 h-5" /> 報告存檔 ({reports.length})</h3>
                  {selectedForCompare.length === 2 ? (
                    <button onClick={startComparison} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md animate-bounce"><TrendingUp className="w-4 h-4" /> 查看趨勢圖</button>
                  ) : <span className="text-xs text-gray-400">勾選 2 份報告進行趨勢對比</span>}
              </div>
              <div className="space-y-4">
                  {reports.map((report, idx) => {
                    const isExpanded = expandedReportIndex === idx;
                    const isSelected = selectedForCompare.includes(idx);
                    const isDisabled = selectedForCompare.length >= 2 && !isSelected;
                    return (
                        <div key={idx} className={`bg-white rounded-xl border transition-all shadow-sm ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'}`}>
                          <div className="flex items-center p-4">
                              <button onClick={(e) => { e.stopPropagation(); toggleSelection(idx); }} disabled={isDisabled} className={`mr-4 p-1 rounded transition-colors ${isSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-500'} ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>{isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}</button>
                              <div className="flex-1 flex justify-between items-center cursor-pointer" onClick={() => toggleReport(idx)}>
                                <div><p className="font-semibold text-gray-800">{idx === 0 ? "最新健檢報告" : `存檔報告 #${reports.length - idx}`}</p><p className="text-xs text-gray-500">{new Date(report.analyzedAt).toLocaleDateString()}</p></div>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400"/> : <ChevronDown className="w-5 h-5 text-gray-400"/>}
                              </div>
                          </div>
                          {isExpanded && (
                              <div className="p-4 border-t border-gray-100 bg-gray-50 text-sm animate-fade-in">
                                <p className="mb-2 text-gray-600">{report.summary}</p>
                                <div className="grid grid-cols-2 gap-2 mb-3">{report.metrics.map((m, i) => (<div key={i} className="flex justify-between border-b border-gray-200 py-1 last:border-0"><span>{m.name}</span><span className={m.status === 'Critical' ? 'text-red-600 font-bold' : m.status === 'Warning' ? 'text-yellow-600 font-bold' : 'text-green-600'}>{m.value}</span></div>))}</div>
                              </div>
                          )}
                        </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default HealthReportAnalyzer;
