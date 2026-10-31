import { BoardManager } from '../geometry/board-manager';

/**
 * Preprocesses a LaTeX mathematical string into a standard computable math string.
 * Supports \sqrt, \frac, \sin, \cos, \tan, \cot, \pi, \cdot, etc.
 */
export function preprocessLatex(input: string): string {
  let s = input.trim();

  // Strip math delimiters like $...$, \( ... \), \[ ... \]
  s = s.replace(/^\$+|\$+$/g, '').replace(/^\\\(|\\\)$/g, '').replace(/^\\\[|\\\]$/g, '').trim();

  // 1. Remove left/right wrappers: \left( -> (, \right) -> )
  s = s.replace(/\\left\s*([([{])/g, '$1').replace(/\\right\s*([)\]}])/g, '$1');

  // 2. Fractions: \frac{a}{b} -> ((a)/(b))
  let prev = '';
  while (s !== prev && /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(s)) {
    prev = s;
    s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
  }

  // 3. Square root: \sqrt[n]{x} -> ((x)**(1/(n))), \sqrt{x} -> sqrt(x), \sqrt x -> sqrt(x)
  s = s.replace(/\\sqrt\s*\[([^{}]+)\]\s*\{([^{}]+)\}/g, '(($2)**(1/($1)))');
  prev = '';
  while (s !== prev && /\\sqrt\s*\{([^{}]+)\}/.test(s)) {
    prev = s;
    s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');
  }
  s = s.replace(/\\sqrt\s+([a-zA-Z0-9]+)/g, 'sqrt($1)');

  // 4. Trig & transcendental functions
  const funcs = ['arcsin', 'arccos', 'arctan', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'ln', 'log', 'abs', 'exp'];
  for (const fn of funcs) {
    const reCurly = new RegExp('\\\\' + fn + '\\s*\\{([^{}]+)\\}', 'g');
    s = s.replace(reCurly, fn + '($1)');
    const reBare = new RegExp('\\\\' + fn + '\\b', 'g');
    s = s.replace(reBare, fn);
  }

  // 5. Constants & symbols: \pi, \cdot, \times, space
  s = s.replace(/\\pi\b/g, 'pi');
  s = s.replace(/\\cdot|\\times/g, '*');
  s = s.replace(/\\ /g, ' ');

  // 6. Exponent with curly braces: ^{...} -> ^(...)
  s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');

  // 7. Strip leftover backslashes before words
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');

  return s;
}

/**
 * Safely evaluates a static mathematical expression to a number.
 * Supports numbers, fractions, sqrt, sin, cos, pi, etc.
 */
export function evaluateMathExpression(expr: string): number | null {
  try {
    const clean = expr
      .trim()
      .replace(/(\d+)\s*([a-zA-Z(])/g, '$1 * $2')
      .replace(/\)\s*([a-zA-Z0-9(])/g, ') * $1')
      .replace(/\^/g, '**')
      .replace(/\bsin\b/gi, 'Math.sin')
      .replace(/\bcos\b/gi, 'Math.cos')
      .replace(/\btan\b/gi, 'Math.tan')
      .replace(/\bcot\b/gi, '(1/Math.tan')
      .replace(/\bsqrt\b/gi, 'Math.sqrt')
      .replace(/\babs\b/gi, 'Math.abs')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/gi, 'Math.E')
      .replace(/\bln\b/gi, 'Math.log')
      .replace(/\blog\b/gi, 'Math.log10');

    // Reject if contains unexpected un-evaluated alphabetic variables
    if (/[a-zA-Z]/.test(clean.replace(/Math\.[a-zA-Z]+/g, ''))) {
      return null;
    }

    const val = Function('"use strict"; return (' + clean + ');')();
    return typeof val === 'number' && !isNaN(val) ? val : null;
  } catch {
    return null;
  }
}

