import React, { useState } from 'react';
import { Database, Link, AlertCircle, Loader2, ArrowRight, HelpCircle, ChevronDown, ChevronUp, User, Code, Copy, Check } from 'lucide-react';
import { dbService, setGasUrl } from '../services/dbService';

interface Props {
  onConnect: () => void;
}

// Export the GAS Code so it can be used in HealthManagement too
export const GAS_CODE = `function doPost(e) {
  var para;
  try {
    para = JSON.parse(e.postData.contents);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({status:"error", message:"Invalid JSON"}));
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = para.action;
  
  if (action == 'read_all') {
    return ContentService.createTextOutput(JSON.stringify({
      foodLogs: readSheet(ss, 'FoodLogs'),
      reports: readSheet(ss, 'Reports'),
      workouts: readSheet(ss, 'Workouts'),
      profile: readProfile(ss),
      appointments: readSheet(ss, 'Appointments'),
      recipes: readSheet(ss, 'Recipes'),
      workoutPlan: readSheet(ss, 'WorkoutPlan')
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action == 'save') {
    var sheet = getOrCreateSheet(ss, para.type);
    var data = para.data;
    
    // 特別處理 Profile，使其支援動態欄位
    if (para.type === 'Profile') {
       sheet.clear(); // 清空舊資料
       appendData(sheet, data); // 使用動態寫入，不限制欄位
       return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (para.type === 'WorkoutPlan') {
       var lastRow = sheet.getLastRow();
       if (lastRow > 1) {
         sheet.deleteRows(2, lastRow - 1);
       }
    }
    else if (data.id) {
       var headers = getHeaders(sheet);
       var idIndex = headers.indexOf('id');
       
       if (idIndex !== -1) {
         var allData = sheet.getDataRange().getValues();
         for (var i = 1; i < allData.length; i++) {
           if (allData[i][idIndex] == data.id) {
             sheet.deleteRow(i + 1);
             break;
           }
         }
       }
    }

    appendData(sheet, data);
    return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action == 'delete') {
    var sheet = ss.getSheetByName(para.type);
    if (sheet) {
      var id = para.id;
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var idIdx = headers.indexOf('id');
      if (idIdx > -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][idIdx] == id) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status:"deleted"})).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getHeaders(sheet) {
  if (sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function appendData(sheet, data) {
  var headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }
  
  var newRow = [];
  var keys = Object.keys(data);
  
  var newHeaders = headers.slice();
  var headerChanged = false;
  keys.forEach(function(k) {
    if (headers.indexOf(k) === -1) {
      newHeaders.push(k);
      headerChanged = true;
    }
  });
  
  if (headerChanged) {
    if (sheet.getLastRow() == 0) {
       sheet.appendRow(newHeaders);
    } else {
       sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    }
    headers = newHeaders;
  }
  
  headers.forEach(function(h) {
    var val = data[h];
    if (typeof val === 'object') {
      val = JSON.stringify(val);
    }
    newRow.push(val || '');
  });
  
  sheet.appendRow(newRow);
}

function readSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  
  var headers = rows[0];
  var result = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    var row = rows[i];
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      try {
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
             var parsed = JSON.parse(val);
             obj[headers[j]] = parsed;
        } else {
             obj[headers[j]] = val;
        }
      } catch(e) {
        obj[headers[j]] = val;
      }
    }
    result.push(obj);
  }
  return result;
}

function readProfile(ss) {
  var sheet = ss.getSheetByName('Profile');
  if (!sheet) return {};
  
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return {};

  // 讀取最後一行資料
  var list = readSheet(ss, 'Profile');
  return list.length > 0 ? list[list.length - 1] : {};
}`;

