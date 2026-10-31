import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  Wand2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  PlusCircle,
  Zap,
  Target,
  Layers,
  BrainCircuit,
} from 'lucide-react';
import { AIConstructionProposal } from '../../types/geometry';
import { AIGeometryEngine, AIMode } from '../../geometry/ai-engine';
import { KatexView } from '../ui/KatexView';
import { cn } from '../../utils/cn';

interface AISidebarProps {
  aiEngine: AIGeometryEngine | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onExecuteProposal: (proposal: AIConstructionProposal) => void;
}

interface GenerationResult {
  proposal: AIConstructionProposal;
  reasoning?: string;
}

const SAMPLE_PROBLEMS = [
  {
    title: 'Acute Triangle & Altitudes',
    text: 'Acute triangle ABC inscribed in circle (O). Altitudes AD, BE, CF intersect at orthocenter H and meet (O) at M, N, P.',
  },
  {
    title: 'Euler Line',
    text: 'Triangle ABC with vertices A(-2, 0), B(4, 0), C(0, 4). Construct altitudes, orthocenter H, circumcenter O, centroid G, and the Euler line.',
  },
  {
    title: 'Nine-Point Circle',
    text: 'Triangle ABC with A(-3, 0), B(5, 0), C(0, 5). Construct midpoints of all three sides and the circumcircle passing through them.',
  },
  {
    title: 'Incircle & Circumcircle',
    text: 'Right triangle ABC at A with AB=6, AC=8. Construct its circumcircle, angle bisectors, and inscribed circle.',
  },
  {
    title: 'Square & Tangents',
    text: 'Construct square ABCD with center O and side 6. Draw diagonals AC, BD, the circumscribed circle, and the inscribed circle.',
  },
  {
    title: 'Regular Hexagon',
    text: 'Construct a regular hexagon ABCDEF with center at origin and radius 4. Draw its main diagonals and circumcircle.',
  },
];

