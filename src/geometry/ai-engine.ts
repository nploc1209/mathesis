import { AIConstructionProposal, GeometricElementState } from '../types/geometry';
import { BoardManager } from './board-manager';

export interface AIInterpretationResult {
  proposal: AIConstructionProposal;
  isAmbiguous: boolean;
  reasoning?: string;
}

export const NVIDIA_CONFIG = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'openai/gpt-oss-20b',
  apiKey: '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',
  temperature: 0.2,
  top_p: 1,
  max_tokens: 4096,
};

export type AIMode = 'speed' | 'accuracy';

/**
 * Strips theorem proof instructions and questions from geometry problem statements,
 * isolating only the geometric construction premise (figure to be drawn).
 */
export function extractDrawingPremise(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';
  const text = rawText.trim();

  // 1. Explicit proof trigger keywords (Vietnamese & English)
  // "Chứng minh rằng", "Chứng minh răng", "Chứng minh:", "CMR", "c/m", "c.m.r", "Prove that", "To prove", "Show that"
  const proofKeywordRegex = /(?:^|\n|[\.;]\s+)(?:ch[uứ]ng\s*minh\s*(?:r[ăaà]ng)?|ch[uứ]ng\s*t[oỏ]\s*(?:r[ăaà]ng)?|h[aã]y\s*ch[uứ]ng\s*minh|cmr|c\/m|c\.m\.r|cm:|prove\s+that|to\s+prove|show\s+that|verify\s+that)\b[:\s]*/i;
  const match = proofKeywordRegex.exec(text);
  if (match) {
    let cutoff = match.index;
    if (text[cutoff] === '.' || text[cutoff] === ';') {
      cutoff += 1;
    }
    const premise = text.substring(0, cutoff).trim();
    if (premise.length >= 15) return premise;
  }

  // 2. Numbered or lettered question blocks e.g. "\n1." or "\na)"
  const numberedQuestionRegex = /\n\s*(?:(?:[1-9]\.|\b[a-e]\))\s*(?:ch[uứ]ng\s*minh|cmr|t[ií]nh|ch[uứ]ng\s*t[oỏ]|t[ií]m|x[aá]c\s*đ[iị]nh|b[ốo]n\s*đi[ểe]m|t[ứu]\s*gi[aá]c|prove|show))/i;
  const numMatch = text.search(numberedQuestionRegex);
  if (numMatch !== -1) {
    const premise = text.substring(0, numMatch).trim();
    if (premise.length >= 15) return premise;
  }

  return text;
}

export class AIGeometryEngine {
  private boardManager: BoardManager;

  constructor(boardManager: BoardManager) {
    this.boardManager = boardManager;
  }

  /**
   * Interprets user geometry problem using openai/gpt-oss-20b on NVIDIA API.
   * Supports 'speed' and 'accuracy' modes.
   */
  public async interpretPrompt(
    prompt: string,
    modeOrKey?: AIMode | string,
    optionalKey?: string
  ): Promise<AIInterpretationResult> {
    let mode: AIMode = 'speed';
    let effectiveKey = NVIDIA_CONFIG.apiKey;

    if (modeOrKey === 'speed' || modeOrKey === 'accuracy') {
      mode = modeOrKey;
    } else if (modeOrKey && modeOrKey.startsWith('nvapi-')) {
      effectiveKey = modeOrKey.trim();
    }

    if (optionalKey && optionalKey.trim().length > 0) {
      effectiveKey = optionalKey.trim();
    }

    const drawingPremise = extractDrawingPremise(prompt);
    const existingElements = this.getExistingElements();
    try {
      return await this.callNvidiaAPI(prompt, drawingPremise, existingElements, effectiveKey, mode);
    } catch (err: any) {
      console.warn('Online AI construction attempt failed, activating built-in geometry engine:', err);
      const fallbackResult = this.offlineInterpret(drawingPremise || prompt, existingElements);
      if (fallbackResult && fallbackResult.proposal && fallbackResult.proposal.steps.length > 0) {
        return fallbackResult;
      }
      throw new Error(err.message || 'Unable to construct figure. Please check network connection.');
    }
  }