export function parseAndExecuteAlgebraInput(
  input: string,
  boardManager: BoardManager
): boolean {
  const trimmed = input.trim();
  if (!trimmed || !boardManager.board) return false;

  const preprocessed = preprocessLatex(trimmed);

  // 1. Point: A = (exprX, exprY) or (exprX, exprY) or A(exprX, exprY)
  const namedPointMatch = preprocessed.match(
    /^([A-Za-z][A-Za-z0-9_]*)\s*(?:=|\:)?\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*\)$/
  );
  if (namedPointMatch) {
    const name = namedPointMatch[1];
    const xVal = evaluateMathExpression(namedPointMatch[2]);
    const yVal = evaluateMathExpression(namedPointMatch[3]);
    if (xVal !== null && yVal !== null) {
      boardManager.createPoint(xVal, yVal, name);
      return true;
    }
  }

  const anonPointMatch = preprocessed.match(
    /^\(?\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)?$/
  );
  if (anonPointMatch) {
    const xVal = evaluateMathExpression(anonPointMatch[1]);
    const yVal = evaluateMathExpression(anonPointMatch[2]);
    if (xVal !== null && yVal !== null) {
      boardManager.createPoint(xVal, yVal);
      return true;
    }
  }

  // 2. Circle: (x - h)^2 + (y - k)^2 = r^2 or x^2 + y^2 = r^2
  const circleMatch = preprocessed.match(
    /^(?:([a-z][a-z0-9_]*)\s*:\s*)?(?:\(x\s*([+-]\s*[^()]+?)\)|x)\^2\s*\+\s*(?:\(y\s*([+-]\s*[^()]+?)\)|y)\^2\s*=\s*(.+)$/i
  );
  if (circleMatch) {
    const name = circleMatch[1];
    let h = 0;
    if (circleMatch[2]) {
      const hVal = evaluateMathExpression(circleMatch[2]);
      if (hVal !== null) h = -hVal;
    }
    let k = 0;
    if (circleMatch[3]) {
      const kVal = evaluateMathExpression(circleMatch[3]);
      if (kVal !== null) k = -kVal;
    }
    const r2Val = evaluateMathExpression(circleMatch[4]);
    if (r2Val !== null && r2Val > 0) {
      const r = Math.sqrt(r2Val);
      const center = boardManager.createPoint(h, k, undefined, { visible: false });
      boardManager.createCircleRadius(center, r, name);
      return true;
    }
  }

  // 3. Linear Line: y = mx + b or y = mx or y = b
  const slopeInterceptMatch = preprocessed.match(
    /^(?:([a-z][a-z0-9_]*)\s*:\s*)?y\s*=\s*(?:([^x]+?)\s*\*?\s*x)?\s*([+-]\s*[^x]+)?$/i
  );
  if (slopeInterceptMatch && (slopeInterceptMatch[2] !== undefined || slopeInterceptMatch[3] !== undefined)) {
    const name = slopeInterceptMatch[1];
    let m = 0;
    if (slopeInterceptMatch[2] !== undefined) {
      const mStr = slopeInterceptMatch[2].trim();
      if (mStr === '' || mStr === '+') m = 1;
      else if (mStr === '-') m = -1;
      else {
        const mVal = evaluateMathExpression(mStr);
        if (mVal !== null) m = mVal;
      }
    }
    let b = 0;
    if (slopeInterceptMatch[3] !== undefined) {
      const bVal = evaluateMathExpression(slopeInterceptMatch[3]);
      if (bVal !== null) b = bVal;
    }

    // ax + by + c = 0 => mx - y + b = 0 => c = b, a = m, b = -1
    boardManager.createLineFromEquation(m, -1, b, name);
    return true;
  }

  // 4. Vertical Line: x = c
  const verticalLineMatch = preprocessed.match(/^(?:([a-z][a-z0-9_]*)\s*:\s*)?x\s*=\s*(.+)$/i);
  if (verticalLineMatch) {
    const name = verticalLineMatch[1];
    const cVal = evaluateMathExpression(verticalLineMatch[2]);
    if (cVal !== null) {
      // 1*x + 0*y - c = 0
      boardManager.createLineFromEquation(1, 0, -cVal, name);
      return true;
    }
  }

  // 5. General Line: Ax + By = C
  const standardLineMatch = preprocessed.match(
    /^(?:([a-z][a-z0-9_]*)\s*:\s*)?([^x]+?)\s*x\s*([+-]\s*[^y]+?)\s*y\s*=\s*(.+)$/i
  );
  if (standardLineMatch) {
    const name = standardLineMatch[1];
    const aVal = evaluateMathExpression(standardLineMatch[2] || '1');
    const bVal = evaluateMathExpression(standardLineMatch[3] || '1');
    const cVal = evaluateMathExpression(standardLineMatch[4]);
    if (aVal !== null && bVal !== null && cVal !== null) {
      boardManager.createLineFromEquation(aVal, bVal, -cVal, name);
      return true;
    }
  }

  // 6. Generic function or expression: y = f(x) or f(x) = ... or expression with x
  let fnExpr = '';
  const fnMatch = preprocessed.match(/^(?:(?:[a-z][a-z0-9_]*\s*\(x\)|y)\s*=\s*)(.+)$/i);
  if (fnMatch) {
    fnExpr = fnMatch[1];
  } else if (/\bx\b/i.test(preprocessed) && !preprocessed.includes('=')) {
    // E.g. \sqrt{x} or \sin(x) + \cos(x)
    fnExpr = preprocessed;
  }

  if (fnExpr) {
    try {
      const cleanExpr = fnExpr
        .replace(/(\d+)\s*([a-zA-Z(])/g, '$1 * $2')
        .replace(/\)\s*([a-zA-Z0-9(])/g, ') * $1')
        .replace(/\^/g, '**')
        .replace(/\bsin\b/gi, 'Math.sin')
        .replace(/\bcos\b/gi, 'Math.cos')
        .replace(/\btan\b/gi, 'Math.tan')
        .replace(/\bcot\b/gi, '(1/Math.tan')
        .replace(/\bsqrt\b/gi, 'Math.sqrt')
        .replace(/\babs\b/gi, 'Math.abs')
        .replace(/\bpi\b/gi, 'Math.PI')
        .replace(/\be\b/gi, 'Math.E')
        .replace(/\bln\b/gi, 'Math.log')
        .replace(/\blog\b/gi, 'Math.log10');

      const fn = new Function('x', `try { return ${cleanExpr}; } catch(e) { return NaN; }`) as (x: number) => number;
      const t0 = fn(0);
      const t1 = fn(1);
      const t2 = fn(2);
      if (!isNaN(t0) || !isNaN(t1) || !isNaN(t2)) {
        boardManager.createFunctionGraph(fn);
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}
