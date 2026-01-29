import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, Utensils, Sparkles, ChefHat, RefreshCw, MapPin, ExternalLink, Navigation, ShoppingBag } from 'lucide-react';
import { analyzeFoodImage, fileToGenerativePart, generateFoodSuggestions, findNearbyRestaurants } from '../services/geminiService';
import { FoodAnalysis, HealthReport, UserProfile, FoodSuggestion, RiskLevel, Recipe } from '../types';
import AnalysisResultCard from './AnalysisResultCard';
import GroceryAssistant from './GroceryAssistant';

interface Props {
  healthReport: HealthReport | null;
  userProfile: UserProfile;
  onAnalysisComplete: (result: FoodAnalysis) => void;
  onUpdateLog?: (timestamp: string, updatedLog: FoodAnalysis) => void;
  savedRecipes: Recipe[];
  onSaveRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (id: string) => void;
}

const FoodAnalyzer: React.FC<Props> = ({ healthReport, userProfile, onAnalysisComplete, onUpdateLog, savedRecipes, onSaveRecipe, onDeleteRecipe }) => {
  const [viewMode, setViewMode] = useState<'MEAL' | 'GROCERY'>('MEAL');
  const [loading, setLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [mapLoadingId, setMapLoadingId] = useState<number | null>(null);
  
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentResult, setCurrentResult] = useState<FoodAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setCurrentResult(null);
    setSuggestions([]); 
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);

    try {
      const base64 = await fileToGenerativePart(file);
      const result = await analyzeFoodImage(base64, file.type, healthReport || undefined, userProfile);
      setCurrentResult(result);
      onAnalysisComplete(result);
    } catch (err) {
      setError("分析失敗，請確認照片清晰或網路連線正常。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        alert("您的瀏覽器不支援定位功能");
        reject("Geolocation not supported");
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(loc);
            resolve(loc);
          },
          (error) => {
            console.error("Error getting location:", error);
            alert("無法獲取您的位置，將僅提供一般建議。");
            reject(error);
          }
        );
      }
    });
  };

  const handleGetSuggestions = async () => {
    setSuggestionLoading(true);
    setSuggestions([]);
    try { await getUserLocation(); } catch (e) {}
    try {
      const results = await generateFoodSuggestions(healthReport || undefined, userProfile);
      setSuggestions(results);
    } catch (err) {
      console.error(err);
      alert("暫時無法獲取建議");
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleFindNearby = async (index: number, foodName: string) => {
    let loc = userLocation;
    
    if (!loc) {
        try { 
            loc = await getUserLocation(); 
        } catch(e) { 
            return; 
        }
    }
    
    if (!loc) return; 

    setMapLoadingId(index);
    try {
        const places = await findNearbyRestaurants(foodName, loc.lat, loc.lng);
        if (!places || places.length === 0) {
            alert("找不到附近的相關店家");
        }
        setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, restaurants: places } : s));
    } catch (e) { 
        console.error(e);
        alert("搜尋附近店家失敗"); 
    } finally { 
        setMapLoadingId(null); 
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* View Toggle */}
      <div className="flex p-1 bg-gray-200 rounded-xl mb-4">
        <button 
           onClick={() => setViewMode('MEAL')}
           className={`flex-1 py-2.5 md:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'MEAL' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}
        >
          <Utensils className="w-4 h-4"/> 餐點分析
        </button>
        <button 
           onClick={() => setViewMode('GROCERY')}
           className={`flex-1 py-2.5 md:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'GROCERY' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}
        >
          <ShoppingBag className="w-4 h-4"/> 購物與食譜
        </button>
      </div>

      {viewMode === 'GROCERY' ? (
        <GroceryAssistant 
          userProfile={userProfile} 
          healthReport={healthReport} 
          savedRecipes={savedRecipes}
          onSaveRecipe={onSaveRecipe}
          onDeleteRecipe={onDeleteRecipe}
        />
      ) : (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-5 md:p-6 rounded-2xl text-white shadow-lg">
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Utensils className="w-5 h-5 md:w-6 md:h-6" />
              食物成份分析
            </h2>
            <p className="opacity-90 mt-2 text-sm md:text-base">
              {healthReport || (userProfile.height && userProfile.weight)
                ? "已啟用個人化模式：將根據您的 BMI 與健檢報告分析飲食風險。" 
                : "一般模式：請在「健康管理」設定身高體重以獲得更精準建議。"}
            </p>
          </div>

          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 md:p-8 hover:bg-gray-50 transition-colors cursor-pointer active:scale-95 duration-200"
                onClick={() => fileInputRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Food Preview" className="max-h-56 md:max-h-64 rounded-lg object-contain mb-4 shadow-sm" />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4">
                  <Camera className="w-7 h-7 md:w-8 md:h-8" />
                </div>
              )}
              <p className="text-gray-600 font-medium">點擊上傳或拍攝食物照片</p>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>

            {loading && (
              <div className="mt-6 flex flex-col items-center text-teal-600">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">AI 正在計算熱量並評估您的個人風險...</p>
              </div>
            )}
            {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}

            {!loading && !preview && (
              <div className="mt-6 md:mt-8 pt-6 border-t border-gray-100">
                 <div className="text-center mb-4">
                   <p className="text-gray-600 font-medium">外食族不知道吃什麼？</p>
                   <p className="text-sm text-gray-400">AI 根據您的位置與健康狀況推薦「綠燈/黃燈」美食</p>
                 </div>
                 <button 
                    onClick={handleGetSuggestions}
                    disabled={suggestionLoading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 active:scale-95"
                 >
                    {suggestionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {suggestionLoading ? "AI 正在分析附近美食..." : "獲取外食推薦建議"}
                 </button>
              </div>
            )}
          </div>

          {suggestions.length > 0 && !preview && (
            <div className="space-y-4 animate-fade-in-up">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                     <ChefHat className="w-5 h-5 text-emerald-600" /> 為您推薦
                  </h3>
                  <button onClick={handleGetSuggestions} className="text-sm text-gray-500 flex items-center gap-1 hover:text-emerald-600"><RefreshCw className="w-3 h-3" /> 換一批</button>
               </div>
               <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestions.map((item, idx) => (
                    <div key={idx} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${item.riskLevel === RiskLevel.SAFE ? 'border-emerald-100' : 'border-yellow-200'}`}>
                       <div className="flex justify-between items-start mb-2">
                          <div>
                              <h4 className="font-bold text-gray-800 text-lg">{item.name}</h4>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.riskLevel === RiskLevel.SAFE ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {item.riskLevel === RiskLevel.SAFE ? '綠燈 (優選)' : '黃燈 (適量)'}
                              </span>
                          </div>
                          <span className="text-gray-500 text-xs font-bold whitespace-nowrap">~{item.calories} kcal</span>
                       </div>
                       <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                       <div className="mb-3">
                         <p className="text-xs text-gray-400 mb-1">推薦原因:</p>
                         <p className={`text-xs font-medium p-2 rounded-lg ${item.riskLevel === RiskLevel.SAFE ? 'bg-emerald-50 text-emerald-600' : 'bg-yellow-50 text-yellow-600'}`}>{item.reason}</p>
                       </div>
                       <div className="flex flex-wrap gap-1 mb-4">
                          {item.tags.map((tag, tIdx) => (<span key={tIdx} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">#{tag}</span>))}
                       </div>
                       {item.restaurants && item.restaurants.length > 0 ? (
                           <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                               <p className="text-xs font-bold text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> 附近店家:</p>
                               {item.restaurants.map((r, rIdx) => (
                                   <a key={rIdx} href={r.uri} target="_blank" rel="noopener noreferrer" className="block bg-blue-50 hover:bg-blue-100 text-blue-700 p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between group active:bg-blue-200">
                                       <span className="font-medium truncate pr-2">{r.name}</span>
                                       <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                   </a>
                               ))}
                           </div>
                       ) : (
                           <button onClick={() => handleFindNearby(idx, item.name)} disabled={mapLoadingId === idx} className={`w-full py-3 md:py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${item.riskLevel === RiskLevel.SAFE ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:bg-emerald-200' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 active:bg-yellow-200'}`}>
                             {mapLoadingId === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                             {mapLoadingId === idx ? "搜尋中..." : "找附近店家"}
                           </button>
                       )}
                    </div>
                  ))}
               </div>
            </div>
          )}
          
           {currentResult && (
             <div className="animate-fade-in">
                <h3 className="text-lg font-bold text-gray-800 mb-3 px-1">分析結果</h3>
                <AnalysisResultCard data={currentResult} onUpdateLog={onUpdateLog} />
             </div>
           )}
        </>
      )}
    </div>
  );
};

export default FoodAnalyzer;