import JXG from 'jsxgraph';
import type { Board } from 'jsxgraph';
import {
  ToolType,
  GeometricElementState,
  BoardSettings,
  ConstructionStep,
} from '../types/geometry';

export interface BoardManagerCallbacks {
  onElementsChange?: (elements: GeometricElementState[]) => void;
  onSelectedElementChange?: (element: GeometricElementState | null) => void;
  onToolStep?: (message: string, currentStep: number, totalSteps: number) => void;
  onToolComplete?: () => void;
  onRequestInput?: (
    title: string,
    prompt: string,
    defaultValue: string | number,
    type?: 'number' | 'text'
  ) => Promise<string | number | null>;
}

export class BoardManager {
  public board: Board | null = null;
  public containerId: string;
  private settings: BoardSettings;
  private callbacks: BoardManagerCallbacks;
  private activeTool: ToolType = 'select';

  // Interaction state
  private selectedElements: any[] = [];
  private activeSelectedElement: any = null;
  private polygonVertices: any[] = [];

  // Manual Canvas Dragging state
  private isCanvasDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private originStartX = 0;
  private originStartY = 0;

  // Tracking names
  private pointIndex = 0;
  private lineIndex = 0;
  private circleIndex = 0;
  private polyIndex = 0;
  private angleIndex = 0;

  constructor(
    containerId: string,
    settings: BoardSettings,
    callbacks: BoardManagerCallbacks = {}
  ) {
    this.containerId = containerId;
    this.settings = settings;
    this.callbacks = callbacks;
  }

  public init(): Board {
    if (this.board) {
      JXG.JSXGraph.freeBoard(this.board);
      this.board = null;
    }

    // Set JSXGraph global options for infinite pan, zoom, KaTeX, and label auto-positioning
    if ((JXG as any).Options) {
      if ((JXG as any).Options.board?.pan) {
        (JXG as any).Options.board.pan.needshift = false;
        (JXG as any).Options.board.pan.needShift = false;
      }
      if ((JXG as any).Options.board?.zoom) {
        (JXG as any).Options.board.zoom.needshift = false;
        (JXG as any).Options.board.zoom.needShift = false;
      }
      if ((JXG as any).Options.text) {
        (JXG as any).Options.text.useKatex = true;
      }
      if (!(JXG as any).Options.label) (JXG as any).Options.label = {};
      (JXG as any).Options.label.autoPosition = true;
      (JXG as any).Options.label.autoPositionMinDistance = 12;
      (JXG as any).Options.label.autoPositionMaxDistance = 36;

      if (!(JXG as any).Options.point) (JXG as any).Options.point = {};
      if (!(JXG as any).Options.point.label) (JXG as any).Options.point.label = {};
      (JXG as any).Options.point.label.autoPosition = true;
      (JXG as any).Options.point.label.autoPositionMinDistance = 12;
      (JXG as any).Options.point.label.autoPositionMaxDistance = 36;
    }

    // Initialize board with square aspect ratio and unit ticks 1, 2, 3...
    this.board = JXG.JSXGraph.initBoard(this.containerId, {
      boundingbox: this.settings.boundingBox,
      axis: this.settings.showAxes,
      grid: false,
      showCopyright: false,
      showNavigation: false,
      keepaspectratio: true,
      defaultAxes: {
        x: {
          name: 'x',
          withLabel: true,
          label: {
            position: 'rt',
            offset: [-15, 20],
          },
          ticks: {
            drawLabels: true,
            label: {
              offset: [-4, -12],
            },
            insertTicks: true,
            minTicksDistance: 35,
            minorTicks: 0,
            drawZero: false,
          },
        },
        y: {
          name: 'y',
          withLabel: true,
          label: {
            position: 'rt',
            offset: [20, -15],
          },
          ticks: {
            drawLabels: true,
            label: {
              offset: [-15, -4],
            },
            insertTicks: true,
            minTicksDistance: 35,
            minorTicks: 0,
            drawZero: false,
          },
        },
      },
      pan: {
        enabled: true,
        needshift: false,
        needShift: false,
        needTwoFingers: false,
      } as any,
      zoom: {
        factorX: 1.25,
        factorY: 1.25,
        wheel: true,
        needshift: false,
        needShift: false,
        min: 0.00001,
        max: 100000.0,
      } as any,
      maxBoundingBox: [-Infinity, Infinity, Infinity, -Infinity],
    });

    if ((this.board as any)?.attr?.pan) {
      (this.board as any).attr.pan.enabled = true;
      (this.board as any).attr.pan.needshift = false;
      (this.board as any).attr.pan.needShift = false;
      (this.board as any).attr.pan.needtwofingers = false;
      (this.board as any).attr.pan.needctrl = false;
    }

    // Create adaptive square grid with solid clean lines
    if (this.settings.showGrid) {
      const grid = this.board.create('grid', [], {
        strokeColor: '#e2e8f0',
        strokeWidth: 0.8,
        dash: 0,
        highlight: false,
      });
      (grid as any)._isInternalGrid = true;
    }

    this.hideInternalSystemObjects();
    this.setupEventListeners();
    this.syncElements();

    return this.board;
  }

  public getBoard(): Board | null {
    return this.board;
  }

  public setTool(tool: ToolType): void {
    this.activeTool = tool;
    this.clearToolSelection();

    if (!this.board) return;

    if (tool === 'select') {
      this.board.mode = this.board.BOARD_MODE_NONE || 0;
      this.callbacks.onToolStep?.('', 0, 0);
    }
  }

  public getActiveTool(): ToolType {
    return this.activeTool;
  }

  public updateSettings(newSettings: Partial<BoardSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (!this.board) return;

    if (newSettings.boundingBox) {
      this.board.setBoundingBox(newSettings.boundingBox, true);
    }

    if (newSettings.showAxes !== undefined) {
      const axes = (this.board as any)?.defaultAxes;
      if (axes) {
        if (axes.x?.setAttribute) axes.x.setAttribute({ visible: newSettings.showAxes });
        if (axes.y?.setAttribute) axes.y.setAttribute({ visible: newSettings.showAxes });
      }
    }

    if (newSettings.showGrid !== undefined) {
      const grids = Object.values(this.board.objects).filter((obj: any) => obj.elType === 'grid');
      if (grids.length === 0 && newSettings.showGrid) {
        const grid = this.board.create('grid', [], {
          strokeColor: '#e2e8f0',
          strokeWidth: 0.8,
          dash: 0,
          highlight: false,
        });
        (grid as any)._isInternalGrid = true;
      } else {
        grids.forEach((g: any) => g.setAttribute({ visible: newSettings.showGrid }));
      }
    }

    this.board.fullUpdate();
  }

