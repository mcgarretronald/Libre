'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Activity, Clock } from 'lucide-react';

type Stage = 'idle' | 'schema' | 'sql' | 'remote' | 'complete';

const STEPS = [
  { stage: 'schema', label: 'Analyzing your request' },
  { stage: 'sql',    label: 'Processing data query' },
  { stage: 'remote', label: 'Building visualization' },
] as const;

const STAGE_ORDER: Stage[] = ['schema', 'sql', 'remote'];

interface ProgressCardProps {
  generationStage: Stage;
}

export function ProgressCard({ generationStage }: ProgressCardProps) {
  if (generationStage === 'idle' || generationStage === 'complete') return null;

  const currentIdx = STAGE_ORDER.indexOf(generationStage as any);

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl p-6 relative overflow-hidden shadow-lg" style={{ background: 'linear-gradient(135deg, #3B143C 0%, #2a0e2e 100%)' }}>
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/4 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] pointer-events-none" />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#E06A55]/20 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-[#E06A55] animate-pulse" />
          </div>
          <span className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Generating your report</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/30 text-white/80 border border-white/5">
          <Clock className="w-3 h-3 text-[#E06A55]" />
          <span className="text-[11px] font-mono font-bold w-4 text-right">{seconds}</span>
          <span className="text-[10px] text-white/50">sec</span>
        </div>
      </div>

      <div className="space-y-3.5">
        {STEPS.map(({ stage, label }) => {
          const thisIdx = STAGE_ORDER.indexOf(stage);
          const isDone   = thisIdx < currentIdx;
          const isActive = thisIdx === currentIdx;

          return (
            <div
              key={stage}
              className={`flex items-center gap-3.5 transition-all duration-500 ${
                isActive ? 'opacity-100' : isDone ? 'opacity-55' : 'opacity-20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                isDone ? 'bg-[#1E6B65]' : isActive ? 'bg-[#E06A55]' : 'bg-white/10'
              }`}>
                {isDone
                  ? <CheckCircle2 className="w-3 h-3 text-white" />
                  : isActive
                    ? <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    : <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                }
              </div>
              <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-white/55'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes shimmer { 100% { transform: translateX(200%); } }` }} />
    </div>
  );
}
