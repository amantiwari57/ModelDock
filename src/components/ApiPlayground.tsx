import React, { useState } from 'react';
import { Send, Bot, User, Sparkles, Terminal, Copy, Check, Clock, Gauge, Layers } from 'lucide-react';
import { ServerState, ChatMessage, ModelInfo, RAMDiskState } from '../types';

interface ApiPlaygroundProps {
  serverState: ServerState;
  ramDisk: RAMDiskState;
  onSendMessage: (content: string) => Promise<void>;
  messages: ChatMessage[];
  isGenerating: boolean;
  onClearChat: () => void;
}

export const ApiPlayground: React.FC<ApiPlaygroundProps> = ({
  serverState,
  ramDisk,
  onSendMessage,
  messages,
  isGenerating,
  onClearChat
}) => {
  const [input, setInput] = useState('');
  const [snippetTab, setSnippetTab] = useState<'cursor' | 'python' | 'curl' | 'continue'>('cursor');
  const [copied, setCopied] = useState(false);

  const activeModel = ramDisk.loadedModel;
  const isServerReady = serverState.status === 'running';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || !isServerReady) return;
    const text = input;
    setInput('');
    await onSendMessage(text);
  };

  const samplePrompts = [
    "Write a Python script that benchmarks RAM-disk throughput against NVMe SSD.",
    "Explain how Apple Silicon unified memory reduces tensor copy latency.",
    "Draft a Homebrew formula description for ModelDock."
  ];

  const getSnippet = () => {
    const port = serverState.port || 8080;
    const host = serverState.host || '127.0.0.1';
    const modelName = activeModel ? activeModel.id : 'qwen-3b';

    switch (snippetTab) {
      case 'cursor':
        return `// Add to ~/.cursor/settings.json or Cursor Models panel:
{
  "openai.apiBase": "http://${host}:${port}/v1",
  "openai.apiKey": "dummy-key-local",
  "openai.model": "${modelName}"
}`;
      case 'python':
        return `from openai import OpenAI

# Connect to local ModelDock llama.cpp server
client = OpenAI(
    base_url="http://${host}:${port}/v1",
    api_key="local"
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "Explain RAM-disk zero SSD wear"}],
    temperature=0.7,
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
`;
      case 'curl':
        return `curl -X POST http://${host}:${port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [
      {"role": "user", "content": "Hello local model!"}
    ],
    "temperature": 0.7
  }'`;
      case 'continue':
        return `// Add to ~/.continue/config.json:
{
  "models": [
    {
      "title": "${activeModel ? activeModel.name : 'ModelDock Local'}",
      "provider": "openai",
      "model": "${modelName}",
      "apiBase": "http://${host}:${port}/v1",
      "apiKey": "local"
    }
  ]
}`;
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics bar */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            OpenAI-Compatible Local Endpoint Tester
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Interactive prompt visualizer communicating directly with <code className="text-indigo-300 font-mono text-[11px]">http://{serverState.host}:{serverState.port}/v1/chat/completions</code>.
          </p>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded border border-slate-800">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>Speed: <strong className="text-white">{serverState.lastTps || '68.4'}</strong> t/s</span>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>TTFT: <strong className="text-white">{serverState.lastTtftMs || '114'}</strong> ms</span>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded border border-slate-800">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Model: <strong className="text-white">{activeModel ? activeModel.parameters : '3B'}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg flex flex-col h-[460px] overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isServerReady ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-xs font-mono text-slate-200">
              {activeModel ? activeModel.name : 'No model loaded'} ({activeModel ? activeModel.quantization : 'N/A'})
            </span>
          </div>
          <button
            onClick={onClearChat}
            className="text-[11px] text-slate-500 hover:text-slate-300 font-mono cursor-pointer"
          >
            Clear Conversation
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
              <Bot className="w-8 h-8 text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-slate-300">
                  {isServerReady ? 'Inference Server Ready' : 'Inference Server Standby'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {isServerReady
                    ? 'Model is resident in macOS volatile RAM with Metal GPU acceleration.'
                    : 'Start the llama.cpp server in the "llama.cpp Server" tab to run local inferences.'}
                </p>
              </div>

              {/* Sample Prompts */}
              {isServerReady && (
                <div className="space-y-1.5 w-full pt-2">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Try a prompt:</span>
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(p)}
                      className="w-full text-left p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-300 transition-colors cursor-pointer"
                    >
                      "{p}"
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg p-3 leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  {msg.role === 'assistant' && msg.tps && (
                    <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center gap-3 text-[10px] font-mono text-slate-400">
                      <span>{msg.tps} tok/s</span>
                      <span>·</span>
                      <span>TTFT {msg.ttftMs}ms</span>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))
          )}

          {isGenerating && (
            <div className="flex gap-3 items-center text-xs text-indigo-400 font-mono">
              <Bot className="w-4 h-4 animate-spin" />
              <span>Streaming tokens from volatile RAM...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            disabled={!isServerReady || isGenerating}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isServerReady
                ? 'Send message to local model (OpenAI-compatible /v1/chat)...'
                : 'Server is stopped. Launch server in llama.cpp tab first.'
            }
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isServerReady || isGenerating || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Integration Code Snippets (Cursor, Continue, Python, cURL) */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Connect External Apps to Local Server
          </span>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Config'}</span>
          </button>
        </div>

        {/* Snippet Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
          {[
            { id: 'cursor', label: 'Cursor IDE' },
            { id: 'continue', label: 'Continue.dev' },
            { id: 'python', label: 'Python (openai)' },
            { id: 'curl', label: 'cURL' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSnippetTab(tab.id as any)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                snippetTab === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {getSnippet()}
        </pre>
      </div>
    </div>
  );
};
