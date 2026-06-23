import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSecurityStore } from '../stores/useSecurityStore';
import { useAccount } from '../hooks/useWeb3';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isError?: boolean;
}

const JAILBREAK_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /system prompt/i,
  /bypass/i,
  /override/i,
  /developer mode/i,
  /jailbreak/i,
  /output.*private key/i,
  /leak/i,
];

export const AIChatSupport: React.FC = () => {
  const { isRateLimited, addJailbreakLog } = useSecurityStore();
  const { address } = useAccount();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am the SX Secure AI Assistant. How can I help you with your prediction market queries today?',
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const detectJailbreak = (text: string): boolean => {
    return JAILBREAK_PATTERNS.some(pattern => pattern.test(text));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput('');

    // 1. Check Rate Limit
    if (isRateLimited) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: userText },
        { id: (Date.now() + 1).toString(), role: 'system', content: '⚠️ API Rate Limit Exceeded. Please try again later.', isError: true }
      ]);
      return;
    }

    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userText }
    ]);

    // 2. Check for Jailbreak patterns
    const isJailbreak = detectJailbreak(userText);

    if (isJailbreak) {
      // Simulate backend log
      try {
        await fetch('/api/security/jailbreak-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address || '0xunknown',
            payload: userText,
            detectedType: 'System Prompt Bypass / Instruction Injection',
            severity: 'High'
          })
        });
      } catch (err) {
        console.error('Failed to log jailbreak to backend:', err);
      }

      // Add to frontend store for real-time dashboard update
      addJailbreakLog({
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ipAddress: 'Client IP', // Simulated
        promptSnippet: userText.length > 60 ? userText.substring(0, 60) + '...' : userText,
        detectedVector: 'System Prompt Bypass / Instruction Injection',
        mitigationAction: 'BLOCKED by WAF Enforcer',
        threatLevel: 'High'
      });

      // Show error in chat
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { 
            id: Date.now().toString(), 
            role: 'system', 
            content: '🚨 Jailbreak Pattern Detected! Request Blocked. Your IP has been flagged.', 
            isError: true 
          }
        ]);
      }, 500);
      return;
    }

    // Normal response simulation
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: 'I understand you need help with that. Could you please provide more context about your prediction market issue?' 
        }
      ]);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Bot className="h-6 w-6 text-indigo-400" />
          AI Support Assistant
        </h1>
        <p className="text-xs text-slate-400 mt-1">Get automated help with your prediction market queries. Guarded by our WAF Enforcer.</p>
      </div>

      <Card className="flex-1 flex flex-col border border-white/5 bg-slate-900/40 overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-slate-900/60 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-emerald-400" />
            WAF Enforcer Active
          </CardTitle>
          <CardDescription>All prompts are scanned for injection attacks and rate-limited to protect backend compute.</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-indigo-600' : 
                  msg.role === 'system' ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-700 text-indigo-400'
                }`}>
                  {msg.role === 'user' ? <User className="h-4.5 w-4.5 text-white" /> : 
                   msg.role === 'system' ? <AlertTriangle className="h-4.5 w-4.5" /> : 
                   <Bot className="h-4.5 w-4.5" />}
                </div>
                
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 
                  msg.role === 'system' ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-tl-none font-bold' : 
                  'bg-slate-800 text-slate-200 border border-white/5 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-slate-900/60 border-t border-white/5">
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the AI assistant..."
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
