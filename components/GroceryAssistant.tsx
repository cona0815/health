import React, { useState } from 'react';
import { ChefHat, ListPlus, Loader2, Check, ExternalLink, Heart, Bookmark, Utensils, Video, Flame, PenLine, Trash2 } from 'lucide-react';
import { generateHealthyRecipes } from '../services/geminiService';
import { HealthReport, UserProfile, Recipe } from '../types';

interface Props {
  userProfile: UserProfile;
  healthReport: HealthReport | null;
  savedRecipes: Recipe[];
  onSaveRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (id: string) => void;
}

interface RecipeCardProps {
  recipe: Recipe;
  isSavedView?: boolean;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onSave: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  isSaved: boolean;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, isSavedView = false, isExpanded, onToggle, onSave, onDelete, isSaved }) => {
  const [localNote, setLocalNote] = useState(recipe.notes || '');

  const handleFavoriteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault(); // 防止事件冒泡造成的副作用
      
      if (isSaved) {
          if (confirm(`確定要將「${recipe.name}」從我的食譜中移除嗎？`)) {
              onDelete(recipe.id);
          }
      } else {
          onSave({ ...recipe, notes: localNote });
      }
  };

  const handleIngredientCheck = (ingredient: string) => {
      const currentChecked = recipe.checkedIngredients || [];
      const newChecked = currentChecked.includes(ingredient)
          ? currentChecked.filter(i => i !== ingredient)
          : [...currentChecked, ingredient];
      
      const updatedRecipe = { ...recipe, checkedIngredients: newChecked };
      
      if (isSaved) {
          onSave(updatedRecipe);
      } else {
          if (confirm("要儲存採買進度，請先收藏此食譜。是否收藏？")) {
              onSave(updatedRecipe);
          }
      }
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalNote(e.target.value);
  };

  const handleNoteBlur = () => {
      if (localNote !== recipe.notes) {
          onSave({ ...recipe, notes: localNote });
      }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div 
            className="p-4 cursor-pointer"
            onClick={() => onToggle(recipe.id)}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    {recipe.name}
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">綠燈料理</span>
                </h4>
                <button 
                    onClick={handleFavoriteClick}
                    className="p-2 -mr-2 transition-transform active:scale-90"
                    title={isSaved ? "取消收藏 (移除)" : "加入最愛"}
                >
                    <Heart className={`w-6 h-6 transition-colors ${isSaved ? "fill-red-500 text-red-500" : "text-gray-300 hover:text-red-400"}`} />
                </button>
            </div>
            
            <p className="text-gray-500 text-sm mb-3">{recipe.reason}</p>
            
            <div className="flex flex-wrap gap-2 text-xs mb-2">
                <span className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded-md font-bold">
                    <Flame className="w-3 h-3"/> {recipe.calories} kcal
                </span>
                {recipe.tags.map((tag, i) => (
                    <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md">#{tag}</span>
                ))}
            </div>

            <div className="flex justify-center mt-2">
                <span className="text-xs text-gray-400 font-medium">
                    {isExpanded ? "收合內容" : "點擊查看食材與步驟"}
                </span>
            </div>
        </div>

        {isExpanded && (
            <div className="px-4 pb-4 pt-0 border-t border-gray-50 bg-gray-50/50 animate-fade-in">
                
                {/* 料理筆記 (僅收藏可見/編輯) */}
                {isSaved && (
                    <div className="mt-4 mb-2">
                        <label className="text-xs font-bold text-indigo-500 mb-1 flex items-center gap-1">
                            <PenLine className="w-3 h-3"/> 我的料理筆記
                        </label>
                        <textarea
                            value={localNote}
                            onChange={handleNoteChange}
                            onBlur={handleNoteBlur}
                            placeholder="例如：鹽巴少放一點，煮久一點..."
                            className="w-full text-sm p-2 border border-indigo-100 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none bg-indigo-50/30"
                            rows={2}
                            onClick={(e) => e.stopPropagation()} 
                        />
                    </div>
                )}

                <div className="mt-3">
                    <h5 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-1"><ListPlus className="w-4 h-4"/> 採買清單</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {recipe.ingredients.map((ing, i) => {
                            const isChecked = recipe.checkedIngredients?.includes(ing) || false;
                            return (
                                <label key={i} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition-colors" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => handleIngredientCheck(ing)}
                                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-gray-300"
                                    />
                                    <span className={isChecked ? "line-through text-gray-400" : ""}>{ing}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-3">
                    <h5 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-1"><ChefHat className="w-4 h-4"/> 料理步驟</h5>
                    <ol className="list-decimal pl-4 space-y-2">
                        {recipe.steps.map((step, i) => (
                            <li key={i} className="text-sm text-gray-600 pl-1 leading-relaxed">{step}</li>
                        ))}
                    </ol>
                </div>

                {recipe.videoKeyword && (
                      <a 
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.videoKeyword)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 w-full bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-red-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Video className="w-4 h-4" /> 觀看教學影片
                      </a>
                )}
            </div>
        )}
    </div>
  );
};

const GroceryAssistant: React.FC<Props> = ({ userProfile, healthReport, savedRecipes, onSaveRecipe, onDeleteRecipe }) => {
  const [activeTab, setActiveTab] = useState<'RECOMMEND' | 'SAVED'>('RECOMMEND');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  const handleGenRecipes = async () => {
    setLoading(true);
    try {
      const data = await generateHealthyRecipes(userProfile, healthReport || undefined);
      setRecipes(data);
    } catch(e) { 
        alert("生成食譜失敗，請稍後再試"); 
    } finally { 
        setLoading(false); 
    }
  };

  const toggleExpand = (id: string) => {
      setExpandedRecipeId(expandedRecipeId === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Tab Switcher */}
       <div className="flex p-1 bg-gray-100 rounded-xl">
          <button 
            onClick={() => setActiveTab('RECOMMEND')} 
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'RECOMMEND' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}
          >
             <Utensils className="w-4 h-4" /> 今日推薦
          </button>
          <button 
            onClick={() => setActiveTab('SAVED')} 
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'SAVED' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}
          >
             <Bookmark className="w-4 h-4" /> 我的食譜 ({savedRecipes.length})
          </button>
       </div>

       {activeTab === 'RECOMMEND' && (
         <div className="space-y-4">
            {recipes.length === 0 ? (
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <ChefHat className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">不知道煮什麼嗎？</h3>
                  <p className="text-gray-500 mb-6 max-w-xs mx-auto">AI 將根據您的健檢報告，為您量身打造 10 道健康又美味的綠燈料理。</p>
                  <button 
                    onClick={handleGenRecipes} 
                    disabled={loading} 
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-70 active:scale-95 flex items-center justify-center gap-2 mx-auto"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Utensils className="w-5 h-5" />}
                    {loading ? "AI 正在研發食譜..." : "生成 10 道健康料理"}
                  </button>
               </div>
            ) : (
               <div className="space-y-4">
                   <div className="flex justify-between items-center px-1">
                       <p className="text-sm text-gray-500">為您精選了 10 道料理：</p>
                       <button onClick={handleGenRecipes} className="text-xs text-emerald-600 font-bold hover:underline">換一批</button>
                   </div>
                   {recipes.map((recipe) => {
                       const savedVersion = savedRecipes.find(r => r.name === recipe.name);
                       const isSaved = !!savedVersion;
                       
                       return (
                           <RecipeCard 
                              key={recipe.id} 
                              recipe={savedVersion || recipe} 
                              isExpanded={expandedRecipeId === recipe.id}
                              onToggle={toggleExpand}
                              onSave={onSaveRecipe}
                              onDelete={onDeleteRecipe}
                              isSaved={isSaved}
                            />
                       );
                   })}
               </div>
            )}
         </div>
       )}

       {activeTab === 'SAVED' && (
          <div className="space-y-4">
             {savedRecipes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">還沒有收藏的食譜</p>
                    <button onClick={() => setActiveTab('RECOMMEND')} className="text-emerald-600 text-sm font-bold mt-2 hover:underline">去看看推薦料理</button>
                </div>
             ) : (
                <div className="space-y-4">
                    {savedRecipes.map((recipe) => (
                       <RecipeCard 
                          key={recipe.id} 
                          recipe={recipe} 
                          isSavedView={true} 
                          isExpanded={expandedRecipeId === recipe.id}
                          onToggle={toggleExpand}
                          onSave={onSaveRecipe}
                          onDelete={onDeleteRecipe}
                          isSaved={true}
                        />
                    ))}
                </div>
             )}
          </div>
       )}
    </div>
  );
};
export default GroceryAssistant;