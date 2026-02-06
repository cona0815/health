import { GoogleGenAI } from "@google/genai";
import { FoodAnalysis, HealthReport, AppointmentDetails, UserProfile, FoodSuggestion, Restaurant, Medication, WorkoutPlanDay, GroceryItem, ProductLabelAnalysis, Recipe } from "../types";

// --- Dynamic AI Client Management ---
let aiInstance: GoogleGenAI | null = null;

export const getGeminiKey = (): string | null => {
  // 優先順序：1. 環境變數 (開發時) 2. LocalStorage (部署後使用者輸入)
  return process.env.API_KEY || localStorage.getItem('GEMINI_USER_KEY');
};

export const setGeminiKey = (key: string) => {
  localStorage.setItem('GEMINI_USER_KEY', key);
  aiInstance = new GoogleGenAI({ apiKey: key });
};

export const clearGeminiKey = () => {
  localStorage.removeItem('GEMINI_USER_KEY');
  aiInstance = null;
};

const getAI = (): GoogleGenAI => {
  if (aiInstance) return aiInstance;
  
  const key = getGeminiKey();
  if (!key) {
    throw new Error("MISSING_API_KEY");
  }
  
  aiInstance = new GoogleGenAI({ apiKey: key });
  return aiInstance;
};

// --- Helpers ---

// 圖片壓縮設定
const COMPRESSION_CONFIG = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
  mimeType: 'image/jpeg'
};

export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 如果不是圖片 (例如 PDF)，直接回傳原始 Base64
    if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
    }

    // 如果是圖片，進行 Canvas 壓縮
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 計算縮放比例，保持長寬比
        if (width > height) {
          if (width > COMPRESSION_CONFIG.maxWidth) {
            height = Math.round(height * (COMPRESSION_CONFIG.maxWidth / width));
            width = COMPRESSION_CONFIG.maxWidth;
          }
        } else {
          if (height > COMPRESSION_CONFIG.maxHeight) {
            width = Math.round(width * (COMPRESSION_CONFIG.maxHeight / height));
            height = COMPRESSION_CONFIG.maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // 轉為 JPEG 壓縮格式
        const dataUrl = canvas.toDataURL(COMPRESSION_CONFIG.mimeType, COMPRESSION_CONFIG.quality);
        const base64Data = dataUrl.split(',')[1];
        resolve(base64Data);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const extractJson = (text: string): string => {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return text.substring(start, end + 1);
    }
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  } catch (e) {
    return text;
  }
};

// --- API Functions ---

export const analyzeFoodImage = async (
  imageBase64: string, 
  mimeType: string,
  healthContext?: HealthReport,
  userProfile?: UserProfile
): Promise<FoodAnalysis> => {
  const now = new Date();
  const currentTimeString = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
  
  let profileContext = "";
  if (userProfile) {
    const h = parseFloat(userProfile.height) / 100;
    const w = parseFloat(userProfile.weight);
    if (!isNaN(h) && !isNaN(w)) {
        const bmi = (w / (h * h)).toFixed(1);
        profileContext = `使用者資料: 身高${userProfile.height}cm, 體重${userProfile.weight}kg, BMI ${bmi}`;
    }
  }

  const restrictions = healthContext?.dietaryRestrictions || [];
  const healthContextPrompt = healthContext 
    ? `健檢異常: ${healthContext.metrics.filter(m => m.status !== 'Normal').map(m => m.name).join(', ')}. 禁忌: ${restrictions.join('、')}` 
    : "無詳細報告";

  const prompt = `
    分析食物照片 (繁體中文 JSON)。時間: ${currentTimeString}。
    判斷 mealType (早餐/午餐/晚餐/點心)。
    ${profileContext}
    ${healthContextPrompt}
    
    【核心任務】：
    1. 詳細估算熱量 (calories)。
    2. 務必詳細列出「主要食材」與「細項成份」(ingredients)，這非常重要。請仔細觀察配菜、裝飾、烹調用油、調味醬料、隱藏糖分、添加物等，越詳細越好。
    3. 估算「整份重量」(estimatedWeight)，例如 "約 350g" 或 "500ml"。
    4. 估算「營養成份」(nutrients)，包含：蛋白質、脂肪、碳水化合物、糖、鈉、膳食纖維。
    5. 給出一個簡短的「診斷短評」(diagnosis)，例如："高油高鹽警告" 或 "營養均衡優選"。
    
    【健康風險評估】：
    - 比對使用者「健檢異常」。
    - 高血壓 -> 注意鈉含量。
    - 糖尿病/高血糖 -> 注意糖與精緻澱粉。
    - 若違反禁忌，healthAdvice 開頭加「⚠️【嚴重警告】」。
    
    回傳 JSON 結構: { 
      foodName, 
      calories (number), 
      estimatedWeight (string),
      ingredients: ["食材1", "食材2", "烹調油", "醬料"...],
      nutrients: [{name: "蛋白質", amount: "20", unit: "g"}, ...], 
      riskLevel (SAFE/MODERATE/DANGEROUS), 
      diagnosis: "簡短診斷 (例如：高鈉警告、優質蛋白來源...)",
      healthAdvice, 
      mealType 
    }
  `;

  try {
    // 雖然傳入 mimeType，但因為 fileToGenerativePart 已經轉成 JPEG，這裡強制使用 jpeg
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }] }
    });
    const data = JSON.parse(extractJson(response.text || "{}"));
    return { ...data, timestamp: new Date().toISOString() };
  } catch (error) { throw error; }
};

