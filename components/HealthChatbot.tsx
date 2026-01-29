import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { createChatSession } from '../services/geminiService';
import { UserProfile, HealthReport, FoodAnalysis, ChatMessage } from '../types';

interface Props {
  userProfile: UserProfile;
  healthReports: HealthReport[];
  foodLogs: FoodAnalysis[];
}

const HealthChatbot: React.FC<Props> = ({ userProfile, healthReports, foodLogs }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '你好！我是你的專屬健康 AI 助理。我知道你的健檢狀況和最近的飲食記錄。有什麼我可以幫你的嗎？', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Initialize chat session ref (re-created if context changes significantly, but for simplicity we create on demand or ref)
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
    setLoading(true);

    try {
      if (!chatRef.current) {
        chatRef.current = createChatSession(userProfile, healthReports, foodLogs);
      }
      
      const result = await chatRef.current.sendMessageStream({ message: userText });
      let fullResponse = "";
      
      // Temporary placeholder for streaming
      setMessages(prev => [...prev, { role: 'model', text: '...', timestamp: Date.now() }]);
      
      for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullResponse += chunkText;
          // Update last message with accumulated text
          setMessages(prev => {
              const newArr = [...prev];
              newArr[newArr.length - 1] = { role: 'model', text: fullResponse, timestamp: Date.now() };
              return newArr;
          });
        }
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: '抱歉，我現在有點忙碌，請稍後再試。', timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] md:h-[600px] bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-500 to-blue-600 p-4 text-white flex items-center gap-2">
        <Bot className="w-6 h-6" />
        <div>
           <h2 className="font-bold">健康問答機器人</h2>
           <p className="text-xs opacity-80 flex items-center gap-1"><Sparkles className="w-3 h-3"/> 已連結您的健檢資料庫</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-indigo-100'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-gray-600"/> : <Bot className="w-5 h-5 text-indigo-600"/>}
             </div>
             <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                 msg.role === 'user' 
                 ? 'bg-gray-800 text-white rounded-tr-none' 
                 : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
             }`}>
                {msg.text}
             </div>
          </div>
        ))}
        {loading && messages[messages.length-1].text !== '...' && (
            <div className="flex items-center gap-2 text-gray-400 text-xs ml-10">
                <Loader2 className="w-3 h-3 animate-spin" /> 正在思考...
            </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
         <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="問我任何健康問題..."
              className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-full transition-colors shadow-md"
            >
               <Send className="w-5 h-5" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default HealthChatbot;