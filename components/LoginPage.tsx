import React, { useState } from 'react';
import { Activity, ShieldCheck, HeartPulse, BrainCircuit, ChevronRight, Loader2, User } from 'lucide-react';
import { signInWithCustomAccount } from '../services/firebaseConfig';

interface Props {
  onGuestLogin?: () => void; // Kept for interface compatibility but not used
}

const LoginPage: React.FC<Props> = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
        alert("請輸入您的名字或暱稱");
        return;
    }
    setLoading(true);
    try {
        await signInWithCustomAccount(username);
    } catch (error) {
        console.error(error);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-sans text-gray-900">
      {/* Left: Content & Brand */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-20 py-12 bg-white relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50 to-transparent opacity-60 z-0 pointer-events-none" />
         
         <div className="relative z-10 max-w-lg mx-auto w-full">
            <div className="flex items-center gap-3 mb-8 animate-fade-in">
              <div className="bg-gradient-to-r from-teal-500 to-blue-600 p-3 rounded-2xl shadow-lg">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600">
                HealthGuardian AI
              </h1>
            </div>

            <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight animate-fade-in-up" style={{animationDelay: '0.1s'}}>
              您的個人化 <br />
              <span className="text-blue-600">AI 健康管家</span>
            </h2>

            <p className="text-lg text-gray-500 mb-10 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              專為個人使用設計。所有健康數據安全儲存於您的裝置上，無需擔心隱私外洩。
            </p>

            {/* Login Options Container */}
            <div className="space-y-6 mb-12 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
               <form onSubmit={handleLogin} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-4 max-w-md">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-gray-800">開始使用 (本機模式)</h3>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 ml-1">您的暱稱</label>
                        <div className="relative">
                            <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="例如: Alex"
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
                    >
                         {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                         進入我的健康儀表板
                    </button>
               </form>
            </div>
            
            <div className="space-y-6 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                <FeatureItem icon={HeartPulse} title="飲食追蹤" desc="拍照自動計算熱量與營養成份，記錄永久保存" color="text-teal-500" />
                <FeatureItem icon={ShieldCheck} title="健檢分析" desc="上傳健檢報告，AI 自動比對飲食禁忌" color="text-red-500" />
            </div>
         </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:block lg:w-1/2 bg-blue-600 relative overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=2832&auto=format&fit=crop" 
          alt="Health Lifestyle" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent" />
        <div className="absolute bottom-20 left-12 right-12 text-white p-8 bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl animate-fade-in-up" style={{animationDelay: '0.5s'}}>
           <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white">
                 <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" alt="User" />
              </div>
              <div>
                 <p className="font-bold text-lg">安全、隱私、個人化</p>
                 <p className="text-blue-100 text-sm">Local Storage Technology</p>
              </div>
           </div>
           <p className="text-xl font-medium leading-relaxed italic">
             "不再需要註冊繁瑣的帳號，所有資料都掌握在自己手中。這才是真正的個人健康管理。"
           </p>
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) => (
  <div className="flex items-start gap-4">
    <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <h3 className="font-bold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  </div>
);

export default LoginPage;