  /**
   * Executes the approved proposal onto the board.
   */
  public executeProposal(proposal: AIConstructionProposal): void {
    const board = this.boardManager.board;
    if (!board) return;

    board.suspendUpdate();

    // Map of logical names to created board elements
    const createdMap = new Map<string, any>();

    // Helper to find an object by name (case-insensitive or exact)
    const findObj = (name: any): any => {
      if (!name || typeof name !== 'string') return null;
      if (createdMap.has(name)) return createdMap.get(name);
      for (const [k, v] of createdMap.entries()) {
        if (k.toLowerCase() === name.toLowerCase()) return v;
      }
      for (const obj of Object.values(board.objects) as any[]) {
        if (obj.name && obj.name.toLowerCase() === name.toLowerCase()) {
          createdMap.set(obj.name, obj);
          return obj;
        }
      }
      return null;
    };

    // Helper to ensure line or segment between 2 points exists
    const getOrCreateLineBetween = (p1Name: string, p2Name: string): any => {
      const p1 = findObj(p1Name);
      const p2 = findObj(p2Name);
      if (!p1 || !p2) return null;
      for (const obj of Object.values(board.objects) as any[]) {
        if ((obj.elType === 'segment' || obj.elType === 'line') && obj.point1 && obj.point2) {
          if (
            (obj.point1.name === p1.name && obj.point2.name === p2.name) ||
            (obj.point1.name === p2.name && obj.point2.name === p1.name)
          ) {
            return obj;
          }
        }
      }
      const newLine = this.boardManager.createLine(p1, p2, `${p1.name}${p2.name}`);
      createdMap.set(`${p1.name}${p2.name}`, newLine);
      return newLine;
    };

    // Index existing objects by name
    Object.values(board.objects).forEach((obj: any) => {
      if (obj.name) {
        createdMap.set(obj.name, obj);
      }
    });

    for (const step of proposal.steps) {
      try {
        switch (step.action) {
          case 'createPoint': {
            const [arg1, arg2] = step.args;
            if (!isNaN(Number(arg1)) && !isNaN(Number(arg2))) {
              const pt = this.boardManager.createPoint(Number(arg1), Number(arg2), step.name, step.attrs);
              if (step.name) createdMap.set(step.name, pt);
            } else {
              // Relative point resolution (e.g. projection, midpoint)
              const p1 = findObj(arg1);
              const p2 = findObj(arg2);
              if (p1 && p2 && p1.elType === 'point' && p2.elType === 'point') {
                const mid = this.boardManager.createMidpoint(p1, p2, step.name);
                if (step.name) createdMap.set(step.name, mid);
              } else if (p1 && p1.elType === 'point') {
                let line = findObj(arg2);
                if (!line && typeof arg2 === 'string' && arg2.length === 2) {
                  line = getOrCreateLineBetween(arg2[0], arg2[1]);
                }
                if (line) {
                  const perp = this.boardManager.createPerpendicular(line, p1);
                  const inter = this.boardManager.createIntersection(perp, line, step.name);
                  if (step.name) createdMap.set(step.name, inter);
                }
              }
            }
            break;
          }

          case 'createSegment': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            if (p1 && p2) {
              const seg = this.boardManager.createSegment(p1, p2, step.name);
              if (step.name) createdMap.set(step.name, seg);
            }
            break;
          }

          case 'createLine': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            if (p1 && p2) {
              const line = this.boardManager.createLine(p1, p2, step.name);
              if (step.name) createdMap.set(step.name, line);
            }
            break;
          }

          case 'createRay': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            if (p1 && p2) {
              const ray = this.boardManager.createRay(p1, p2, step.name);
              if (step.name) createdMap.set(step.name, ray);
            }
            break;
          }

          case 'createCircle':
          case 'createCircle2P': {
            const center = findObj(step.args[0]);
            const pt = findObj(step.args[1]);
            if (center && pt) {
              const circ = this.boardManager.createCircle2P(center, pt, step.name);
              if (step.name) createdMap.set(step.name, circ);
            }
            break;
          }

          case 'createCircleRadius': {
            const center = findObj(step.args[0]);
            const radius = parseFloat(step.args[1]);
            if (center && !isNaN(radius)) {
              const circ = this.boardManager.createCircleRadius(center, radius, step.name);
              if (step.name) createdMap.set(step.name, circ);
            }
            break;
          }

          case 'createCircumcircle': {
            let p1 = findObj(step.args[0]);
            let p2 = findObj(step.args[1]);
            let p3 = findObj(step.args[2]);
            if (!p2 && !p3 && p1 && p1.vertices && p1.vertices.length >= 3) {
              p3 = p1.vertices[2];
              p2 = p1.vertices[1];
              p1 = p1.vertices[0];
            }
            const centerName = step.args[3] || (step.name === 'c_O' || step.name === 'cO' ? 'O' : undefined);
            if (p1 && p2 && p3) {
              const circ = this.boardManager.createCircumcircle(p1, p2, p3, step.name, centerName);
              if (step.name) createdMap.set(step.name, circ);
              if (circ.center) {
                createdMap.set(circ.center.name || 'O', circ.center);
              }
            }
            break;
          }

          case 'createIncircle': {
            let p1 = findObj(step.args[0]);
            let p2 = findObj(step.args[1]);
            let p3 = findObj(step.args[2]);
            if (!p2 && !p3 && p1 && p1.vertices && p1.vertices.length >= 3) {
              p3 = p1.vertices[2];
              p2 = p1.vertices[1];
              p1 = p1.vertices[0];
            }
            if (p1 && p2 && p3) {
              const circ = this.boardManager.createIncircle(p1, p2, p3, step.name);
              if (step.name) createdMap.set(step.name, circ);
            }
            break;
          }

          case 'createMidpoint': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            if (p1 && p2) {
              const mid = this.boardManager.createMidpoint(p1, p2, step.name);
              if (step.name) createdMap.set(step.name, mid);
            }
            break;
          }

          case 'createPerpendicular': {
            let line = findObj(step.args[0]);
            let pt = findObj(step.args[1]);
            if (step.args.length >= 3) {
              line = getOrCreateLineBetween(step.args[0], step.args[1]);
              pt = findObj(step.args[2]);
            } else if (!line && typeof step.args[0] === 'string' && step.args[0].length === 2) {
              line = getOrCreateLineBetween(step.args[0][0], step.args[0][1]);
            }
            if (line && pt) {
              const perp = this.boardManager.createPerpendicular(line, pt, step.name);
              if (step.name) createdMap.set(step.name, perp);
            }
            break;
          }

          case 'createParallel': {
            let line = findObj(step.args[0]);
            let pt = findObj(step.args[1]);
            if (step.args.length >= 3) {
              line = getOrCreateLineBetween(step.args[0], step.args[1]);
              pt = findObj(step.args[2]);
            } else if (!line && typeof step.args[0] === 'string' && step.args[0].length === 2) {
              line = getOrCreateLineBetween(step.args[0][0], step.args[0][1]);
            }
            if (line && pt) {
              const par = this.boardManager.createParallel(line, pt, step.name);
              if (step.name) createdMap.set(step.name, par);
            }
            break;
          }

