import React, { useState } from 'react';
import { Database, Link, CheckCircle, AlertCircle, Loader2, ArrowRight, HelpCircle, ChevronDown, ChevronUp, User } from 'lucide-react';
import { dbService, setGasUrl } from '../services/dbService';

interface Props {
  onConnect: () => void;
}

const GasSetup: React.FC<Props> = ({ onConnect }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleConnect = async () => {
    setError(null);
    const cleanUrl = url.trim();
    const cleanName = name.trim();

    // 1. 驗證欄位
    if (!cleanName) {
        setError("請輸入您的稱呼 (例如: Alex)");
        return;
    }
    
    if (!cleanUrl) {
        setError("請輸入 Google Apps Script 網址");
        return;
    }

    if (!cleanUrl.includes('script.google.com')) {
        setError("這看起來不像是 Google Apps Script 的網址 (應該包含 script.google.com)");
        return;
    }
    
    setLoading(true);
    
    // 2. 測試連線
    try {
        const success = await dbService.testConnection(cleanUrl);
        if (success) {
            setGasUrl(cleanUrl);
            // 連線成功後，嘗試同步名字
            try {
                const data = await dbService.loadAllData();
                if (!data.profile.name) {
                    await dbService.saveUserProfile({ ...data.profile, name: cleanName });
                }
            } catch (e) {
                console.error("Initial sync warning", e);
            }
            onConnect();
        } else {
            // testConnection 返回 false 代表 fetch 成功但回傳內容不是預期的 JSON
            setError("連線失敗。請檢查：部署設定中的「誰可以存取」必須設為「所有人 (Anyone)」。");
        }
    } catch (e: any) {
        console.error(e);
        // 捕捉 fetch 錯誤 (例如 CORS 或是 401)
        setError("無法連線至資料庫。請確認網址正確，且您已將權限設為「所有人 (Anyone)」。");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">連結您的 Google 資料庫</h1>
            <p className="text-green-100 opacity-90">只需要貼上網址，就能將健康資料存入您自己的 Google 試算表。</p>
        </div>

        <div className="p-8 space-y-6">
            
            {/* Help Toggle */}
            <div className="border border-blue-100 bg-blue-50 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setShowHelp(!showHelp)}
                  className="w-full flex items-center justify-between p-4 text-blue-800 font-bold hover:bg-blue-100 transition-colors"
                >
                    <span className="flex items-center gap-2"><HelpCircle className="w-5 h-5"/> 不知道網址在哪裡？點我看教學</span>
                    {showHelp ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                </button>
                
                {showHelp && (
                    <div className="p-4 bg-white text-sm text-gray-600 space-y-3 border-t border-blue-100">
                        <div className="flex gap-3">
                           <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs">1</span>
                           <p>在您的 Google Sheet 點擊上方選單 <strong>擴充功能</strong> &gt; <strong>Apps Script</strong>。</p>
                        </div>
                        <div className="flex gap-3">
                           <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs">2</span>
                           <p>貼上程式碼後，點擊右上角藍色按鈕 <strong>部署 (Deploy)</strong> &gt; <strong>新增部署 (New deployment)</strong>。</p>
                        </div>
                        <div className="flex gap-3">
                           <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs">3</span>
                           <div>
                               <p className="mb-1">點擊左側齒輪選 <strong>網頁應用程式 (Web app)</strong>，並設定：</p>
                               <ul className="list-disc pl-4 text-gray-500 space-y-1">
                                   <li>執行身分：<strong>我 (Me)</strong></li>
                                   <li>誰可以存取：<strong>所有人 (Anyone)</strong> <span className="text-red-500 font-bold">*最重要</span></li>
                               </ul>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs">4</span>
                           <p>部署成功後，複製下方的 <strong>網頁應用程式網址 (Web app URL)</strong>，就是它了！</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                 <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                        您的稱呼
                    </h3>
                    <div className="relative">
                        <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例如: Alex"
                            className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all ${!name && error ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        />
                    </div>
                </div>

                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                        輸入部署網址 (Web App URL)
                    </h3>
                    <div className="relative">
                        <Link className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                        <input 
                            type="text" 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/..../exec"
                            className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all ${!url && error ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        />
                    </div>
                </div>

                {error && (
                    <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg animate-fade-in border border-red-100">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> 
                        <span>{error}</span>
                    </div>
                )}
            </div>

            <button 
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading ? "正在測試連線..." : "開始使用"}
            </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-center text-gray-400 max-w-md">
          請放心，此網址僅儲存在您的瀏覽器中。App 會直接與您的 Google Sheet 溝通，不會經過第三方伺服器。
      </p>
    </div>
  );
};

export default GasSetup;