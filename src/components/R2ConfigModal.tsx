import React, { useState } from 'react';
import { Database, Shield, Key, Check, X, Sparkles } from 'lucide-react';
import { R2Config } from '../types';

interface R2ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: R2Config;
  onSaveConfig: (config: R2Config) => void;
}

export const R2ConfigModal: React.FC<R2ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig
}) => {
  const [accountId, setAccountId] = useState(config.accountId);
  const [accessKeyId, setAccessKeyId] = useState(config.accessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState(config.secretAccessKey);
  const [bucketName, setBucketName] = useState(config.bucketName);
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      accountId: accountId.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      bucketName: bucketName.trim() || 'modeldock-registry',
      endpointUrl: endpointUrl.trim(),
      region: 'auto',
      isConfigured: Boolean(accountId && accessKeyId),
      demoMode: false
    });
    onClose();
  };

  const loadDemoSandbox = () => {
    setAccountId('a84d9f10928e374f67c91a0293847291');
    setAccessKeyId('r2_pub_cf_923847921849210');
    setSecretAccessKey('r2_sec_cf_89327498213749812739812739812739');
    setBucketName('modeldock-models');
    setEndpointUrl('https://a84d9f10928e374f67c91a0293847291.r2.cloudflarestorage.com');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Cloudflare R2 Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Cloudflare R2 stores your GGUF models. It uses an S3-compatible API with <strong>0 egress fees</strong>, so you can stream models into RAM on demand.
        </p>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-mono mb-1">
              Cloudflare Account ID
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. 983274982173498127349"
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-mono mb-1">
              R2 Access Key ID
            </label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="e.g. r2_acc_..."
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-mono mb-1">
              R2 Secret Access Key
            </label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••"
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-mono mb-1">
              Bucket Name
            </label>
            <input
              type="text"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              placeholder="e.g. llm-models"
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={loadDemoSandbox}
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-mono cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Demo Credentials</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold cursor-pointer shadow-xs"
              >
                Save Config
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
