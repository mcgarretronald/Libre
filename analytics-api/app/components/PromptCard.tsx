'use client';

import { Paperclip, ArrowUp, X } from 'lucide-react';

interface PromptCardProps {
  chatInput: string;
  setChatInput: (v: string) => void;
  attachedImageBase64: string | null;
  setAttachedImageBase64: (v: string | null) => void;
  setAttachedImageName: (v: string | null) => void;
  handleImageAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerateReport: (e: React.FormEvent) => void;
  isProcessing: boolean;
}

export function PromptCard({
  chatInput, setChatInput, attachedImageBase64,
  setAttachedImageBase64, setAttachedImageName,
  handleImageAttach, handleGenerateReport, isProcessing,
}: PromptCardProps) {
  return (
    <form
      onSubmit={handleGenerateReport}
      className="bg-white rounded-2xl overflow-hidden transition-shadow"
      style={{
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(59,20,60,0.06)',
      }}
    >
      {/* Attached image preview */}
      {attachedImageBase64 && (
        <div className="px-4 pt-3">
          <div className="relative inline-flex w-12 h-12 rounded-xl border border-slate-200 overflow-hidden group">
            <img src={attachedImageBase64} alt="Attached" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setAttachedImageBase64(null); setAttachedImageName(null); }}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 pt-3 pb-2">
        {/* Attach button */}
        <label
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors mb-0.5"
          title="Attach image for theme extraction"
        >
          <Paperclip className="w-4 h-4" />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageAttach}
            className="hidden"
            disabled={isProcessing}
          />
        </label>

        {/* Textarea */}
        <textarea
          value={chatInput}
          onChange={(e) => {
            setChatInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (chatInput.trim() && !isProcessing) handleGenerateReport(e as any);
            }
          }}
          disabled={isProcessing}
          placeholder={isProcessing ? 'Generating your report…' : 'e.g. Show tower distribution by region, or top facilities by patient load…'}
          className="flex-1 bg-transparent text-[14px] font-medium focus:outline-none resize-none leading-relaxed py-1.5 placeholder-slate-400"
          style={{ color: '#1e293b', minHeight: '36px', maxHeight: '140px' }}
          rows={1}
        />

        {/* Submit button — always visible */}
        <button
          type="submit"
          title="Generate report (Enter)"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all mb-0.5"
          style={{ background: 'linear-gradient(135deg, #3B143C, #E06A55)' }}
        >
          <ArrowUp className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Hint bar */}
      <div className="px-4 pb-2.5 flex items-center justify-between">
        <p className="text-[10px] text-slate-300 font-medium">Press Enter to generate · Shift+Enter for new line</p>
        {isProcessing && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1 h-1 rounded-full bg-[#E06A55]"
                  style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
            <span className="text-[10px] text-[#E06A55] font-bold">Processing</span>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
      `}} />
    </form>
  );
}