  private highlightElement(el: any, val: boolean): void {
    if (!el) return;
    try {
      if (val) {
        if (typeof el.highlight === 'function') el.highlight();
        else el.highlighted = true;
      } else {
        if (typeof el.noHighlight === 'function') el.noHighlight();
        else el.highlighted = false;
      }
    } catch {
      // ignore
    }
  }

  public clearToolSelection(): void {
    this.selectedElements.forEach((el) => {
      this.highlightElement(el, false);
    });
    this.selectedElements = [];
    this.polygonVertices = [];
    if (this.board) {
      this.board.fullUpdate();
    }
  }

  private setupEventListeners(): void {
    if (!this.board) return;

    const container = document.getElementById(this.containerId);

    // Direct background pan listeners on container to guarantee 100% smooth canvas dragging
    const onPointerDown = (clientX: number, clientY: number, target: EventTarget | null) => {
      if (!this.board || this.activeTool !== 'select') return;

      // Check if mouse is on a geometric element
      const coords = this.board.getUsrCoordsOfMouse({ clientX, clientY } as any);
      const objects = this.board.getAllObjectsUnderMouse({ clientX, clientY } as any) as any[];
      const userObjects = objects.filter(
        (obj) =>
          obj.elType !== 'axis' &&
          obj.elType !== 'ticks' &&
          obj.elType !== 'grid' &&
          obj.visProp?.visible !== false
      );

      if (userObjects.length === 0) {
        this.isCanvasDragging = true;
        this.dragStartX = clientX;
        this.dragStartY = clientY;
        this.originStartX = this.board.origin.scrCoords[1];
        this.originStartY = this.board.origin.scrCoords[2];
      }
    };

    const onPointerMove = (clientX: number, clientY: number) => {
      if (this.isCanvasDragging && this.board) {
        const dx = clientX - this.dragStartX;
        const dy = clientY - this.dragStartY;
        this.board.moveOrigin(this.originStartX + dx, this.originStartY + dy);
      }
    };

    const onPointerUp = () => {
      this.isCanvasDragging = false;
    };

    if (container) {
      container.addEventListener('mousedown', (e) => {
        if (e.button === 0) onPointerDown(e.clientX, e.clientY, e.target);
      });
      window.addEventListener('mousemove', (e) => {
        if (this.isCanvasDragging) onPointerMove(e.clientX, e.clientY);
      });
      window.addEventListener('mouseup', onPointerUp);

      container.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length === 1) {
            onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target);
          }
        },
        { passive: true }
      );
      window.addEventListener(
        'touchmove',
        (e) => {
          if (this.isCanvasDragging && e.touches.length === 1) {
            onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        },
        { passive: true }
      );
      window.addEventListener('touchend', onPointerUp);
    }

    // Board click handler for geometric tools
    this.board.on('down', (e: MouseEvent | TouchEvent) => {
      this.handleBoardDown(e);
    });

    // Board update event
    this.board.on('update', () => {
      this.syncElements();
    });
  }

  private handleBoardDown(e: MouseEvent | TouchEvent): void {
    if (!this.board) return;
    if ('button' in e && e.button !== 0) return;

    const coords = this.board.getUsrCoordsOfMouse(e);
    const elementsUnderMouse = this.board.getAllObjectsUnderMouse(e) as any[];

    // Filter out internal axes/grids/ticks
    const validObjects = elementsUnderMouse.filter(
      (obj) =>
        obj.elType !== 'axis' &&
        obj.elType !== 'ticks' &&
        obj.elType !== 'grid' &&
        obj.visProp?.visible !== false
    );

    const targetObject = validObjects.length > 0 ? validObjects[0] : null;

    if (this.activeTool === 'select') {
      if (targetObject) {
        this.selectObjectForInspector(targetObject);
      } else {
        this.selectObjectForInspector(null);
      }
      return;
    }

    this.handleToolAction(coords, targetObject);
  }

  private async handleToolAction(
    coords: [number, number],
    clickedObject: any | null
  ): Promise<void> {
    if (!this.board) return;

    let x = coords[0];
    let y = coords[1];
    if (this.settings.snapToGrid) {
      const snap = this.settings.gridSnapSize || 1;
      x = Math.round(x / snap) * snap;
      y = Math.round(y / snap) * snap;
    } else {
      x = this.snapToSpecialCoordinate(x);
      y = this.snapToSpecialCoordinate(y);
    }

    switch (this.activeTool) {
      case 'point': {
        // If clicking on an existing curve, bind as point on object (glider)
        if (
          clickedObject &&
          (clickedObject.elType === 'line' ||
            clickedObject.elType === 'segment' ||
            clickedObject.elType === 'circle')
        ) {
          this.createGlider(x, y, clickedObject);
        } else {
          this.createPoint(x, y);
        }
        this.finishToolAction();
        break;
      }

      case 'intersection': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select 2nd object', 1, 2);
          } else if (this.selectedElements.length === 2) {
            this.createIntersection(this.selectedElements[0], this.selectedElements[1]);
            this.finishToolAction();
          }
        }
        break;
      }

      case 'midpoint': {
        if (clickedObject && (clickedObject.elType === 'segment' || clickedObject.elType === 'circle')) {
          this.createMidpointOfObject(clickedObject);
          this.finishToolAction();
        } else {
          const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
          this.selectedElements.push(pt);
          this.highlightElement(pt, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select 2nd point', 1, 2);
          } else if (this.selectedElements.length === 2) {
            this.createMidpoint(this.selectedElements[0], this.selectedElements[1]);
            this.finishToolAction();
          }
        }
        break;
      }

      case 'segment':
      case 'line':
      case 'ray':
      case 'vector': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
        this.selectedElements.push(pt);
        this.highlightElement(pt, true);
        this.board.fullUpdate();

        if (this.selectedElements.length === 1) {
          this.callbacks.onToolStep?.('Select 2nd point', 1, 2);
        } else if (this.selectedElements.length === 2) {
          if (this.activeTool === 'segment') {
            this.createSegment(this.selectedElements[0], this.selectedElements[1]);
          } else if (this.activeTool === 'line') {
            this.createLine(this.selectedElements[0], this.selectedElements[1]);
          } else if (this.activeTool === 'ray') {
            this.createRay(this.selectedElements[0], this.selectedElements[1]);
          } else if (this.activeTool === 'vector') {
            this.createVector(this.selectedElements[0], this.selectedElements[1]);
          }
          this.finishToolAction();
        }
        break;
      }

      case 'perpendicular':
      case 'parallel': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.(clickedObject.elType === 'point' ? 'Select line' : 'Select point', 1, 2);
          } else if (this.selectedElements.length === 2) {
            let pt: any = null;
            let line: any = null;
            for (const el of this.selectedElements) {
              if (el.elType === 'point') pt = el;
              else if (el.elType === 'line' || el.elType === 'segment') line = el;
            }

            if (pt && line) {
              if (this.activeTool === 'perpendicular') {
                this.createPerpendicular(line, pt);
              } else {
                this.createParallel(line, pt);
              }
              this.finishToolAction();
            } else {
              this.clearToolSelection();
            }
          }
        } else {
          const pt = this.createPoint(x, y);
          this.selectedElements.push(pt);
          this.highlightElement(pt, true);
          this.board.fullUpdate();
          this.callbacks.onToolStep?.('Select line', 1, 2);
        }
        break;
      }

      case 'perpendicular_bisector': {
        if (clickedObject && clickedObject.elType === 'segment') {
          this.createPerpendicularBisectorOfSegment(clickedObject);
          this.finishToolAction();
        } else {
          const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
          this.selectedElements.push(pt);
          this.highlightElement(pt, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select 2nd point', 1, 2);
          } else if (this.selectedElements.length === 2) {
            this.createPerpendicularBisector(this.selectedElements[0], this.selectedElements[1]);
            this.finishToolAction();
          }
        }
        break;
      }

      case 'angle_bisector': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
        this.selectedElements.push(pt);
        this.highlightElement(pt, true);
        this.board.fullUpdate();

        if (this.selectedElements.length < 3) {
          this.callbacks.onToolStep?.(`Point ${this.selectedElements.length + 1}/3`, this.selectedElements.length, 3);
        } else if (this.selectedElements.length === 3) {
          this.createAngleBisector(
            this.selectedElements[0],
            this.selectedElements[1],
            this.selectedElements[2]
          );
          this.finishToolAction();
        }
        break;
      }

      case 'tangent': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select circle or point', 1, 2);
          } else if (this.selectedElements.length === 2) {
            let pt: any = null;
            let circ: any = null;
            for (const el of this.selectedElements) {
              if (el.elType === 'point' || el.elType === 'glider') pt = el;
              else if (el.elType === 'circle') circ = el;
            }

            if (pt && circ) {
              this.createTangent(pt, circ);
              this.finishToolAction();
            } else {
              this.clearToolSelection();
            }
          }
        }
        break;
      }

      case 'polygon': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);

        if (this.polygonVertices.length >= 3 && pt === this.polygonVertices[0]) {
          this.createPolygon(this.polygonVertices);
          this.finishToolAction();
          return;
        }

        if (!this.polygonVertices.includes(pt)) {
          this.polygonVertices.push(pt);
          this.highlightElement(pt, true);
          this.board.fullUpdate();
          this.callbacks.onToolStep?.(
            `Point ${this.polygonVertices.length}. Click ${this.polygonVertices[0].name} to close`,
            this.polygonVertices.length,
            -1
          );
        }
        break;
      }

      case 'regular_polygon': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
        this.selectedElements.push(pt);
        this.highlightElement(pt, true);
        this.board.fullUpdate();

        if (this.selectedElements.length === 1) {
          this.callbacks.onToolStep?.('Select 2nd point', 1, 2);
        } else if (this.selectedElements.length === 2) {
          let sides = 5;
          if (this.callbacks.onRequestInput) {
            const input = await this.callbacks.onRequestInput('Regular Polygon', 'Vertices:', 5, 'number');
            if (input !== null && !isNaN(Number(input))) {
              sides = Math.max(3, Math.min(30, parseInt(String(input), 10)));
            } else {
              this.finishToolAction();
              return;
            }
          }
          this.createRegularPolygon(this.selectedElements[0], this.selectedElements[1], sides);
          this.finishToolAction();
        }
        break;
      }

      case 'circle_2p': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
        this.selectedElements.push(pt);
        this.highlightElement(pt, true);
        this.board.fullUpdate();

        if (this.selectedElements.length === 1) {
          this.callbacks.onToolStep?.('Select perimeter point', 1, 2);
        } else if (this.selectedElements.length === 2) {
          this.createCircle2P(this.selectedElements[0], this.selectedElements[1]);
          this.finishToolAction();
        }
        break;
      }

      case 'circle_3p': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
        this.selectedElements.push(pt);
        this.highlightElement(pt, true);
        this.board.fullUpdate();

        if (this.selectedElements.length < 3) {
          this.callbacks.onToolStep?.(`Point ${this.selectedElements.length + 1}/3`, this.selectedElements.length, 3);
        } else if (this.selectedElements.length === 3) {
          this.createCircumcircle(
            this.selectedElements[0],
            this.selectedElements[1],
            this.selectedElements[2]
          );
          this.finishToolAction();
        }
        break;
      }

      case 'angle': {
        const pt = clickedObject?.elType === 'point' ? clickedObject : this.createPoint(x, y);
        this.selectedElements.push(pt);
        this.highlightElement(pt, true);
        this.board.fullUpdate();

        if (this.selectedElements.length < 3) {
          this.callbacks.onToolStep?.(`Point ${this.selectedElements.length + 1}/3`, this.selectedElements.length, 3);
        } else if (this.selectedElements.length === 3) {
          this.createAngle(
            this.selectedElements[0],
            this.selectedElements[1],
            this.selectedElements[2]
          );
          this.finishToolAction();
        }
        break;
      }

      case 'reflect_line': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select mirror line', 1, 2);
          } else if (this.selectedElements.length === 2) {
            const obj = this.selectedElements[0];
            const line = this.selectedElements[1];
            if (line.elType === 'line' || line.elType === 'segment') {
              this.createReflectionLine(obj, line);
              this.finishToolAction();
            } else {
              this.selectedElements.pop();
            }
          }
        }
        break;
      }

      case 'rotate_point': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select center point', 1, 2);
          } else if (this.selectedElements.length === 2) {
            let angleDeg = 45;
            if (this.callbacks.onRequestInput) {
              const input = await this.callbacks.onRequestInput('Rotate', 'Angle (°):', 45, 'number');
              if (input !== null && !isNaN(Number(input))) {
                angleDeg = parseFloat(String(input));
              } else {
                this.finishToolAction();
                return;
              }
            }
            this.createRotation(this.selectedElements[0], this.selectedElements[1], angleDeg);
            this.finishToolAction();
          }
        }
        break;
      }

      case 'translate_vector': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select vector', 1, 2);
          } else if (this.selectedElements.length === 2) {
            const obj = this.selectedElements[0];
            const vec = this.selectedElements[1];
            this.createTranslation(obj, vec);
            this.finishToolAction();
          }
        }
        break;
      }

      case 'dilate_point': {
        if (clickedObject) {
          this.selectedElements.push(clickedObject);
          this.highlightElement(clickedObject, true);
          this.board.fullUpdate();

          if (this.selectedElements.length === 1) {
            this.callbacks.onToolStep?.('Select center point', 1, 2);
          } else if (this.selectedElements.length === 2) {
            let factor = 2;
            if (this.callbacks.onRequestInput) {
              const input = await this.callbacks.onRequestInput('Dilate', 'Scale factor:', 2, 'number');
              if (input !== null && !isNaN(Number(input))) {
                factor = parseFloat(String(input));
              } else {
                this.finishToolAction();
                return;
              }
            }
            this.createDilation(this.selectedElements[0], this.selectedElements[1], factor);
            this.finishToolAction();
          }
        }
        break;
      }

      case 'slider': {
        this.createSlider(x, y);
        this.finishToolAction();
        break;
      }

      case 'text_label': {
        let text = 'f(x)';
        if (this.callbacks.onRequestInput) {
          const input = await this.callbacks.onRequestInput('Text', 'Formula / text:', 'A = \\pi r^2', 'text');
          if (input !== null && String(input).trim().length > 0) {
            text = String(input);
          } else {
            return;
          }
        }
        this.createText(x, y, text);
        this.finishToolAction();
        break;
      }

      default:
        break;
    }
  }

  private finishToolAction(): void {
    this.clearToolSelection();
    this.syncElements();
    this.callbacks.onToolComplete?.();
  }

  /**
   * Snaps a numeric coordinate to clean special values (integers, half-integers, exact zero)
   * if it is close within the threshold (e.g. 0.18 units), preventing noise like (0.001, -0.001).
   */
  public snapToSpecialCoordinate(val: number, threshold = 0.18): number {
    // Check nearest integer (0, 1, 2, -1, -2, etc.)
    const intVal = Math.round(val);
    if (Math.abs(val - intVal) <= threshold) {
      return intVal === 0 ? 0 : intVal;
    }
    // Check nearest half-integer (0.5, 1.5, -0.5, etc.)
    const halfVal = Math.round(val * 2) / 2;
    if (Math.abs(val - halfVal) <= threshold * 0.55) {
      return halfVal === 0 ? 0 : halfVal;
    }
    // Filter out infinitesimal float noise
    if (Math.abs(val) < 1e-4) return 0;
    return Math.round(val * 1000) / 1000;
  }

  public createPoint(x: number, y: number, name?: string, attrs: Record<string, any> = {}): any {
    if (!this.board) throw new Error('Board not initialized');
    const ptName = name || this.getNextPointName();
    const sx = this.snapToSpecialCoordinate(x);
    const sy = this.snapToSpecialCoordinate(y);
    const pt = this.board.create('point', [sx, sy], {
      name: ptName,
      size: 4,
      strokeColor: '#1e3a8a',
      fillColor: '#3b82f6',
      highlightStrokeColor: '#172554',
      highlightFillColor: '#93c5fd',
      withLabel: true,
      label: {
        autoPosition: true,
        autoPositionMinDistance: 12,
        autoPositionMaxDistance: 36,
        offset: [8, 8],
        fontSize: 13,
        color: '#0f172a',
      },
      ...attrs,
    });
    (pt as any)._userCreated = true;

    // Magnetic snapping on drag release
    if (typeof (pt as any).on === 'function') {
      (pt as any).on('up', () => {
        const p = pt as any;
        if (typeof p.X === 'function' && typeof p.Y === 'function') {
          const curX = p.X();
          const curY = p.Y();
          const snapX = this.snapToSpecialCoordinate(curX);
          const snapY = this.snapToSpecialCoordinate(curY);
          if (Math.abs(curX - snapX) > 1e-4 || Math.abs(curY - snapY) > 1e-4) {
            p.setPosition(JXG.COORDS_BY_USER, [snapX, snapY]);
            this.board?.update();
          }
        }
        this.syncElements();
      });
    }

    this.syncElements();
    return pt;
  }

  public createGlider(x: number, y: number, object: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const ptName = name || this.getNextPointName();
    const glider = this.board.create('glider', [x, y, object], {
      name: ptName,
      size: 4,
      strokeColor: '#065f46',
      fillColor: '#34d399',
      highlightStrokeColor: '#064e3b',
      highlightFillColor: '#a7f3d0',
      withLabel: true,
      label: {
        autoPosition: true,
        autoPositionMinDistance: 12,
        autoPositionMaxDistance: 36,
        offset: [8, 8],
        fontSize: 13,
        color: '#064e3b',
      },
    });
    (glider as any)._userCreated = true;
    this.syncElements();
    return glider;
  }

  public createSegment(p1: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const segName = name || this.getNextLineName();
    const seg = this.board.create('segment', [p1, p2], {
      name: segName,
      strokeColor: '#0f172a',
      strokeWidth: 2,
      withLabel: false,
    });
    (seg as any)._userCreated = true;
    this.syncElements();
    return seg;
  }

  public createLine(p1: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const lineName = name || this.getNextLineName();
    const line = this.board.create('line', [p1, p2], {
      name: lineName,
      strokeColor: '#0f172a',
      strokeWidth: 2,
      withLabel: true,
      label: {
        autoPosition: true,
        autoPositionMinDistance: 10,
        autoPositionMaxDistance: 30,
      },
    });
    (line as any)._userCreated = true;
    this.syncElements();
    return line;
  }

  public createLineFromEquation(a: number, b: number, c: number, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const lineName = name || this.getNextLineName();
    const line = this.board.create('line', [c, a, b], {
      name: lineName,
      strokeColor: '#0f172a',
      strokeWidth: 2,
      withLabel: true,
      label: {
        autoPosition: true,
        autoPositionMinDistance: 10,
        autoPositionMaxDistance: 30,
      },
    });
    (line as any)._userCreated = true;
    this.syncElements();
    return line;
  }

  public createFunctionGraph(fn: (x: number) => number, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const fName = name || this.getNextLineName();
    const graph = this.board.create('functiongraph', [fn], {
      name: fName,
      strokeColor: '#2563eb',
      strokeWidth: 2,
      withLabel: true,
    });
    (graph as any)._userCreated = true;
    this.syncElements();
    return graph;
  }

  public createRay(p1: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const rayName = name || this.getNextLineName();
    const ray = this.board.create('ray', [p1, p2], {
      name: rayName,
      strokeColor: '#0f172a',
      strokeWidth: 2,
      withLabel: false,
    });
    (ray as any)._userCreated = true;
    this.syncElements();
    return ray;
  }

  public createVector(p1: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const vecName = name || `u_{${++this.lineIndex}}`;
    const vec = this.board.create('arrow', [p1, p2], {
      name: vecName,
      strokeColor: '#4f46e5',
      strokeWidth: 2.5,
      withLabel: true,
      label: {
        autoPosition: true,
      },
    });
    (vec as any)._userCreated = true;
    this.syncElements();
    return vec;
  }

  public createIntersection(el1: any, el2: any, name?: string, indexOrExclude?: number | any): any {
    if (!this.board) throw new Error('Board not initialized');
    const ptName = name || this.getNextPointName();
    let inter: any;
    if (indexOrExclude && typeof indexOrExclude === 'object' && indexOrExclude.elType === 'point') {
      inter = this.board.create('otherintersection', [el1, el2, indexOrExclude], {
        name: ptName,
        size: 4,
        strokeColor: '#991b1b',
        fillColor: '#f87171',
        withLabel: true,
        label: {
          autoPosition: true,
          autoPositionMinDistance: 12,
          autoPositionMaxDistance: 36,
          offset: [8, 8],
        },
      });
    } else {
      const idx = typeof indexOrExclude === 'number' ? indexOrExclude : 0;
      inter = this.board.create('intersection', [el1, el2, idx], {
        name: ptName,
        size: 4,
        strokeColor: '#991b1b',
        fillColor: '#f87171',
        withLabel: true,
        label: {
          autoPosition: true,
          autoPositionMinDistance: 12,
          autoPositionMaxDistance: 36,
          offset: [8, 8],
        },
      });
    }
    (inter as any)._userCreated = true;
    this.syncElements();
    return inter;
  }

  public createOtherIntersection(el1: any, el2: any, excludePoint: any, name?: string): any {
    return this.createIntersection(el1, el2, name, excludePoint);
  }


  public createMidpoint(p1: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const midName = name || `M_{${p1.name}${p2.name}}`;
    const mid = this.board.create('midpoint', [p1, p2], {
      name: midName,
      size: 3.5,
      strokeColor: '#065f46',
      fillColor: '#34d399',
      withLabel: true,
      label: {
        autoPosition: true,
        autoPositionMinDistance: 12,
        autoPositionMaxDistance: 36,
        offset: [8, 8],
      },
    });
    (mid as any)._userCreated = true;
    this.syncElements();
    return mid;
  }

  public createMidpointOfObject(obj: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const midName = name || `M_{${obj.name}}`;
    const mid = this.board.create('midpoint', [obj], {
      name: midName,
      size: 3.5,
      strokeColor: '#065f46',
      fillColor: '#34d399',
      withLabel: true,
      label: {
        autoPosition: true,
        autoPositionMinDistance: 12,
        autoPositionMaxDistance: 36,
        offset: [8, 8],
      },
    });
    (mid as any)._userCreated = true;
    this.syncElements();
    return mid;
  }

  public createPerpendicular(line: any, pt: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const perpName = name || this.getNextLineName();
    const perp = this.board.create('perpendicular', [line, pt], {
      name: perpName,
      strokeColor: '#64748b',
      strokeWidth: 1.5,
      dash: 2,
      withLabel: false,
    });
    (perp as any)._userCreated = true;
    this.syncElements();
    return perp;
  }

  public createParallel(line: any, pt: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const parName = name || this.getNextLineName();
    const par = this.board.create('parallel', [line, pt], {
      name: parName,
      strokeColor: '#64748b',
      strokeWidth: 1.5,
      dash: 2,
      withLabel: false,
    });
    (par as any)._userCreated = true;
    this.syncElements();
    return par;
  }

  public createPerpendicularBisector(p1: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const pbName = name || this.getNextLineName();
    const pb = this.board.create('perpendicularbisector', [p1, p2], {
      name: pbName,
      strokeColor: '#64748b',
      strokeWidth: 1.5,
      dash: 2,
      withLabel: false,
    });
    (pb as any)._userCreated = true;
    this.syncElements();
    return pb;
  }

  public createPerpendicularBisectorOfSegment(seg: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const pbName = name || this.getNextLineName();
    const pb = this.board.create('perpendicularbisector', [seg], {
      name: pbName,
      strokeColor: '#64748b',
      strokeWidth: 1.5,
      dash: 2,
      withLabel: false,
    });
    (pb as any)._userCreated = true;
    this.syncElements();
    return pb;
  }

  public createAngleBisector(p1: any, vertex: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const bisName = name || this.getNextLineName();
    const bis = this.board.create('bisector', [p1, vertex, p2], {
      name: bisName,
      strokeColor: '#64748b',
      strokeWidth: 1.5,
      dash: 2,
      withLabel: false,
    });
    (bis as any)._userCreated = true;
    this.syncElements();
    return bis;
  }

  public createTangent(pt: any, circ: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const tanName = name || this.getNextLineName();
    const tan = this.board.create('tangent', [pt, circ], {
      name: tanName,
      strokeColor: '#64748b',
      strokeWidth: 1.5,
      dash: 1,
      withLabel: false,
    });
    (tan as any)._userCreated = true;
    this.syncElements();
    return tan;
  }

  public createPolygon(vertices: any[], name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const polyName = name || `poly${++this.polyIndex}`;
    const poly = this.board.create('polygon', vertices, {
      name: polyName,
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      borders: {
        strokeColor: '#1d4ed8',
        strokeWidth: 2,
      },
      withLabel: true,
    });
    (poly as any)._userCreated = true;
    this.syncElements();
    return poly;
  }

  public createRegularPolygon(p1: any, p2: any, sides: number, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const polyName = name || `poly${++this.polyIndex}`;
    const poly = this.board.create('regularpolygon', [p1, p2, sides], {
      name: polyName,
      fillColor: '#8b5cf6',
      fillOpacity: 0.15,
      borders: {
        strokeColor: '#6d28d9',
        strokeWidth: 2,
      },
      withLabel: true,
    });
    (poly as any)._userCreated = true;
    this.syncElements();
    return poly;
  }

  public createCircle2P(center: any, point: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const circName = name || this.getNextCircleName();
    const circ = this.board.create('circle', [center, point], {
      name: circName,
      strokeColor: '#2563eb',
      strokeWidth: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      withLabel: true,
    });
    (circ as any)._userCreated = true;
    this.syncElements();
    return circ;
  }

  public createCircleRadius(center: any, radius: number, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const circName = name || this.getNextCircleName();
    const circ = this.board.create('circle', [center, radius], {
      name: circName,
      strokeColor: '#2563eb',
      strokeWidth: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      withLabel: true,
    });
    (circ as any)._userCreated = true;
    this.syncElements();
    return circ;
  }

  public createCircumcircle(p1: any, p2: any, p3: any, name?: string, centerName?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const circName = name || this.getNextCircleName();
    const circ = this.board.create('circumcircle', [p1, p2, p3], {
      name: circName,
      strokeColor: '#2563eb',
      strokeWidth: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      withLabel: true,
    });
    if (centerName && circ.center) {
      circ.center.setAttribute({
        name: centerName,
        withLabel: true,
        visible: true,
      });
      (circ.center as any)._userCreated = true;
    }
    (circ as any)._userCreated = true;
    this.syncElements();
    return circ;
  }

  public createIncircle(p1: any, p2: any, p3: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const circName = name || this.getNextCircleName();
    const circ = this.board.create('incircle', [p1, p2, p3], {
      name: circName,
      strokeColor: '#059669',
      strokeWidth: 2,
      fillColor: '#10b981',
      fillOpacity: 0.05,
      withLabel: true,
    });
    (circ as any)._userCreated = true;
    this.syncElements();
    return circ;
  }

  public createAngle(p1: any, vertex: any, p2: any, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const greekLetters = ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\phi'];
    const angName = name || greekLetters[this.angleIndex++ % greekLetters.length];
    const ang = this.board.create('angle', [p1, vertex, p2], {
      name: angName,
      type: 'sector',
      radius: 1.2,
      fillColor: '#f59e0b',
      fillOpacity: 0.25,
      strokeColor: '#d97706',
      withLabel: true,
    });
    (ang as any)._userCreated = true;
    this.syncElements();
    return ang;
  }

  public createSlider(x: number, y: number, name?: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const sName = name || `s_{${++this.lineIndex}}`;
    const slider = this.board.create('slider', [[x, y], [x + 3, y], [0, 5, 10]], {
      name: sName,
      snapWidth: 0.1,
    });
    (slider as any)._userCreated = true;
    this.syncElements();
    return slider;
  }

  public createText(x: number, y: number, text: string): any {
    if (!this.board) throw new Error('Board not initialized');
    const txt = this.board.create('text', [x, y, text], {
      fontSize: 14,
      strokeColor: '#1e293b',
    });
    (txt as any)._userCreated = true;
    this.syncElements();
    return txt;
  }

  public createReflectionLine(obj: any, line: any): any {
    if (!this.board) throw new Error('Board not initialized');
    const transform = this.board.create('transform', [line], { type: 'reflect' });
    const reflected = this.board.create(obj.elType, [obj, transform], {
      name: `${obj.name}'`,
      strokeColor: '#6366f1',
      strokeWidth: 2,
    });
    this.syncElements();
    return reflected;
  }

  public createRotation(obj: any, center: any, angleDeg: number): any {
    if (!this.board) throw new Error('Board not initialized');
    const angleRad = (angleDeg * Math.PI) / 180;
    const transform = this.board.create('transform', [angleRad, center], { type: 'rotate' });
    const rotated = this.board.create(obj.elType, [obj, transform], {
      name: `${obj.name}'`,
      strokeColor: '#8b5cf6',
      strokeWidth: 2,
    });
    this.syncElements();
    return rotated;
  }

  public createTranslation(obj: any, vec: any): any {
    if (!this.board) throw new Error('Board not initialized');
    const transform = this.board.create('transform', [vec], { type: 'translate' });
    const translated = this.board.create(obj.elType, [obj, transform], {
      name: `${obj.name}'`,
      strokeColor: '#8b5cf6',
      strokeWidth: 2,
    });
    this.syncElements();
    return translated;
  }

  public createDilation(obj: any, center: any, factor: number): any {
    if (!this.board) throw new Error('Board not initialized');
    const transform = this.board.create('transform', [factor, factor, center], { type: 'scale' });
    const dilated = this.board.create(obj.elType, [obj, transform], {
      name: `${obj.name}'`,
      strokeColor: '#8b5cf6',
      strokeWidth: 2,
    });
    this.syncElements();
    return dilated;
  }

  // --- Object Modification & Selection ---

  public selectObjectForInspector(element: any | null): void {
    if (this.activeSelectedElement && this.activeSelectedElement !== element) {
      this.highlightElement(this.activeSelectedElement, false);
    }

    this.activeSelectedElement = element;
    if (element) {
      this.highlightElement(element, true);
      if (this.board) this.board.fullUpdate();
      const state = this.formatElementState(element);
      this.callbacks.onSelectedElementChange?.(state);
    } else {
      if (this.board) this.board.fullUpdate();
      this.callbacks.onSelectedElementChange?.(null);
    }
  }

  public updateElementProperties(id: string, updates: {
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    size?: number;
    name?: string;
    visible?: boolean;
    fixed?: boolean;
    withLabel?: boolean;
    coords?: [number, number];
  }): void {
    if (!this.board) return;
    const el = (this.board.objects as any)[id];
    if (!el) return;

    if (updates.color !== undefined) {
      el.setAttribute({ strokeColor: updates.color });
    }
    if (updates.fillColor !== undefined) {
      el.setAttribute({ fillColor: updates.fillColor });
    }
    if (updates.fillOpacity !== undefined) {
      el.setAttribute({ fillOpacity: updates.fillOpacity });
    }
    if (updates.strokeWidth !== undefined) {
      el.setAttribute({ strokeWidth: updates.strokeWidth });
    }
    if (updates.size !== undefined) {
      el.setAttribute({ size: updates.size });
    }
    if (updates.name !== undefined) {
      el.setAttribute({ name: updates.name });
    }
    if (updates.visible !== undefined) {
      el.setAttribute({ visible: updates.visible });
    }
    if (updates.fixed !== undefined) {
      el.setAttribute({ fixed: updates.fixed });
    }
    if (updates.withLabel !== undefined) {
      el.setAttribute({ withLabel: updates.withLabel });
    }
    if (updates.coords && el.elType === 'point') {
      el.moveTo(updates.coords, 0);
    }

    this.board.fullUpdate();
    this.syncElements();
  }

  public deleteElement(element: any): void {
    if (!this.board) return;
    const el = typeof element === 'string' ? (this.board.objects as any)[element] : element;
    if (!el) return;

    if (this.activeSelectedElement === el) {
      this.selectObjectForInspector(null);
    }

    this.board.removeObject(el);
    this.board.fullUpdate();
    this.syncElements();
  }

  public clearAll(): void {
    if (!this.board) return;
    const userObjects = Object.values(this.board.objects).filter(
      (obj: any) => !this.isSystemObject(obj)
    );

    this.board.suspendUpdate();
    userObjects.forEach((obj: any) => {
      try {
        this.board?.removeObject(obj);
      } catch {
        // ignore
      }
    });
    this.board.unsuspendUpdate();
    this.hideInternalSystemObjects();
    this.board.fullUpdate();

    this.pointIndex = 0;
    this.lineIndex = 0;
    this.circleIndex = 0;
    this.polyIndex = 0;
    this.angleIndex = 0;
    this.clearToolSelection();
    this.selectObjectForInspector(null);
    this.syncElements();
  }

  public isSystemObject(obj: any): boolean {
    if (!obj) return true;
    if (obj._userCreated) return false;

    // Direct system types
    if (
      obj.elType === 'axis' ||
      obj.elType === 'ticks' ||
      obj.elType === 'grid' ||
      obj.visProp?.isLabel ||
      obj.type === 4 || // OBJECT_TYPE_AXISPOINT
      obj.dump === false
    ) {
      return true;
    }

    // Default axes elements
    if ((this.board as any)?.defaultAxes) {
      const dx = (this.board as any).defaultAxes.x;
      const dy = (this.board as any).defaultAxes.y;
      if (
        obj === dx ||
        obj === dy ||
        obj === dx?.point1 ||
        obj === dx?.point2 ||
        obj === dy?.point1 ||
        obj === dy?.point2 ||
        obj === dx?.defaultTicks ||
        obj === dy?.defaultTicks
      ) {
        return true;
      }
    }

    // Internal naming patterns (ta, tb, tc, td, te, tf, tg, etc.)
    const name = obj.name || '';
    if (/^t[a-z0-9_]*$/i.test(name)) {
      return true;
    }

    // Default points at (0, 0), (1, 0), (0, 1) not created by user
    if (obj.elType === 'point' && obj.isDraggable === false) {
      const x = typeof obj.X === 'function' ? obj.X() : obj.coords?.usrCoords?.[1];
      const y = typeof obj.Y === 'function' ? obj.Y() : obj.coords?.usrCoords?.[2];
      if (
        (x === 0 && y === 0) ||
        (x === 1 && y === 0) ||
        (x === 0 && y === 1)
      ) {
        return true;
      }
    }

    return false;
  }

  public hideInternalSystemObjects(): void {
    if (!this.board) return;

    if ((this.board as any).defaultAxes) {
      const axes = (this.board as any).defaultAxes;
      ['x', 'y'].forEach((k) => {
        const ax = axes[k];
        if (ax) {
          if (ax.point1) {
            ax.point1.setAttribute({ visible: false, withLabel: false });
            if (ax.point1.label) ax.point1.label.setAttribute({ visible: false });
          }
          if (ax.point2) {
            ax.point2.setAttribute({ visible: false, withLabel: false });
            if (ax.point2.label) ax.point2.label.setAttribute({ visible: false });
          }
        }
      });
    }

    for (const obj of Object.values(this.board.objects) as any[]) {
      if (this.isSystemObject(obj)) {
        if (obj.elType === 'point' || obj.type === 4 || /^t[a-z0-9_]*$/i.test(obj.name || '')) {
          try {
            obj.setAttribute({ visible: false, withLabel: false });
            if (obj.label) obj.label.setAttribute({ visible: false });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  public autoArrangeLabels(): void {
    if (!this.board) return;
    const userPoints = (Object.values(this.board.objects) as any[]).filter(
      (obj) => (obj.elType === 'point' || obj.elType === 'glider') && !this.isSystemObject(obj)
    );

    // Call JSXGraph built-in setAutoPosition on each point label
    for (const pt of userPoints) {
      if (pt.label && typeof pt.label.setAutoPosition === 'function') {
        try {
          pt.label.setAutoPosition();
        } catch {
          // ignore
        }
      }
    }

    // Secondary repulsion check for close point clusters to prevent overlap
    for (let i = 0; i < userPoints.length; i++) {
      const p1 = userPoints[i];
      const x1 = p1.coords?.scrCoords?.[1] || 0;
      const y1 = p1.coords?.scrCoords?.[2] || 0;

      const neighbors: any[] = [];
      for (let j = 0; j < userPoints.length; j++) {
        if (i === j) continue;
        const p2 = userPoints[j];
        const x2 = p2.coords?.scrCoords?.[1] || 0;
        const y2 = p2.coords?.scrCoords?.[2] || 0;
        const dist = Math.hypot(x1 - x2, y1 - y2);
        if (dist < 40) {
          neighbors.push(p2);
        }
      }

      if (neighbors.length > 0) {
        let avgDx = 0;
        let avgDy = 0;
        for (const n of neighbors) {
          const nx = n.coords?.scrCoords?.[1] || 0;
          const ny = n.coords?.scrCoords?.[2] || 0;
          avgDx += (x1 - nx);
          avgDy += (y1 - ny);
        }
        if (avgDx === 0 && avgDy === 0) {
          avgDx = Math.cos((i * 2 * Math.PI) / userPoints.length);
          avgDy = Math.sin((i * 2 * Math.PI) / userPoints.length);
        }
        const len = Math.hypot(avgDx, avgDy) || 1;
        const offsetDist = 18;
        const offX = Math.round((avgDx / len) * offsetDist);
        const offY = Math.round((avgDy / len) * offsetDist);
        p1.setAttribute({ label: { offset: [offX, -offY] } });
      }
    }
  }

  // --- Element Formatter & Sync (Minimalist: math only, no wordy boilerplate) ---

  public syncElements(): void {
    if (!this.board) return;
    const elements: GeometricElementState[] = [];

    const objects = Object.values(this.board.objects) as any[];
    for (const obj of objects) {
      if (this.isSystemObject(obj)) {
        continue;
      }

      elements.push(this.formatElementState(obj));
    }

    this.autoArrangeLabels();
    this.callbacks.onElementsChange?.(elements);
  }

  public formatElementState(el: any): GeometricElementState {
    let definition = '';
    let valueString = '';
    let latex = '';
    let coords: [number, number] | undefined;
    const isFree = el.parents ? el.parents.length === 0 : true;

    switch (el.elType) {
      case 'point':
      case 'glider': {
        const x = typeof el.X === 'function' ? el.X() : 0;
        const y = typeof el.Y === 'function' ? el.Y() : 0;
        coords = [x, y];
        valueString = `(${x.toFixed(2)}, ${y.toFixed(2)})`;
        latex = `${el.name} = (${x.toFixed(2)}, ${y.toFixed(2)})`;
        definition = `${x.toFixed(2)}, ${y.toFixed(2)}`;
        break;
      }
      case 'segment': {
        const len = typeof el.L === 'function' ? el.L() : 0;
        valueString = len.toFixed(2);
        latex = `${el.name} = ${len.toFixed(2)}`;
        definition = `${len.toFixed(2)}`;
        break;
      }
      case 'line': {
        const std = typeof el.stdform === 'function' ? el.stdform() : (el.stdform || [0, 0, 0]);
        const c = std[0] || 0;
        const a = std[1] || 0;
        const b = std[2] || 0;
        valueString = `${a.toFixed(1)}x + ${b.toFixed(1)}y + ${c.toFixed(1)} = 0`;
        latex = `${el.name}: ${a.toFixed(1)}x + ${b.toFixed(1)}y + ${c.toFixed(1)} = 0`;
        definition = valueString;
        break;
      }
      case 'circle': {
        const r = typeof el.Radius === 'function' ? el.Radius() : 0;
        const cx = el.center && typeof el.center.X === 'function' ? el.center.X() : 0;
        const cy = el.center && typeof el.center.Y === 'function' ? el.center.Y() : 0;
        valueString = `r = ${r.toFixed(2)}`;
        latex = `${el.name}: (x - ${cx.toFixed(1)})^2 + (y - ${cy.toFixed(1)})^2 = ${(r * r).toFixed(1)}`;
        definition = `r = ${r.toFixed(2)}`;
        break;
      }
      case 'polygon': {
        const area = typeof el.Area === 'function' ? el.Area() : 0;
        valueString = `Area = ${area.toFixed(2)}`;
        latex = `\\text{Area} = ${area.toFixed(2)}`;
        definition = `Area = ${area.toFixed(2)}`;
        break;
      }
      case 'angle': {
        const val = typeof el.Value === 'function' ? (el.Value() * 180) / Math.PI : 0;
        valueString = `${val.toFixed(1)}°`;
        latex = `${el.name} = ${val.toFixed(1)}^\\circ`;
        definition = `${val.toFixed(1)}°`;
        break;
      }
      default:
        valueString = el.name;
        definition = el.elType;
        latex = el.name;
    }

    return {
      id: el.id,
      name: el.name,
      type: el.elType as any,
      parents: el.parents ? el.parents.map((p: any) => p?.id || String(p)) : [],
      definition,
      valueString,
      latex,
      visible: el.visProp?.visible !== false,
      fixed: el.visProp?.fixed === true,
      color: String(el.visProp?.strokecolor || '#1e3a8a'),
      fillColor: el.visProp?.fillcolor ? String(el.visProp.fillcolor) : undefined,
      fillOpacity: typeof el.visProp?.fillopacity === 'number' ? el.visProp.fillopacity : undefined,
      strokeWidth: typeof el.visProp?.strokewidth === 'number' ? el.visProp.strokewidth : 2,
      size: typeof el.visProp?.size === 'number' ? el.visProp.size : undefined,
      withLabel: el.visProp?.withlabel !== false,
      coords,
      isFree,
    };
  }

  // --- Auto-Naming Helpers ---

  private getNextPointName(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const existing = new Set(Object.values(this.board?.objects || {}).map((o: any) => o.name));

    for (let cycle = 0; cycle < 10; cycle++) {
      for (let i = 0; i < letters.length; i++) {
        const candidate = cycle === 0 ? letters[i] : `${letters[i]}_{${cycle}}`;
        if (!existing.has(candidate)) {
          return candidate;
        }
      }
    }
    return `P_{${++this.pointIndex}}`;
  }

  private getNextLineName(): string {
    const letters = 'fghijklmnopqrstuvwxyz';
    const existing = new Set(Object.values(this.board?.objects || {}).map((o: any) => o.name));

    for (let cycle = 0; cycle < 10; cycle++) {
      for (let i = 0; i < letters.length; i++) {
        const candidate = cycle === 0 ? letters[i] : `${letters[i]}_{${cycle}}`;
        if (!existing.has(candidate)) {
          return candidate;
        }
      }
    }
    return `l_{${++this.lineIndex}}`;
  }

  private getNextCircleName(): string {
    const letters = ['c', 'd', 'e', 'k', 'c_1', 'c_2', 'c_3'];
    const existing = new Set(Object.values(this.board?.objects || {}).map((o: any) => o.name));

    for (const name of letters) {
      if (!existing.has(name)) return name;
    }
    return `c_{${++this.circleIndex}}`;
  }
}
