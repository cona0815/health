import { FoodAnalysis, HealthReport, UserProfile, WorkoutLog, SavedAppointment, WorkoutPlanDay, Recipe } from '../types';

const GAS_URL_KEY = 'hg_gas_api_url';

// 取得儲存的 API URL
export const getGasUrl = () => localStorage.getItem(GAS_URL_KEY);
// 設定 API URL
export const setGasUrl = (url: string) => localStorage.setItem(GAS_URL_KEY, url);
// 清除 API URL
export const clearGasUrl = () => localStorage.removeItem(GAS_URL_KEY);

// 帶有 Timeout 的 Fetch
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error: any) {
    // 捕捉超時錯誤 (AbortError)
    // "signal is aborted without reason" 是某些瀏覽器在 controller.abort() 未帶參數時的預設訊息
    const isAbort = error.name === 'AbortError' || 
                    (error.message && (error.message.includes('aborted') || error.message.includes('timeout') || error.message.includes('reason')));
                    
    if (isAbort) {
        throw new Error(`連線回應逾時 (${timeout / 1000}秒)。Google Sheets 可能正在休眠啟動中，請耐心等候或再次點擊按鈕重試。`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
};

// 呼叫 GAS 的通用函式
const callGasApi = async (data: any) => {
  const url = getGasUrl();
  if (!url) throw new Error("API URL not set");

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
    });
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") === -1) {
       throw new Error("Invalid response format. Likely permission error.");
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error("GAS API Error:", error);
    throw error;
  }
};

// --- 資料消毒工具 (Data Sanitizers) ---
// 防止因為 Sheet 欄位空白導致讀成字串，進而讓前端 Crash
const ensureArray = (item: any): any[] => {
    if (Array.isArray(item)) return item;
    // 如果是 JSON 字串嘗試解析
    if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('{'))) {
        try { return JSON.parse(item); } catch (e) { return []; }
    }
    return [];
};

export const dbService = {
  // --- Check Connection ---
  testConnection: async (url: string) => {
    // 直接拋出錯誤讓 UI 處理，而不是吞掉回傳 false
    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            body: JSON.stringify({ action: "read_all" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        }, 25000); // 測試連線給予 25 秒
        
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json && typeof json === 'object') {
                return true;
            } else {
                throw new Error("Invalid JSON structure");
            }
        } catch (e) {
            console.error("Connection test failed: Response is not JSON", text.substring(0, 100));
            // 嘗試給出更具體的建議
            if (text.includes("Google Drive") || text.includes("Google Docs")) {
                 throw new Error("回傳了 Google 登入頁面，請確認部署設定：「誰可以存取」必須設為「任何人」。");
            }
            throw new Error("回傳格式錯誤 (非 JSON)，請確認您複製的是「網頁應用程式網址」而非編輯器網址。");
        }
    } catch (e: any) {
        console.error("Connection test network error", e);
        throw e; // 讓 UI 顯示錯誤
    }
  },

  // --- Load All Data ---
  loadAllData: async () => {
    const data = await callGasApi({ action: "read_all" });
    
    // 解析 WorkoutPlan: 後端儲存為 { timestamp, planJson } 的陣列
    let currentPlan: WorkoutPlanDay[] = [];
    if (data.workoutPlan && Array.isArray(data.workoutPlan) && data.workoutPlan.length > 0) {
        // 找到最後一筆
        const lastEntry = data.workoutPlan[data.workoutPlan.length - 1];
        if (lastEntry && lastEntry.planJson) {
            try {
                // Ensure planJson is a string before parsing
                const jsonStr = typeof lastEntry.planJson === 'string' ? lastEntry.planJson : JSON.stringify(lastEntry.planJson);
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed)) {
                    currentPlan = parsed;
                }
            } catch (e) {
                console.error("Failed to parse workout plan JSON", e);
            }
        }
    }

    // --- 消毒資料防止崩潰 ---
    
    const rawFoodLogs = Array.isArray(data.foodLogs) ? data.foodLogs : [];
    const foodLogs = rawFoodLogs.map((log: any) => ({
        ...log,
        // 確保關鍵陣列欄位真的是陣列，若是空字串則轉為 []
        nutrients: ensureArray(log.nutrients),
        ingredients: ensureArray(log.ingredients),
        calories: Number(log.calories) || 0 // 確保熱量是數字
    }));

    const rawWorkouts = Array.isArray(data.workouts) ? data.workouts : [];
    const workouts = rawWorkouts.map((w: any) => ({
        ...w,
        // 確保 timestamp 存在且為字串，防止 startsWith 崩潰
        timestamp: w.timestamp ? String(w.timestamp) : ''
    }));

    const rawReports = Array.isArray(data.reports) ? data.reports : [];
    const reports = rawReports.map((r: any) => ({
        ...r,
        metrics: ensureArray(r.metrics),
        dietaryRestrictions: ensureArray(r.dietaryRestrictions)
    }));
    
    const rawRecipes = Array.isArray(data.recipes) ? data.recipes : [];
    const recipes = rawRecipes.map((r: any) => ({
        ...r,
        tags: ensureArray(r.tags),
        ingredients: ensureArray(r.ingredients),
        steps: ensureArray(r.steps),
        checkedIngredients: ensureArray(r.checkedIngredients)
    }));

    return {
      foodLogs,
      reports,
      workouts,
      profile: data.profile || { name: '', height: '', weight: '' },
      appointments: Array.isArray(data.appointments) ? data.appointments : [], 
      workoutPlan: currentPlan,
      recipes
    };
  },

  // --- Writes ---
  saveUserProfile: async (profile: UserProfile) => {
    await callGasApi({ action: "save", type: "Profile", data: profile });
  },

  addFoodLog: async (log: FoodAnalysis) => {
    await callGasApi({ action: "save", type: "FoodLogs", data: log });
  },

  updateFoodLog: async (timestamp: string, updatedLog: FoodAnalysis) => {
    await callGasApi({ action: "save", type: "FoodLogs", data: updatedLog });
  },

  addHealthReport: async (report: HealthReport) => {
    await callGasApi({ action: "save", type: "Reports", data: report });
  },

  addWorkoutLog: async (log: WorkoutLog) => {
    await callGasApi({ action: "save", type: "Workouts", data: log });
  },
  
  saveAppointment: async (appointment: SavedAppointment) => {
    await callGasApi({ action: "save", type: "Appointments", data: appointment });
  },

  deleteAppointment: async (id: string) => {
    await callGasApi({ action: "delete", type: "Appointments", id: id });
  },

  saveWorkoutPlan: async (plan: WorkoutPlanDay[]) => {
    const payload = {
        timestamp: new Date().toISOString(),
        planJson: JSON.stringify(plan)
    };
    await callGasApi({ action: "save", type: "WorkoutPlan", data: payload });
  },

  saveRecipe: async (recipe: Recipe) => {
    await callGasApi({ action: "save", type: "Recipes", data: recipe });
  },

  deleteRecipe: async (id: string) => {
    await callGasApi({ action: "delete", type: "Recipes", id: id });
  },
};