export const AISidebar: React.FC<AISidebarProps> = ({
  aiEngine,
  isOpen,
  onToggleOpen,
  onExecuteProposal,
}) => {
  const [problemText, setProblemText] = useState('');
  const [aiMode, setAiMode] = useState<AIMode>('speed');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState('Connecting to AI engine...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<GenerationResult | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const progressTimerRef = useRef<number | null>(null);

  // Dynamic continuous logarithmic progress calculation (never stalls)
  useEffect(() => {
    if (isProcessing) {
      setProgressPercent(10);
      setProgressStage('Connecting to AI engine...');

      const startTime = Date.now();
      const tau = aiMode === 'speed' ? 400 : 750;
      const scale = aiMode === 'speed' ? 17.5 : 15.5;

      progressTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Natural logarithmic growth: strictly increasing, continuously creeps forward
        // p(t) = min(98, max(10, floor(10 + scale * ln(1 + elapsed / tau))))
        const rawLog = 10 + scale * Math.log(1 + elapsed / tau);
        const dynamicPercent = Math.min(98, Math.max(10, Math.floor(rawLog)));
        setProgressPercent(dynamicPercent);

        if (dynamicPercent < 30) {
          setProgressStage('Connecting to AI engine...');
        } else if (dynamicPercent < 55) {
          setProgressStage(
            aiMode === 'speed'
              ? 'Parsing geometry problem...'
              : 'Analyzing theorems & coordinate equations...'
          );
        } else if (dynamicPercent < 78) {
          setProgressStage('Calculating coordinates & relations...');
        } else if (dynamicPercent < 92) {
          setProgressStage('Formulating geometric tools...');
        } else {
          setProgressStage('Finalizing construction steps...');
        }
      }, 80);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isProcessing, aiMode]);

  const handleGenerate = async () => {
    const textToUse = problemText.trim();
    if (!textToUse || !aiEngine || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await aiEngine.interpretPrompt(textToUse, aiMode);
      setProgressPercent(100);
      setProgressStage('Constructed! Rendering to canvas...');

      // Brief delay to smoothly show 100% completion before revealing result
      await new Promise((r) => setTimeout(r, 220));

      setCurrentResult({
        proposal: res.proposal,
        reasoning: res.reasoning,
      });

      // Construct figure on canvas
      if (res.proposal && res.proposal.steps.length > 0) {
        onExecuteProposal(res.proposal);
      }
    } catch (err: any) {
      console.error('AI Construction failed:', err);
      setErrorMessage(err.message || 'Unable to construct figure. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectSample = (sampleText: string) => {
    // Only paste text into input box; do NOT auto-generate immediately
    setProblemText(sampleText);
    setErrorMessage(null);
  };

  const handleRedraw = () => {
    if (currentResult?.proposal) {
      onExecuteProposal(currentResult.proposal);
    }
  };

  const handleReset = () => {
    setProblemText('');
    setCurrentResult(null);
    setErrorMessage(null);
    setProgressPercent(0);
  };

  return (
    <aside
      aria-label="AI Geometric Assistant"
      className={cn(
        'relative z-20 flex flex-col bg-white border-l border-slate-200 shadow-sm transition-all duration-200 select-none',
        isOpen ? 'w-80 sm:w-96' : 'w-0 border-l-0 overflow-hidden'
      )}
    >
      {/* Clean Minimalist Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-slate-800">
            Draw with AI
          </span>
        </div>

        <button
          onClick={onToggleOpen}
          title="Close sidebar"
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Speed vs Accuracy Mode Toggle */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setAiMode('speed')}
              disabled={isProcessing}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all text-[11px]',
                aiMode === 'speed'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-50'
              )}
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Speed</span>
            </button>
            <button
              type="button"
              onClick={() => setAiMode('accuracy')}
              disabled={isProcessing}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all text-[11px]',
                aiMode === 'accuracy'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-50'
              )}
            >
              <Target className="w-3 h-3 text-indigo-500" />
              <span>Accuracy</span>
            </button>
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <label htmlFor="problem-input" className="font-medium">
              Problem Prompt:
            </label>
            {problemText && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <textarea
            id="problem-input"
            rows={4}
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            disabled={isProcessing}
            placeholder="Describe the geometric construction to draw..."
            className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none transition-all leading-relaxed"
          />

          {/* Quick Problem Examples */}
          <div className="space-y-1 pt-0.5">
            <span className="text-[10px] text-slate-400 block font-medium">
              Examples:
            </span>
            <div className="flex flex-wrap gap-1">
              {SAMPLE_PROBLEMS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(sample.text)}
                  disabled={isProcessing}
                  title={sample.text}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Logarithmic Progress Bar (NO rotating animation) */}
          {isProcessing && (
            <div className="space-y-1.5 bg-blue-50/80 p-2.5 rounded-lg border border-blue-200/80 transition-all">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-blue-900 flex items-center gap-1.5 text-[11px]">
                  {/* Static icon: NO animate-spin */}
                  <Wand2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{progressStage}</span>
                </span>
                <span className="font-mono text-blue-700 text-[11px] font-bold shrink-0 ml-1">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 h-1.5 rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Draw with AI Button (NO rotating animation) */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!problemText.trim() || isProcessing}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-xs transition-all shadow-xs',
              problemText.trim() && !isProcessing
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white cursor-pointer active:scale-[0.99] hover:shadow-md'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            )}
          >
            {isProcessing ? (
              <>
                {/* Static icon: NO animate-spin */}
                <Wand2 className="w-4 h-4 text-white" />
                <span>Drawing with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="tracking-wide">Draw with AI</span>
              </>
            )}
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* Construction Result */}
        {currentResult && (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            {/* Success Banner */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Constructed on canvas!</span>
              </div>
              <button
                type="button"
                onClick={handleRedraw}
                title="Redraw to canvas"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Redraw</span>
              </button>
            </div>

            {/* Title & Explanation */}
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 space-y-1">
              <div className="text-xs font-semibold text-slate-800">
                {currentResult.proposal.summary}
              </div>
              {currentResult.proposal.explanation && (
                <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {currentResult.proposal.explanation}
                </div>
              )}
            </div>

            {/* Reasoning Collapsible Block */}
            {currentResult.reasoning && (
              <div className="border border-indigo-100 rounded-lg overflow-hidden bg-indigo-50/20">
                <button
                  type="button"
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-indigo-50/60 hover:bg-indigo-50 text-indigo-900 text-left transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium">
                    <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI Reasoning Process</span>
                  </div>
                  {showReasoning ? (
                    <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                </button>
                {showReasoning && (
                  <div className="p-2.5 text-[10px] text-indigo-950 font-mono bg-white border-t border-indigo-100 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                    {currentResult.reasoning}
                  </div>
                )}
              </div>
            )}

            {/* List of Tool Calls / Steps */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" />
                  <span>Constructed Steps:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentResult.proposal.steps.length} steps
                </span>
              </div>

              <div className="space-y-1 bg-slate-50/50 rounded-lg p-1.5 border border-slate-200 max-h-48 overflow-y-auto">
                {currentResult.proposal.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-white border border-slate-200 text-[11px] text-slate-800 space-y-0.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold text-slate-500">
                        #{idx + 1}
                      </span>
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-100 text-slate-600 border border-slate-200">
                        {step.action}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-700 leading-snug">
                      {step.description}
                    </div>

                    {step.latex && (
                      <div className="text-[10px] text-blue-700 font-serif pt-0.5">
                        <KatexView math={step.latex} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Start New Problem Button */}
            <button
              type="button"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-medium bg-white hover:bg-slate-50 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Problem</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
