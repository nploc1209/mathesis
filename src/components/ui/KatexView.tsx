import React, { useMemo } from 'react';
import katex from 'katex';
import { cn } from '../../utils/cn';

interface KatexViewProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export const KatexView: React.FC<KatexViewProps> = ({
  math,
  displayMode = false,
  className,
}) => {
  const html = useMemo(() => {
    if (!math || typeof math !== 'string') return '';
    const clean = math.replace(/^\$+|\$+$/g, '').trim();
    if (!clean) return '';
    try {
      return katex.renderToString(clean, {
        throwOnError: false,
        displayMode,
      });
    } catch {
      return clean;
    }
  }, [math, displayMode]);

  if (!html) return null;

  return (
    <span
      className={cn('inline-block text-slate-900', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