          case 'createPerpendicularBisector': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            if (p1 && p2) {
              const pb = this.boardManager.createPerpendicularBisector(p1, p2, step.name);
              if (step.name) createdMap.set(step.name, pb);
            }
            break;
          }

          case 'createAngleBisector': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            const p3 = findObj(step.args[2]);
            if (p1 && p2 && p3) {
              const bis = this.boardManager.createAngleBisector(p1, p2, p3, step.name);
              if (step.name) createdMap.set(step.name, bis);
            }
            break;
          }

          case 'createPolygon': {
            const vertices = step.args.map((name: string) => findObj(name)).filter(Boolean);
            if (vertices.length >= 3) {
              const poly = this.boardManager.createPolygon(vertices, step.name);
              if (step.name) createdMap.set(step.name, poly);
            }
            break;
          }

          case 'createRegularPolygon': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            const sides = parseInt(step.args[2], 10);
            if (p1 && p2 && sides >= 3) {
              const poly = this.boardManager.createRegularPolygon(p1, p2, sides, step.name);
              if (step.name) createdMap.set(step.name, poly);
            }
            break;
          }

          case 'createOtherIntersection': {
            let el1 = findObj(step.args[0]);
            let el2 = findObj(step.args[1]);
            const exclude = findObj(step.args[2]);
            if (!el1 && typeof step.args[0] === 'string' && step.args[0].length === 2) {
              el1 = getOrCreateLineBetween(step.args[0][0], step.args[0][1]);
            }
            if (!el2 && typeof step.args[1] === 'string' && step.args[1].length === 2) {
              el2 = getOrCreateLineBetween(step.args[1][0], step.args[1][1]);
            }
            if (el1 && el2 && exclude) {
              const inter = this.boardManager.createOtherIntersection(el1, el2, exclude, step.name);
              if (step.name) createdMap.set(step.name, inter);
            }
            break;
          }

          case 'createIntersection': {
            let el1 = findObj(step.args[0]);
            let el2 = findObj(step.args[1]);
            if (!el1 && typeof step.args[0] === 'string' && step.args[0].length === 2) {
              el1 = getOrCreateLineBetween(step.args[0][0], step.args[0][1]);
            }
            if (!el2 && typeof step.args[1] === 'string' && step.args[1].length === 2) {
              el2 = getOrCreateLineBetween(step.args[1][0], step.args[1][1]);
            }
            const arg2 = step.args[2];
            let indexOrExclude: any = 0;
            if (arg2 !== undefined) {
              const obj = findObj(arg2);
              if (obj && obj.elType === 'point') {
                indexOrExclude = obj;
              } else if (!isNaN(Number(arg2))) {
                indexOrExclude = Number(arg2);
              }
            }
            if (el1 && el2) {
              const inter = this.boardManager.createIntersection(el1, el2, step.name, indexOrExclude);
              if (step.name) createdMap.set(step.name, inter);
            }
            break;
          }

          case 'createAngle': {
            const p1 = findObj(step.args[0]);
            const p2 = findObj(step.args[1]);
            const p3 = findObj(step.args[2]);
            if (p1 && p2 && p3) {
              const ang = this.boardManager.createAngle(p1, p2, p3, step.name);
              if (step.name) createdMap.set(step.name, ang);
            }
            break;
          }

          default:
            console.warn(`Unknown proposal action: ${step.action}`);
        }
      } catch (err) {
        console.error(`Error executing proposal step:`, step, err);
      }
    }

    board.unsuspendUpdate();
    board.fullUpdate();
    this.boardManager.syncElements();
  }

  // --- Offline NLP Geometry Interpreter ---

  private offlineInterpret(
    text: string,
    existingElements: GeometricElementState[]
  ): AIInterpretationResult {
    const premise = extractDrawingPremise(text);
    const lower = (premise || text).toLowerCase().trim();
    const existingPoints = existingElements.filter((e) => e.type === 'point');

    // Pattern 0: Acute triangle inscribed in circumcircle (O) with altitudes AD, BE, CF meeting at H (and M, N, P on (O))
    const isTriangle = lower.includes('tam giác') || lower.includes('triangle');
    const hasAltitudes =
      lower.includes('đường cao') ||
      lower.includes('altitude') ||
      lower.includes('trực tâm') ||
      lower.includes('orthocenter') ||
      lower.includes('cắt nhau tại h') ||
      lower.includes('meet at h') ||
      lower.includes('ad, be, cf') ||
      lower.includes('ad,be,cf');
    const hasCircumcircle =
      lower.includes('đường tròn') ||
      lower.includes('circle') ||
      lower.includes('nội tiếp') ||
      lower.includes('ngoại tiếp') ||
      lower.includes('circumcircle') ||
      lower.includes('(o)');

    if (isTriangle && hasAltitudes && hasCircumcircle) {
      const hasCircleIntersections =
        lower.includes('m,n,p') ||
        lower.includes('m, n, p') ||
        lower.includes('m, n') ||
        lower.includes('cắt đường tròn') ||
        lower.includes('intersect') ||
        lower.includes('m và n');

      const steps: any[] = [
        {
          description: 'Create point A at (-1, 4)',
          latex: 'A = (-1, 4)',
          action: 'createPoint',
          type: 'point',
          name: 'A',
          args: [-1, 4],
        },
        {
          description: 'Create point B at (-4, -2)',
          latex: 'B = (-4, -2)',
          action: 'createPoint',
          type: 'point',
          name: 'B',
          args: [-4, -2],
        },
        {
          description: 'Create point C at (4, -2)',
          latex: 'C = (4, -2)',
          action: 'createPoint',
          type: 'point',
          name: 'C',
          args: [4, -2],
        },
        {
          description: 'Draw acute triangle ABC',
          latex: '\\Delta ABC',
          action: 'createPolygon',
          type: 'polygon',
          name: 'poly1',
          args: ['A', 'B', 'C'],
        },
        {
          description: 'Construct circumcircle (O) through A, B, and C',
          latex: '(O)',
          action: 'createCircumcircle',
          type: 'circle',
          name: 'c_O',
          args: ['A', 'B', 'C'],
        },
        {
          description: 'Circumcenter point O at (0, -0.25)',
          latex: 'O = (0, -0.25)',
          action: 'createPoint',
          type: 'point',
          name: 'O',
          args: [0, -0.25],
        },
        {
          description: 'Base line BC',
          action: 'createLine',
          type: 'line',
          name: 'line_BC',
          args: ['B', 'C'],
        },
        {
          description: 'Side line AC',
          action: 'createLine',
          type: 'line',
          name: 'line_AC',
          args: ['A', 'C'],
        },
        {
          description: 'Side line AB',
          action: 'createLine',
          type: 'line',
          name: 'line_AB',
          args: ['A', 'B'],
        },
        {
          description: 'Altitude AD from A perpendicular to BC',
          latex: 'AD \\perp BC',
          action: 'createPerpendicular',
          type: 'line',
          name: 'alt_AD',
          args: ['line_BC', 'A'],
        },
        {
          description: 'Foot D of altitude AD on BC',
          latex: 'D = AD \\cap BC',
          action: 'createIntersection',
          type: 'point',
          name: 'D',
          args: ['alt_AD', 'line_BC'],
        },
        {
          description: 'Altitude BE from B perpendicular to AC',
          latex: 'BE \\perp AC',
          action: 'createPerpendicular',
          type: 'line',
          name: 'alt_BE',
          args: ['line_AC', 'B'],
        },
        {
          description: 'Foot E of altitude BE on AC',
          latex: 'E = BE \\cap AC',
          action: 'createIntersection',
          type: 'point',
          name: 'E',
          args: ['alt_BE', 'line_AC'],
        },
        {
          description: 'Altitude CF from C perpendicular to AB',
          latex: 'CF \\perp AB',
          action: 'createPerpendicular',
          type: 'line',
          name: 'alt_CF',
          args: ['line_AB', 'C'],
        },
        {
          description: 'Foot F of altitude CF on AB',
          latex: 'F = CF \\cap AB',
          action: 'createIntersection',
          type: 'point',
          name: 'F',
          args: ['alt_CF', 'line_AB'],
        },
        {
          description: 'Orthocenter H: intersection of altitudes AD, BE, CF',
          latex: 'H = AD \\cap BE \\cap CF',
          action: 'createIntersection',
          type: 'point',
          name: 'H',
          args: ['alt_AD', 'alt_BE'],
        },
      ];

      if (hasCircleIntersections) {
        steps.push(
          {
            description: 'Point M: second intersection of altitude AD with circumcircle (O)',
            latex: 'M = AD \\cap (O)',
            action: 'createOtherIntersection',
            type: 'point',
            name: 'M',
            args: ['alt_AD', 'c_O', 'A'],
          },
          {
            description: 'Point N: second intersection of altitude BE with circumcircle (O)',
            latex: 'N = BE \\cap (O)',
            action: 'createOtherIntersection',
            type: 'point',
            name: 'N',
            args: ['alt_BE', 'c_O', 'B'],
          },
          {
            description: 'Point P: second intersection of altitude CF with circumcircle (O)',
            latex: 'P = CF \\cap (O)',
            action: 'createOtherIntersection',
            type: 'point',
            name: 'P',
            args: ['alt_CF', 'c_O', 'C'],
          }
        );
      }

      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: 'Acute Triangle with Circumcircle & Altitudes',
          explanation: 'Constructs acute triangle ABC inscribed in circumcircle (O), altitudes AD, BE, CF meeting at orthocenter H' + (hasCircleIntersections ? ', and intersections M, N, P on (O).' : '.'),
          requiresConfirmation: true,
          steps,
        },
      };
    }

    // Pattern 0.5: Right-angled triangle with altitude AH
    if (
      isTriangle &&
      (lower.includes('vuông') || lower.includes('right')) &&
      (lower.includes('đường cao') || lower.includes('altitude') || lower.includes('ah'))
    ) {
      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: 'Right-Angled Triangle with Altitude',
          explanation: 'Constructs right-angled triangle ABC at vertex A with altitude AH perpendicular to BC.',
          requiresConfirmation: true,
          steps: [
            {
              description: 'Create vertex A at origin (0, 0)',
              latex: 'A = (0, 0)',
              action: 'createPoint',
              type: 'point',
              name: 'A',
              args: [0, 0],
            },
            {
              description: 'Create point B at (5, 0)',
              latex: 'B = (5, 0)',
              action: 'createPoint',
              type: 'point',
              name: 'B',
              args: [5, 0],
            },
            {
              description: 'Create point C at (0, 3.75)',
              latex: 'C = (0, 3.75)',
              action: 'createPoint',
              type: 'point',
              name: 'C',
              args: [0, 3.75],
            },
            {
              description: 'Draw right triangle ABC',
              latex: '\\Delta ABC',
              action: 'createPolygon',
              type: 'polygon',
              name: 'poly1',
              args: ['A', 'B', 'C'],
            },
            {
              description: 'Hypotenuse line BC',
              action: 'createLine',
              type: 'line',
              name: 'line_BC',
              args: ['B', 'C'],
            },
            {
              description: 'Altitude AH perpendicular to hypotenuse BC',
              latex: 'AH \\perp BC',
              action: 'createPerpendicular',
              type: 'line',
              name: 'alt_AH',
              args: ['line_BC', 'A'],
            },
            {
              description: 'Foot H of altitude on BC',
              latex: 'H = AH \\cap BC',
              action: 'createIntersection',
              type: 'point',
              name: 'H',
              args: ['alt_AH', 'line_BC'],
            },
          ],
        },
      };
    }

    // Ambiguity Check 1: Vague generic requests
    if (lower === 'draw a triangle' || lower === 'draw triangle' || lower === 'triangle') {
      return {
        isAmbiguous: true,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: 'Construct a triangle',
          explanation: 'What type of triangle would you like to construct?',
          questions: [
            'Equilateral triangle (equal sides)',
            'Right-angled triangle',
            'Arbitrary scalene triangle with vertices A(-3, -2), B(3, -2), C(0, 3)',
          ],
          requiresConfirmation: true,
          steps: [
            {
              description: 'Create point A at (-3, -2)',
              latex: 'A = (-3, -2)',
              action: 'createPoint',
              type: 'point',
              name: 'A',
              args: [-3, -2],
            },
            {
              description: 'Create point B at (3, -2)',
              latex: 'B = (3, -2)',
              action: 'createPoint',
              type: 'point',
              name: 'B',
              args: [3, -2],
            },
            {
              description: 'Create point C at (0, 3)',
              latex: 'C = (0, 3)',
              action: 'createPoint',
              type: 'point',
              name: 'C',
              args: [0, 3],
            },
            {
              description: 'Create triangle polygon ABC',
              latex: '\\Delta ABC',
              action: 'createPolygon',
              type: 'polygon',
              name: 'poly1',
              args: ['A', 'B', 'C'],
            },
          ],
        },
      };
    }

    // Pattern 1: Equilateral triangle
    if (lower.includes('equilateral triangle')) {
      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: 'Equilateral Triangle',
          explanation: 'Constructs an equilateral triangle ABC with side length 5.',
          requiresConfirmation: true,
          steps: [
            {
              description: 'Create point A at (-2.5, -2)',
              latex: 'A = (-2.5, -2)',
              action: 'createPoint',
              type: 'point',
              name: 'A',
              args: [-2.5, -2],
            },
            {
              description: 'Create point B at (2.5, -2)',
              latex: 'B = (2.5, -2)',
              action: 'createPoint',
              type: 'point',
              name: 'B',
              args: [2.5, -2],
            },
            {
              description: 'Construct regular triangle polygon ABC',
              latex: '\\Delta ABC',
              action: 'createRegularPolygon',
              type: 'polygon',
              name: 'poly1',
              args: ['A', 'B', 3],
            },
          ],
        },
      };
    }

    // Pattern 2: Triangle with circumcircle
    if (lower.includes('circumcircle') || (lower.includes('triangle') && lower.includes('circle'))) {
      const pA = existingPoints.find((p) => p.name === 'A');
      const pB = existingPoints.find((p) => p.name === 'B');
      const pC = existingPoints.find((p) => p.name === 'C');

      const needPoints = !(pA && pB && pC);
      const steps: any[] = [];

      if (needPoints) {
        steps.push(
          {
            description: 'Create point A at (-3, -2)',
            latex: 'A = (-3, -2)',
            action: 'createPoint',
            type: 'point',
            name: 'A',
            args: [-3, -2],
          },
          {
            description: 'Create point B at (3, -2)',
            latex: 'B = (3, -2)',
            action: 'createPoint',
            type: 'point',
            name: 'B',
            args: [3, -2],
          },
          {
            description: 'Create point C at (0, 3)',
            latex: 'C = (0, 3)',
            action: 'createPoint',
            type: 'point',
            name: 'C',
            args: [0, 3],
          },
          {
            description: 'Draw triangle ABC',
            latex: '\\Delta ABC',
            action: 'createPolygon',
            type: 'polygon',
            name: 'poly1',
            args: ['A', 'B', 'C'],
          }
        );
      }

      steps.push({
        description: 'Construct circumcircle through A, B, and C',
        latex: '\\odot(A, B, C)',
        action: 'createCircumcircle',
        type: 'circle',
        name: 'c_{circum}',
        args: ['A', 'B', 'C'],
      });

      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: 'Triangle with Circumcircle',
          explanation: 'Constructs triangle ABC and its unique circumscribed circle.',
          requiresConfirmation: true,
          steps,
        },
      };
    }

    // Pattern 3: Euler line / Orthocenter / Centroid
    if (lower.includes('euler line') || lower.includes('orthocenter')) {
      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: 'Triangle Orthocenter and Altitudes',
          explanation: 'Constructs triangle ABC and the three altitudes meeting at orthocenter H.',
          requiresConfirmation: true,
          steps: [
            {
              description: 'Create point A at (-4, -2)',
              latex: 'A = (-4, -2)',
              action: 'createPoint',
              type: 'point',
              name: 'A',
              args: [-4, -2],
            },
            {
              description: 'Create point B at (4, -2)',
              latex: 'B = (4, -2)',
              action: 'createPoint',
              type: 'point',
              name: 'B',
              args: [4, -2],
            },
            {
              description: 'Create point C at (-1, 3.5)',
              latex: 'C = (-1, 3.5)',
              action: 'createPoint',
              type: 'point',
              name: 'C',
              args: [-1, 3.5],
            },
            {
              description: 'Draw segment AB',
              action: 'createSegment',
              type: 'segment',
              name: 's_{AB}',
              args: ['A', 'B'],
            },
            {
              description: 'Draw segment BC',
              action: 'createSegment',
              type: 'segment',
              name: 's_{BC}',
              args: ['B', 'C'],
            },
            {
              description: 'Draw segment CA',
              action: 'createSegment',
              type: 'segment',
              name: 's_{CA}',
              args: ['C', 'A'],
            },
            {
              description: 'Altitude from C perpendicular to AB',
              latex: 'h_C \\perp AB',
              action: 'createPerpendicular',
              type: 'line',
              name: 'h_C',
              args: ['s_{AB}', 'C'],
            },
            {
              description: 'Altitude from A perpendicular to BC',
              latex: 'h_A \\perp BC',
              action: 'createPerpendicular',
              type: 'line',
              name: 'h_A',
              args: ['s_{BC}', 'A'],
            },
            {
              description: 'Orthocenter H = h_A \\cap h_C',
              latex: 'H = h_A \\cap h_C',
              action: 'createIntersection',
              type: 'point',
              name: 'H',
              args: ['h_A', 'h_C'],
            },
          ],
        },
      };
    }

    // Pattern 4: Midpoint of segment / points
    const midMatch = lower.match(/midpoint.*([a-z])\s*(?:and|,)?\s*([a-z])/i);
    if (midMatch) {
      const p1 = midMatch[1].toUpperCase();
      const p2 = midMatch[2].toUpperCase();
      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: `Midpoint of ${p1}${p2}`,
          explanation: `Constructs the midpoint of segment ${p1}${p2}.`,
          requiresConfirmation: true,
          steps: [
            {
              description: `Construct midpoint M between ${p1} and ${p2}`,
              latex: `M = \\frac{${p1} + ${p2}}{2}`,
              action: 'createMidpoint',
              type: 'point',
              name: `M_{${p1}${p2}}`,
              args: [p1, p2],
            },
          ],
        },
      };
    }

    // Pattern 5: Perpendicular bisector
    const pbMatch = lower.match(/perpendicular bisector.*([a-z])\s*(?:and|,)?\s*([a-z])/i);
    if (pbMatch) {
      const p1 = pbMatch[1].toUpperCase();
      const p2 = pbMatch[2].toUpperCase();
      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: `Perpendicular Bisector of ${p1}${p2}`,
          explanation: `Constructs the perpendicular bisector of segment ${p1}${p2}.`,
          requiresConfirmation: true,
          steps: [
            {
              description: `Construct perpendicular bisector of ${p1}${p2}`,
              latex: `m_{${p1}${p2}} \\perp ${p1}${p2}`,
              action: 'createPerpendicularBisector',
              type: 'line',
              name: `m_{${p1}${p2}}`,
              args: [p1, p2],
            },
          ],
        },
      };
    }

    // Pattern 6: Circle with center and radius / point
    const circMatch = lower.match(/circle.*center\s*([a-z]).*(?:radius\s*(\d+(?:\.\d+)?)|through\s*([a-z]))/i);
    if (circMatch) {
      const center = circMatch[1].toUpperCase();
      const radius = circMatch[2];
      const throughPt = circMatch[3] ? circMatch[3].toUpperCase() : null;

      if (radius) {
        return {
          isAmbiguous: false,
          proposal: {
            id: `prop_${Date.now()}`,
            summary: `Circle at ${center} with radius ${radius}`,
            explanation: `Constructs a circle centered at point ${center} with fixed radius ${radius}.`,
            requiresConfirmation: true,
            steps: [
              {
                description: `Circle center ${center}, radius ${radius}`,
                latex: `(x - x_${center})^2 + (y - y_${center})^2 = ${radius}^2`,
                action: 'createCircleRadius',
                type: 'circle',
                name: `c_{${center}}`,
                args: [center, parseFloat(radius)],
              },
            ],
          },
        };
      } else if (throughPt) {
        return {
          isAmbiguous: false,
          proposal: {
            id: `prop_${Date.now()}`,
            summary: `Circle at ${center} through ${throughPt}`,
            explanation: `Constructs a circle with center ${center} passing through point ${throughPt}.`,
            requiresConfirmation: true,
            steps: [
              {
                description: `Circle center ${center} through ${throughPt}`,
                latex: `\\odot(${center}, |${center}${throughPt}|)`,
                action: 'createCircle2P',
                type: 'circle',
                name: `c_{${center}}`,
                args: [center, throughPt],
              },
            ],
          },
        };
      }
    }

    // Pattern 7: Regular polygon (e.g. pentagon, hexagon, octagon)
    const polygonSides: Record<string, number> = {
      pentagon: 5,
      hexagon: 6,
      heptagon: 7,
      octagon: 8,
      decagon: 10,
      dodecagon: 12,
    };

    for (const [name, sides] of Object.entries(polygonSides)) {
      if (lower.includes(name)) {
        return {
          isAmbiguous: false,
          proposal: {
            id: `prop_${Date.now()}`,
            summary: `Regular ${name.charAt(0).toUpperCase() + name.slice(1)}`,
            explanation: `Constructs a regular ${sides}-sided polygon.`,
            requiresConfirmation: true,
            steps: [
              {
                description: 'Create base point A at (-2, -2)',
                latex: 'A = (-2, -2)',
                action: 'createPoint',
                type: 'point',
                name: 'A',
                args: [-2, -2],
              },
              {
                description: 'Create base point B at (2, -2)',
                latex: 'B = (2, -2)',
                action: 'createPoint',
                type: 'point',
                name: 'B',
                args: [2, -2],
              },
              {
                description: `Create regular ${name}`,
                action: 'createRegularPolygon',
                type: 'polygon',
                name: `poly_{${name}}`,
                args: ['A', 'B', sides],
              },
            ],
          },
        };
      }
    }

    // Fallback: General point / coordinates parsing
    const coordMatches = text.match(/([A-Z])\s*(?:at|=)?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g);
    if (coordMatches && coordMatches.length > 0) {
      const steps: any[] = [];
      coordMatches.forEach((m) => {
        const parts = m.match(/([A-Z])\s*(?:at|=)?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
        if (parts) {
          const ptName = parts[1];
          const x = parseFloat(parts[2]);
          const y = parseFloat(parts[3]);
          steps.push({
            description: `Create point ${ptName} at (${x}, ${y})`,
            latex: `${ptName} = (${x}, ${y})`,
            action: 'createPoint',
            type: 'point',
            name: ptName,
            args: [x, y],
          });
        }
      });

      return {
        isAmbiguous: false,
        proposal: {
          id: `prop_${Date.now()}`,
          summary: `Plot Coordinates`,
          explanation: `Plotted ${steps.length} specified point(s).`,
          requiresConfirmation: true,
          steps,
        },
      };
    }

    // Default response for unhandled commands: Ask clarifying question
    return {
      isAmbiguous: true,
      proposal: {
        id: `prop_${Date.now()}`,
        summary: 'Geometry Request',
        explanation: `I understood your instruction "${text}", but I need more details to construct it accurately.`,
        questions: [
          'Which existing points or objects should be connected?',
          'What are the desired coordinates or measurements?',
          'Would you like a standard sample construction (e.g. triangle with circumcircle, orthocenter, or regular polygon)?',
        ],
        requiresConfirmation: true,
        steps: [
          {
            description: 'Sample point A at (0, 0)',
            latex: 'A = (0, 0)',
            action: 'createPoint',
            type: 'point',
            name: 'A',
            args: [0, 0],
          },
        ],
      },
    };
  }

  // --- NVIDIA gpt-oss-20b API Integration ---

  private async callNvidiaAPI(
    prompt: string,
    drawingPremise: string,
    existingElements: GeometricElementState[],
    apiKey: string,
    mode: AIMode = 'speed'
  ): Promise<AIInterpretationResult> {
    const isSpeed = mode === 'speed';
    const temperature = isSpeed ? 0.1 : 0.2;
    const maxTokens = isSpeed ? 1536 : 4096;

    const modeDirective = isSpeed
      ? `MODE: SPEED PRIORITY (RAPID GENERATION)
- Generate the JSON construction directly. Keep internal reasoning to under 3 lines to minimize latency.
- Provide clean, essential geometric steps with standard coordinates.`
      : `MODE: ACCURACY PRIORITY (MATHEMATICAL RIGOR)
- Verify coordinates, orthocenters, circumcenters, midpoints, and theorem relations in concise reasoning (under 5 lines) before outputting the final JSON.`;

    const systemPrompt = `You are Mathesis AI, an expert Euclidean Geometry assistant for a 2D dynamic geometry application.
Your EXCLUSIVE mission is to output a single JSON object containing sequential tool-calling steps to DRAW the geometric figure described in the user's problem.

CRITICAL MANDATE - FIGURE DRAWING ONLY (NO THEOREM PROOFS):
1. ZERO THEOREM PROOFS: Geometry problems frequently contain theorems or sub-questions to prove (e.g., "Chứng minh rằng...", "Prove that...", cyclic quadrilaterals, equal products like AE*AC = AH*AD, symmetry, or concyclic points). YOU MUST COMPLETELY IGNORE all proof requests and theorems to be proven!
2. DO NOT WRITE ANY PROOFS, DERIVATIONS, OR SOLUTIONS. DO NOT SOLVE THE PROBLEM.
3. EXTRACT ONLY OBJECTS TO DRAW: Identify the base objects to construct: points, segments, lines, triangles, polygons, circles, circumcircles, altitudes, medians, bisectors, and intersection points.
4. TOKEN BUDGET & LATENCY: Keep reasoning under 5 lines strictly for numerical coordinates and tool steps to prevent token exhaustion.
5. All descriptions and summaries in JSON must be in English.

${modeDirective}

AVAILABLE GEOMETRIC TOOLS:
1. createPoint: args: [x, y] (numerical coordinates between -7 and 7)
2. createSegment: args: [p1_name, p2_name]
3. createLine: args: [p1_name, p2_name]
4. createRay: args: [origin_p, through_p]
5. createPolygon: args: [p1, p2, p3, ...] (e.g. ["A", "B", "C"])
6. createRegularPolygon: args: [p1, p2, num_sides]
7. createCircle2P or createCircle: args: [center_name, point_on_circle]
8. createCircleRadius: args: [center_name, radius_number]
9. createCircumcircle: args: [p1, p2, p3] (circumcircle of triangle)
10. createIncircle: args: [p1, p2, p3] (inscribed circle of triangle)
11. createMidpoint: args: [p1, p2]
12. createPerpendicular: args: [line_or_seg_name, point_name] or [p1, p2, point_name]
13. createParallel: args: [line_or_seg_name, point_name]
14. createPerpendicularBisector: args: [p1, p2]
15. createAngleBisector: args: [p1, vertex, p2]
16. createIntersection: args: [element1, element2] or [element1, element2, index_or_exclude_point] (use index 1 or exclude point for 2nd intersection with a circle)
17. createOtherIntersection: args: [element1, element2, point_to_exclude]
18. createAngle: args: [p1, vertex, p2]

CRITICAL RULES FOR DRAWING:
1. Base Points: ALWAYS provide concrete numerical coordinates for initial vertices using createPoint with clean values.
   - For an acute triangle ABC: e.g. A=[-1, 4], B=[-4, -2], C=[4, -2] (all angles strictly acute).
   - For a right triangle ABC at A: e.g. A=[0, 0], B=[4, 0], C=[0, 3].
2. Altitudes & Orthocenters:
   - For altitude AD from A to BC: createPerpendicular with ["B", "C", "A"] (or line BC, "A"), then createIntersection for D.
   - For altitude BE from B to AC: createPerpendicular with ["A", "C", "B"] (or line AC, "B"), then createIntersection for E.
   - For altitude CF from C to AB: createPerpendicular with ["A", "B", "C"] (or line AB, "C"), then createIntersection for F.
   - For orthocenter H: createIntersection of two altitudes (e.g. AD and BE).
3. Circle Intersections:
   - When altitudes AD, BE, CF intersect circumcircle (O) at M, N, P: use createOtherIntersection or createIntersection with the vertex to exclude (e.g. ["alt_AD", "c_O", "A"] for M).
4. Connect vertices with createPolygon or createSegment.
5. Output STRICTLY a single valid JSON object without markdown wrapper outside JSON syntax:
{
  "summary": "Short title describing the figure",
  "explanation": "Brief 1-sentence description of the figure",
  "steps": [
    {
      "description": "Step description",
      "latex": "KaTeX representation if applicable",
      "action": "createPoint",
      "type": "point",
      "name": "A",
      "args": [0, 0]
    }
  ]
}`;

    const userMessageContent = drawingPremise !== prompt.trim()
      ? `GEOMETRIC CONFIGURATION TO DRAW (Proof questions have been excluded):
${drawingPremise}

CRITICAL MANDATE:
- Construct the geometric figure described above.
- ONLY output the JSON steps for drawing on canvas.
- DO NOT WRITE ANY THEOREM PROOFS, MATHEMATICAL VERIFICATIONS, OR SOLUTIONS.
- Reason in under 5 lines strictly for numerical coordinates.`
      : `GEOMETRY DRAWING REQUEST:
${prompt}

CRITICAL MANDATE:
- Focus EXCLUSIVELY on drawing the geometric figure.
- If the problem asks to prove theorems (e.g. cyclic quadrilaterals, equal products, collinearity, symmetry), COMPLETELY IGNORE them. DO NOT write any proofs or solutions.
- ONLY output the JSON steps for drawing on canvas.
- Reason in under 5 lines strictly for numerical coordinates.`;

    const requestPayload = {
      model: NVIDIA_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      temperature: temperature,
      top_p: NVIDIA_CONFIG.top_p,
      max_tokens: maxTokens,
      stream: false,
    };

    // Use Vite server proxy (/api/nvidia) in browser to completely avoid CORS preflight blocking
    let response: Response;
    try {
      response = await fetch('/api/nvidia/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (fetchErr: any) {
      throw new Error(`AI proxy connection issue: ${fetchErr.message || 'Server unavailable'}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    let rawContent = (message?.content || '').trim();
    let reasoning = (message?.reasoning_content || message?.reasoning || '').trim();

    // In case reasoning is formatted inside <think>...</think>
    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      if (!reasoning) {
        reasoning = thinkMatch[1].trim();
      }
      rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    // Attempt to extract JSON from rawContent or reasoning
    let parsed: any = null;
    const candidates = [rawContent, reasoning];

    for (const text of candidates) {
      if (!text) continue;
      let candidateJson = text;
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        candidateJson = codeBlockMatch[1].trim();
      } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          candidateJson = text.substring(firstBrace, lastBrace + 1);
        }
      }
      try {
        const p = JSON.parse(candidateJson);
        if (p && Array.isArray(p.steps) && p.steps.length > 0) {
          parsed = p;
          break;
        }
      } catch {}
    }

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Model did not return valid geometric steps. Click Construct Figure to retry.');
    }

    return {
      isAmbiguous: false,
      reasoning: reasoning || undefined,
      proposal: {
        id: `prop_${Date.now()}`,
        summary: parsed.summary || 'AI Geometric Construction',
        explanation: parsed.explanation || '',
        questions: parsed.questions,
        requiresConfirmation: false,
        steps: parsed.steps,
      },
    };
  }

  private getExistingElements(): GeometricElementState[] {
    const board = this.boardManager.board;
    if (!board) return [];

    const elements: GeometricElementState[] = [];
    Object.values(board.objects).forEach((obj: any) => {
      if (
        obj.elType !== 'axis' &&
        obj.elType !== 'ticks' &&
        obj.elType !== 'grid' &&
        !obj.visProp?.isLabel
      ) {
        elements.push(this.boardManager.formatElementState(obj));
      }
    });

    return elements;
  }
}
