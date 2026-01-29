
// 模擬 Firebase Auth 的使用者介面，為了相容原本的 Type
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

// 模擬的 Auth 物件
export const auth = {
  currentUser: null as User | null
};

const LOCAL_USER_KEY = 'health_guardian_user';

// 檢查是否已登入 (檢查 LocalStorage)
export const checkLocalUser = (): User | null => {
  const stored = localStorage.getItem(LOCAL_USER_KEY);
  if (stored) {
    const user = JSON.parse(stored);
    auth.currentUser = user;
    return user;
  }
  return null;
};

// 模擬登入 (直接儲存使用者資訊到 LocalStorage)
export const signInWithCustomAccount = async (username: string, password?: string): Promise<User> => {
  // 這裡不驗證密碼，因為是本地個人使用
  const mockUser: User = {
    uid: 'local_user_' + username,
    displayName: username,
    email: `${username}@local.app`,
    photoURL: null
  };
  
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(mockUser));
  auth.currentUser = mockUser;
  return mockUser;
};

export const signInWithGoogle = async () => {
    // 模擬 Google 登入
    return signInWithCustomAccount("GoogleUser");
};

// 登出
export const signOut = async () => {
  localStorage.removeItem(LOCAL_USER_KEY);
  auth.currentUser = null;
};

// 用於 App.tsx 的監聽器模擬
export const onAuthStateChanged = (authObj: any, callback: (user: User | null) => void) => {
  const user = checkLocalUser();
  // 延遲一下模擬非同步
  setTimeout(() => callback(user), 500);
  return () => {}; // unsubscribe function
};

// 為了相容性保留 db 匯出，但設為 null
export const db = null;