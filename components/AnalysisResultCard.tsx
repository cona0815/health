import React, { useState } from 'react';
import { FoodAnalysis, RiskLevel, MealType } from '../types';
import { Edit2, ShieldAlert, Scale, Flame, Droplets, Wheat, Beef, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  data: FoodAnalysis;
  onUpdateLog?: (timestamp: string, updatedLog: FoodAnalysis) => void;
}

const AnalysisResultCard: React.FC<Props> = ({ data, onUpdateLog }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.DANGEROUS: return 'text-red-600 bg-red-50 border-red-200';
      case RiskLevel.MODERATE: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case RiskLevel.SAFE: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskLabel = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.DANGEROUS: return '紅燈注意';
      case RiskLevel.MODERATE: return '黃燈適量';
      case RiskLevel.SAFE: return '綠燈優選';
      default: return '未評級';
    }
  };

  const handleMealTypeChange = (newType: MealType) => {
    if (onUpdateLog) {
      onUpdateLog(data.timestamp, { ...data, mealType: newType });
    }
    setIsEditing(false);
  };

  // 提取三大營養素 (安全存取)
  const getNutrient = (keyword: string) => {
      // 防呆：確保 nutrients 存在且為陣列
      const list = Array.isArray(data.nutrients) ? data.nutrients : [];
      const nutrient = list.find(n => n && n.name && n.name.includes(keyword));
      return nutrient ? nutrient.amount : '0';
  };
  
  const protein = getNutrient('蛋白');
  const fat = getNutrient('脂肪');
  const carbs = getNutrient('碳水') || getNutrient('醣');
  
  // 防呆：確保 ingredients 存在
  const safeIngredients = Array.isArray(data.ingredients) ? data.ingredients : [];
  // 防呆：確保 nutrients 存在
  const safeNutrients = Array.isArray(data.nutrients) ? data.nutrients : [];

  return (
    <div className="w-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6 animate-fade-in-up transition-all hover:shadow-xl">
      {/* Header Section */}
      <div className="p-6 pb-2">
        <div className="flex justify-between items-start mb-4">
           <div>
              <div className="flex items-center gap-2 mb-1">
                 {isEditing && onUpdateLog ? (
                    <select 
                      value={data.mealType} 
                      onChange={(e) => handleMealTypeChange(e.target.value as MealType)}
                      className="text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1 outline-none text-gray-700 font-bold"
                    >
                        {['早餐', '午餐', '晚餐', '點心/飲料'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                 ) : (
                    <span 
                        onClick={() => onUpdateLog && setIsEditing(true)}
                        className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors ${onUpdateLog ? 'bg-gray-100 text-gray-500' : 'bg-transparent text-gray-400'}`}
                    >
                        {data.mealType}
                        {onUpdateLog && <Edit2 className="w-2 h-2 inline ml-1 opacity-50" />}
                    </span>
                 )}
                 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getRiskColor(data.riskLevel)}`}>
                    {getRiskLabel(data.riskLevel)}
                 </span>
              </div>
              <h2 className="text-2xl font-black text-gray-800 leading-tight">{data.foodName}</h2>
              {data.estimatedWeight && (
                  <p className="text-sm text-gray-400 mt-1 flex items-center gap-1 font-medium">
                      <Scale className="w-3.5 h-3.5" /> {data.estimatedWeight}
                  </p>
              )}
           </div>
           
           {/* Total Calories Badge - Big and Bold */}
           <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-orange-500 mb-1">
                 <Flame className="w-4 h-4 fill-orange-500" />
                 <span className="text-xs font-bold uppercase tracking-wider">熱量</span>
              </div>
              <p className="text-3xl font-black text-gray-900 leading-none">{data.calories}</p>
              <p className="text-xs text-gray-400 font-bold">kcal</p>
           </div>
        </div>

        {/* Macro Nutrients Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-orange-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-orange-100">
                <p className="text-xs font-bold text-orange-400 mb-1">蛋白質</p>
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-1">
                    <Beef className="w-4 h-4" />
                </div>
                <p className="font-black text-gray-800 text-lg">{protein}<span className="text-xs font-normal text-gray-500">g</span></p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-blue-100">
                <p className="text-xs font-bold text-blue-400 mb-1">碳水</p>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                    <Wheat className="w-4 h-4" />
                </div>
                <p className="font-black text-gray-800 text-lg">{carbs}<span className="text-xs font-normal text-gray-500">g</span></p>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-yellow-100">
                <p className="text-xs font-bold text-yellow-600 mb-1">脂肪</p>
                <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-1">
                    <Droplets className="w-4 h-4" />
                </div>
                <p className="font-black text-gray-800 text-lg">{fat}<span className="text-xs font-normal text-gray-500">g</span></p>
            </div>
        </div>
      </div>

      {/* Accordion for Details */}
      <button 
         onClick={() => setShowDetails(!showDetails)}
         className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 font-bold hover:bg-gray-50 transition-colors border-t border-gray-50"
      >
         {showDetails ? "收合詳細資訊" : "查看詳細成份與建議"}
         {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showDetails && (
          <div className="bg-gray-50/50 border-t border-gray-100 p-6 pt-4 animate-fade-in">
             {/* Ingredients */}
             {safeIngredients.length > 0 && (
                 <div className="mb-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">主要食材</p>
                    <div className="flex flex-wrap gap-2">
                        {safeIngredients.map((ing, i) => (
                            <span key={i} className="text-sm bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 shadow-sm">
                                {ing}
                            </span>
                        ))}
                    </div>
                 </div>
             )}

             {/* Other Nutrients List */}
             <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">詳細營養</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {safeNutrients.map((n, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b border-gray-200 border-dashed py-1">
                            <span className="text-gray-500">{n.name}</span>
                            <span className="font-medium text-gray-800">{n.amount}{n.unit}</span>
                        </div>
                    ))}
                </div>
             </div>

             {/* AI Health Advice */}
             <div className={`rounded-xl p-4 border ${data.riskLevel === RiskLevel.DANGEROUS ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                    {data.riskLevel === RiskLevel.DANGEROUS ? <ShieldAlert className="w-5 h-5 text-red-500" /> : <Scale className="w-5 h-5 text-indigo-500" />}
                    <span className={`font-bold text-sm ${data.riskLevel === RiskLevel.DANGEROUS ? 'text-red-700' : 'text-indigo-700'}`}>
                        AI 健康建議
                    </span>
                </div>
                <p className={`text-sm leading-relaxed text-justify ${data.riskLevel === RiskLevel.DANGEROUS ? 'text-red-800' : 'text-indigo-800'}`}>
                    {data.healthAdvice}
                </p>
             </div>
          </div>
      )}
    </div>
  );
};

export default AnalysisResultCard;