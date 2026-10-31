export type ToolType =
  // Navigation & Selection
  | 'select'
  // Points
  | 'point'
  | 'intersection'
  | 'midpoint'
  // Lines
  | 'segment'
  | 'line'
  | 'ray'
  | 'vector'
  | 'perpendicular'
  | 'parallel'
  | 'perpendicular_bisector'
  | 'angle_bisector'
  | 'tangent'
  // Polygons
  | 'polygon'
  | 'regular_polygon'
  // Circles
  | 'circle_2p'
  | 'circle_3p'
  // Angles & Measurement
  | 'angle'
  // Transformations
  | 'reflect_line'
  | 'rotate_point'
  | 'translate_vector'
  | 'dilate_point'
  // Controls & Labels
  | 'slider'
  | 'text_label';

export type ToolCategory =
  | 'select'
  | 'points'
  | 'lines'
  | 'special_lines'
  | 'polygons'
  | 'circles'
  | 'measurements'
  | 'transformations'
  | 'others';

export interface ToolDefinition {
  id: ToolType;
  category: ToolCategory;
  name: string;
  description: string;
  icon: string;
  instruction: string;
  requiredClicks: number;
}

export type GeometricElementType =
  | 'point'
  | 'glider'
  | 'line'
  | 'segment'
  | 'ray'
  | 'vector'
  | 'circle'
  | 'polygon'
  | 'angle'
  | 'text'
  | 'slider'
  | 'functiongraph'
  | 'transformation';

export interface GeometricElementState {
  id: string;
  name: string;
  type: GeometricElementType;
  subType?: string;
  parents: string[];
  definition: string;
  valueString: string;
  latex?: string;
  visible: boolean;
  fixed: boolean;
  color: string;
  fillColor?: string;
  fillOpacity?: number;
  strokeWidth: number;
  size?: number;
  withLabel: boolean;
  label?: string;
  coords?: [number, number];
  isFree?: boolean;
}

export interface BoardSettings {
  showAxes: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSnapSize: number;
  boundingBox: [number, number, number, number];
  theme: 'light' | 'dark';
}

export interface ConstructionStep {
  id: string;
  action: string;
  type: string;
  name: string;
  parents: any[];
  attributes?: Record<string, any>;
  data?: any;
}

export interface ProjectData {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  settings: BoardSettings;
  steps: ConstructionStep[];
  serializedElements?: any[];
  previewSvg?: string;
}

export interface AIConstructionProposal {
  id: string;
  summary: string;
  explanation: string;
  questions?: string[];
  requiresConfirmation: boolean;
  steps: {
    description: string;
    latex?: string;
    action: string;
    type: string;
    name?: string;
    args: any[];
    attrs?: Record<string, any>;
  }[];
}