export const generateFoodSuggestions = async (healthContext?: HealthReport, userProfile?: UserProfile): Promise<FoodSuggestion[]> => {
  const prompt = `推薦 8 道適合外食族的餐點 (JSON Array)。
  【強制規則】：
  1. 必須包含至少 5 道「綠燈 (SAFE)」的健康餐點 (如健康餐盒、輕食、低GI便當)。
  2. 剩餘 3 道可為「黃燈 (MODERATE)」的美味選擇。
  
  結構: [{name, description, calories, riskLevel (SAFE/MODERATE), reason, tags}]`;
  
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) { return []; }
};

export const findNearbyRestaurants = async (foodName: string, lat: number, lng: number): Promise<Restaurant[]> => {
  const genericSearchUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(foodName)}`;
  const genericResult: Restaurant = { name: `🔍 在地圖搜尋「${foodName}」`, uri: genericSearchUri };

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find the 5 closest restaurants or convenience stores near lat:${lat}, lng:${lng} that serve "${foodName}". 
      
      STRICT LOCATION RULES:
      1. **MAXIMUM RADIUS IS 3 KM**. The user is walking or riding a scooter nearby.
      2. **CRITICAL**: Check the address carefully. If the user is in City A, DO NOT show results from City B. 
      3. Use Google Maps to find places EXACTLY at lat:${lat}, lng:${lng}.
      
      Response Format: A list of places with their Google Maps URLs.`,
      config: { 
          tools: [{ googleMaps: {} }, { googleSearch: {} }], 
          toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } } 
      },
    });
    
    const places: Restaurant[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    chunks.forEach(c => { 
        if ((c as any).maps) {
             const mapData = (c as any).maps;
             const name = mapData.title || mapData.displayName || "未知店家";
             const uri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${mapData.placeId || ''}`;
             places.push({ name, uri });
        } else if (c.web) {
             places.push({ name: c.web.title || "搜尋結果", uri: c.web.uri || "#" }); 
        }
    });

    if (places.length === 0 && response.text) {
        const lines = response.text.split('\n');
        lines.forEach(line => {
            const match = line.match(/^\s*[\d\*\-]+\.?\s+\**([^\*]+)\**.*$/);
            if (match && match[1]) {
                const cleanName = match[1].trim();
                if (cleanName.length > 2 && cleanName.length < 50 && !cleanName.includes("http")) {
                    places.push({
                        name: cleanName,
                        uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanName)}&center=${lat},${lng}`
                    });
                }
            }
        });
    }
    
    const uniquePlaces = places.filter((p, i, s) => i === s.findIndex((t) => t.name === p.name));

    if (uniquePlaces.length === 0) return [genericResult];
    return uniquePlaces.slice(0, 5);

  } catch (error) { 
      console.error("Find nearby error:", error);
      return [genericResult]; 
  }
};

export const analyzeHealthReport = async (imageBase64: string, mimeType: string): Promise<HealthReport> => {
  const prompt = `分析健檢報告 (繁體中文 JSON)。提取 metrics (name, value, status: Normal/Warning/Critical, advice) 與 dietaryRestrictions。`;
  try {
    // 圖片類皆已轉為 JPEG
    const isImage = mimeType.startsWith('image/');
    const finalMime = isImage ? 'image/jpeg' : mimeType;
    
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { mimeType: finalMime, data: imageBase64 } }, { text: prompt }] }
    });
    return { ...JSON.parse(extractJson(response.text || "{}")), analyzedAt: new Date().toISOString() };
  } catch (error) { throw error; }
};

export const extractAppointmentDetails = async (imageBase64: string, mimeType: string): Promise<AppointmentDetails> => {
  const prompt = `提取預約單/掛號證資訊 (繁體中文 JSON)。
  
  欄位：
  - title: 醫院或科別名稱
  - date: 日期 (YYYY-MM-DD)
  - time: 時間 (HH:MM，若無具體時間則估算，上午診09:00，下午診14:00，夜診19:00)
  - location: 醫院地址或診間位置
  - doctor: 醫師姓名
  - appointmentNumber: 診號/號碼
  - notes: 注意事項

  重點：請精準識別日期與時間。`;

  try {
    const isImage = mimeType.startsWith('image/');
    const finalMime = isImage ? 'image/jpeg' : mimeType;

    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { mimeType: finalMime, data: imageBase64 } }, { text: prompt }] }
    });
    return JSON.parse(extractJson(response.text || "{}"));
  } catch (error) { throw error; }
};

export const analyzeMedication = async (imageBase64: string, mimeType: string, healthContext?: HealthReport): Promise<Medication> => {
  const warnings = healthContext?.metrics.filter(m => m.status !== 'Normal').map(m => m.name).join('、') || "無";
  const prompt = `分析藥袋/保健品 (繁體中文 JSON)。比對健檢警訊：${warnings}。結構: {name, indication, usage, sideEffects, interactionWarning, riskLevel (SAFE/DANGEROUS)}`;
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }] }
    });
    return JSON.parse(extractJson(response.text || "{}"));
  } catch (error) { throw error; }
};

export const generateWorkoutPlan = async (userProfile: UserProfile, healthContext?: HealthReport): Promise<WorkoutPlanDay[]> => {
  // 取得今天的星期與日期
  const today = new Date();
  const dateString = today.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  
  const prompt = `
  您是專業的運動健康教練。今天是 **${dateString}**。
  請為使用者設計一份「未來 7 天」的運動處方 (JSON Array)。
  
  【嚴格規則】
  1. **起點為今天**，依次規劃 7 天的行程 (例如：今天是週五，則順序為 週五, 週六, 週日...到下週四)。
  2. 針對使用者 BMI 與健康狀況調整強度。
  3. JSON 結構: [{day: "週五 (10/25)", activity: "快走", duration: "30分鐘", intensity: "中等", notes: "注意心率..."}]
  4. 內容必須完全使用「繁體中文」。
  `;
  
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) { return []; }
};

export const calculateExerciseCalories = async (activity: string, duration: string, userProfile: UserProfile): Promise<number> => {
    const weight = userProfile.weight || "65"; // Default 65kg if missing
    const prompt = `
      計算運動消耗熱量 (只回傳數字)。
      使用者: ${weight}kg
      運動: ${activity}
      時間: ${duration}
      
      請估算這項活動大約消耗多少大卡 (kcal)。僅回傳一個整數 (Number)，不要有文字。
    `;
    
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        const num = parseInt(response.text?.replace(/[^0-9]/g, '') || "0");
        return isNaN(num) ? 0 : num;
    } catch (error) {
        console.error("Failed to calculate calories", error);
        return 0;
    }
};

export const generateHealthyRecipes = async (userProfile: UserProfile, healthContext?: HealthReport): Promise<Recipe[]> => {
  let profileContext = "";
  if (userProfile.height && userProfile.weight) {
      const h = parseFloat(userProfile.height) / 100;
      const w = parseFloat(userProfile.weight);
      const bmi = (w / (h * h)).toFixed(1);
      profileContext = `使用者 BMI: ${bmi}。`;
  }
  
  const restrictions = healthContext?.dietaryRestrictions || [];
  const warnings = healthContext?.metrics.filter(m => m.status !== 'Normal').map(m => m.name).join(', ') || "無";
  
  const prompt = `
    請為這位使用者推薦 10 道「綠燈健康料理」(JSON Array)。
    ${profileContext}
    健檢警訊: ${warnings}。
    飲食禁忌: ${restrictions.join('、')}。
    
    【規則】
    1. 這些食譜必須是健康的、適合居家烹飪的。
    2. 針對健檢紅字進行改善（例如高血壓推薦低鈉、高血糖推薦低GI）。
    3. **【強制要求】：請務必包含至少 3 道使用「氣炸鍋 (Air Fryer)」烹飪的料理，並在 tags 中標記「氣炸鍋」。**
    4. 每道料理回傳一個物件。
    
    JSON 結構:
    [
      {
        "name": "料理名稱",
        "calories": 350,
        "tags": ["低卡", "高纖", "降血壓", "氣炸鍋"],
        "ingredients": ["雞胸肉 100g", "花椰菜 50g", "蒜末 少許"],
        "steps": ["雞肉切塊", "氣炸...", "拌入..."],
        "videoKeyword": "香煎雞胸肉佐時蔬 教學",
        "reason": "富含蛋白質且低脂，適合體重控制。"
      }
    ]
  `;
  
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const raw: any[] = JSON.parse(response.text || "[]");
    return raw.map(r => ({ ...r, id: Date.now().toString() + Math.random().toString().slice(2, 6) }));
  } catch (error) { return []; }
};

export const analyzeProductLabel = async (imageBase64: string, mimeType: string, healthContext?: HealthReport): Promise<ProductLabelAnalysis> => {
  const prompt = `分析營養標示 (JSON)。結構: {productName, riskLevel, analysis, nutrientsOfInterest}`;
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }] }
    });
    return JSON.parse(extractJson(response.text || "{}"));
  } catch (error) { throw error; }
};

export const createChatSession = (userProfile: UserProfile, healthReports: HealthReport[], foodLogs: FoodAnalysis[]) => {
  const systemInstruction = `你是 HealthGuardian AI，一位專業、友善的個人健康管家。使用繁體中文。`;
  return getAI().chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};