const GasSetup: React.FC<Props> = ({ onConnect }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(GAS_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    alert("程式碼已複製！請確保清空 GAS 編輯器後再貼上。");
  };

  const handleConnect = async () => {
    setError(null);
    const cleanUrl = url.trim();
    const cleanName = name.trim();

    if (!cleanName) {
        setError("請輸入您的稱呼 (例如: Alex)");
        return;
    }
    
    if (!cleanUrl) {
        setError("請輸入 Google Apps Script 網址");
        return;
    }

    if (!cleanUrl.includes('script.google.com')) {
        setError("這看起來不像是 Google Apps Script 網址 (應該包含 script.google.com)");
        return;
    }

    setLoading(true);
    try {
      const isConnected = await dbService.testConnection(cleanUrl);
      if (isConnected) {
        setGasUrl(cleanUrl);
        // Save profile if connected
        try {
             await dbService.saveUserProfile({ name: cleanName, height: '', weight: '' });
        } catch(e) {
             console.warn("Failed to save initial profile", e);
        }
        onConnect();
      } else {
        setError("驗證失敗：伺服器回傳內容不正確。請確認部署設定。");
      }
    } catch (err: any) {
      setError(err.message || "發生錯誤，請檢查網路連線或網址。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans">
      {/* Sidebar / Info Panel */}
      <div className="md:w-1/3 bg-gray-50 p-8 border-r border-gray-100 flex flex-col justify-between">
         <div>
            <div className="flex items-center gap-2 mb-6">
                <div className="bg-green-100 p-2 rounded-lg text-green-600">
                    <Database className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">資料庫設定</h1>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
               HealthGuardian 使用 Google Sheets 作為您的私人資料庫。這確保了資料完全由您掌控，且完全免費。
            </p>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> 為什麼需要這個？
                </h3>
                <ul className="text-xs text-blue-700 space-y-1.5 list-disc pl-4">
                    <li>您的健康資料只會存在您的 Google Drive</li>
                    <li>APP 重新整理後資料不會消失</li>
                    <li>可以隨時在 Excel/Sheets 中查看或備份</li>
                </ul>
            </div>
         </div>
         <div className="hidden md:block text-xs text-gray-400 mt-8">
            Privacy First Architecture
         </div>
      </div>

      {/* Main Form */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
         <div className="max-w-xl mx-auto space-y-8">
            
            {/* Step 1: User Info */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    您的基本資料
                </h2>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">您的稱呼</label>
                   <div className="relative">
                       <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                       <input 
                         type="text" 
                         value={name}
                         onChange={(e) => setName(e.target.value)}
                         placeholder="例如: Alex"
                         className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                       />
                   </div>
                </div>
            </div>

            {/* Step 2: GAS Setup */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    連結 Google Sheets
                </h2>
                
                {/* Accordion for GAS Code */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button 
                        onClick={() => setShowHelp(!showHelp)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                           <Code className="w-4 h-4" /> 如何建立 API 網址？(首次使用者請點此)
                        </span>
                        {showHelp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                    
                    {showHelp && (
                        <div className="p-4 bg-white text-sm text-gray-600 space-y-4">
                            <ol className="list-decimal pl-5 space-y-2">
                                <li>
                                    <a href="https://script.google.com/home/start" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold flex items-center gap-1 inline-flex">
                                        建立新的 Google Apps Script 專案 <ArrowRight className="w-3 h-3" />
                                    </a>
                                </li>
                                <li>
                                    複製下方的程式碼，並<strong>完全覆蓋</strong>編輯器中的內容 (刪除原本的 myFunction)。
                                    <div className="mt-2 relative">
                                        <button 
                                            onClick={copyCode}
                                            className="absolute top-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded flex items-center gap-1 hover:bg-gray-700 transition-colors"
                                        >
                                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            {copied ? "已複製" : "複製程式碼"}
                                        </button>
                                        <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-xs font-mono border border-gray-200 h-32">
                                            {GAS_CODE}
                                        </pre>
                                        <button 
                                            onClick={() => setShowCode(!showCode)} 
                                            className="text-xs text-blue-500 mt-1 hover:underline"
                                        >
                                            {showCode ? "隱藏完整程式碼" : "展開查看完整程式碼"}
                                        </button>
                                        {showCode && (
                                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                                <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
                                                    <div className="p-4 border-b flex justify-between items-center">
                                                        <h3 className="font-bold">完整 Apps Script 程式碼</h3>
                                                        <button onClick={() => setShowCode(false)} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
                                                    </div>
                                                    <div className="flex-1 overflow-auto p-4">
                                                        <pre className="text-xs font-mono whitespace-pre-wrap">{GAS_CODE}</pre>
                                                    </div>
                                                    <div className="p-4 border-t flex justify-end">
                                                        <button onClick={copyCode} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} 複製
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </li>
                                <li>點擊右上角的「部署」 (Deploy) {'>'} 「新增部署」 (New deployment)。</li>
                                <li>點擊齒輪圖示 {'>'} 選擇「網頁應用程式」 (Web app)。</li>
                                <li>
                                    <span className="text-red-600 font-bold">關鍵步驟：</span>
                                    <ul className="list-disc pl-5 mt-1 text-gray-500">
                                        <li>執行身分 (Execute as): <strong>我 (Me)</strong></li>
                                        <li>誰可以存取 (Who has access): <strong>任何人 (Anyone)</strong></li>
                                    </ul>
                                </li>
                                <li>點擊「部署」，授權存取，然後複製產生的「網頁應用程式網址」 (Web app URL)。</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Web App URL</label>
                   <div className="relative">
                       <Link className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                       <input 
                         type="text" 
                         value={url}
                         onChange={(e) => setUrl(e.target.value)}
                         placeholder="https://script.google.com/macros/s/..."
                         className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                       />
                   </div>
                   <p className="text-xs text-gray-400 mt-1 pl-1">請貼上部署後取得的網址</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <button 
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-200 active:scale-95 disabled:opacity-70 disabled:scale-100"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading ? "正在連線資料庫..." : "驗證並連線"}
            </button>
         </div>
      </div>
    </div>
  );
};

export default GasSetup;
