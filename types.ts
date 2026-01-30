
export enum RiskLevel {
  SAFE = 'SAFE',
  MODERATE = 'MODERATE',
  DANGEROUS = 'DANGEROUS',
  UNKNOWN = 'UNKNOWN'
}

export type MealType = '早餐' | '午餐' | '晚餐' | '點心/飲料';

export interface UserProfile {
  name?: string; // 使用者暱稱
  height: string; // cm
  weight: string; // kg
}

export interface Nutrient {
  name: string;
  amount: string;
  unit: string;
}

export interface FoodAnalysis {
  foodName: string;
  calories: number;
  estimatedWeight?: string; // 新增：估算重量 (例如 "350g")
  ingredients?: string[]; // 主要食材列表
  nutrients: Nutrient[];
  riskLevel: RiskLevel;
  diagnosis?: string; // 健康診斷短評 (Diagnosis)
  healthAdvice: string;
  mealType: MealType;
  timestamp: string;
}

export interface HealthMetric {
  name: string;
  value: string;
  status: 'Normal' | 'Warning' | 'Critical';
  advice: string;
}

export interface HealthReport {
  summary: string;
  metrics: HealthMetric[];
  dietaryRestrictions: string[];
  analyzedAt: string;
}

export interface AppointmentDetails {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  doctor: string;
  notes: string;
  appointmentNumber: string;
}

export interface SavedAppointment extends AppointmentDetails {
  id: string;
  createdAt: string;
}

export interface Restaurant {
  name: string;
  uri: string;
  address?: string;
}

export interface FoodSuggestion {
  name: string;
  description: string;
  calories: number;
  riskLevel: RiskLevel;
  reason: string;
  tags: string[]; 
  restaurants?: Restaurant[];
}

// --- New Types for Features ---

export interface Medication {
  name: string;
  indication: string; // 適應症
  usage: string; // 用法
  sideEffects: string;
  interactionWarning: string; // 與健檢報告的衝突警告
  riskLevel: RiskLevel;
}

export interface WorkoutPlanDay {
  day: string;
  activity: string;
  duration: string;
  intensity: string;
  notes: string;
}

export interface WorkoutLog {
  id: string;
  activity: string;
  duration: string;
  timestamp: string; // ISO String
}

export interface Recipe {
  id: string;
  name: string;
  calories: number;
  tags: string[];
  ingredients: string[];
  steps: string[];
  videoKeyword: string; // 用於搜尋 YouTube
  reason: string; // 為什麼適合該使用者
  notes?: string; // 使用者筆記
  checkedIngredients?: string[]; // 採買勾選狀態
}

export interface GroceryItem {
  name: string;
  category: string;
  reason: string;
}

export interface ProductLabelAnalysis {
  productName: string;
  riskLevel: RiskLevel;
  analysis: string;
  nutrientsOfInterest: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ViewState = 'DASHBOARD' | 'FOOD' | 'CALENDAR' | 'HEALTH_MANAGEMENT' | 'WORKOUT';
