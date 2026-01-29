import React, { useState } from 'react';
import { Key, ArrowRight, Loader2, ExternalLink } from 'lucide-react';
import { setGeminiKey } from '../services/geminiService';

interface Props {
  onComplete: () => void;
}

const ApiKeySetup: React.FC<Props> = ({ onComplete }) => {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!key.trim()) return alert("請輸入 API Key");
    setLoading(true);
    // 簡單驗證並儲存
    setGeminiKey(key.trim());
    setTimeout(() => {
      setLoading(false);
      onComplete();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
           <Key className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">啟動您的 AI 核心</h2>
        <p className="text-center text-gray-500 mb-6">
           為了在手機上順暢運行，請輸入您的 Gemini API Key。金鑰僅會儲存在您的手機瀏覽器中。
        </p>

        <div className="space-y-4">
           <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Gemini API Key</label>
              <input 
                type="password" 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
              />
           </div>

           <button 
             onClick={handleSubmit}
             disabled={loading}
             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
           >
             {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
             {loading ? "啟動中..." : "開始使用"}
           </button>

           <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-indigo-500 hover:underline mt-4">
              <ExternalLink className="w-3 h-3" /> 沒有金鑰？點此免費獲取
           </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySetup;