
import { FoodAnalysis, HealthReport, UserProfile, WorkoutLog, SavedAppointment, WorkoutPlanDay, Recipe } from '../types';

const GAS_URL_KEY = 'hg_gas_api_url';

// 取得儲存的 API URL
export const getGasUrl = () => localStorage.getItem(GAS_URL_KEY);
// 設定 API URL
export const setGasUrl = (url: string) => localStorage.setItem(GAS_URL_KEY, url);
// 清除 API URL
export const clearGasUrl = () => localStorage.removeItem(GAS_URL_KEY);

// 帶有 Timeout 的 Fetch
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
};

// 呼叫 GAS 的通用函式
// 使用 text/plain 避免觸發 CORS Preflight (OPTIONS)，雖然 GAS 現在支援較好，但這樣最穩
const callGasApi = async (data: any) => {
  const url = getGasUrl();
  if (!url) throw new Error("API URL not set");

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: JSON.stringify(data),
      // 關鍵：不使用 application/json header 以避免複雜的 CORS 檢查
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
    });
    
    // 檢查 Content-Type
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") === -1) {
       // 如果回傳的不是 JSON (例如回傳了 HTML 的 Google 登入頁面)，代表權限錯誤
       throw new Error("Invalid response format. Likely permission error.");
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error("GAS API Error:", error);
    throw error;
  }
};

export const dbService = {
  // --- Check Connection ---
  testConnection: async (url: string) => {
    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            body: JSON.stringify({ action: "read_all" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        }, 10000); // 測試連線 10秒逾時
        
        const text = await response.text();
        
        // 嘗試解析 JSON
        try {
            const json = JSON.parse(text);
            // 確保回傳的是物件且不是 Google 的錯誤訊息
            return json && typeof json === 'object';
        } catch (e) {
            // 解析失敗 (可能是 HTML)
            console.error("Connection test failed: Response is not JSON", text.substring(0, 100));
            return false;
        }
    } catch (e) {
        console.error("Connection test network error", e);
        return false;
    }
  },

  // --- Load All Data ---
  loadAllData: async () => {
    const data = await callGasApi({ action: "read_all" });
    // 如果是第一次使用，GAS 回傳的可能是空陣列，需做防呆
    return {
      foodLogs: Array.isArray(data.foodLogs) ? data.foodLogs : [],
      reports: Array.isArray(data.reports) ? data.reports : [],
      workouts: Array.isArray(data.workouts) ? data.workouts : [],
      profile: data.profile || { name: '', height: '', weight: '' },
      appointments: Array.isArray(data.appointments) ? data.appointments : [], 
      workoutPlan: Array.isArray(data.workoutPlan) ? data.workoutPlan : [],
      recipes: Array.isArray(data.recipes) ? data.recipes : []
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
    // GAS 端實作了 update 邏輯 (基於 timestamp)
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

  saveWorkoutPlan: async (plan: WorkoutPlanDay[]) => {
    await callGasApi({ action: "save", type: "WorkoutPlan", data: plan });
  },

  saveRecipe: async (recipe: Recipe) => {
    await callGasApi({ action: "save", type: "Recipes", data: recipe });
  },

  deleteRecipe: async (id: string) => {
    // 使用 action: 'delete'，需確認 GAS 端有對應實作，若無則依賴前端狀態更新即可
    await callGasApi({ action: "delete", type: "Recipes", id: id });
  },
};