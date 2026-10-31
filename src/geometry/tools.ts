import { ToolDefinition, ToolCategory } from '../types/geometry';

export const TOOL_CATEGORIES: { id: ToolCategory; label: string; icon: string }[] = [
  { id: 'select', label: 'Move', icon: 'MousePointer2' },
  { id: 'points', label: 'Point', icon: 'CircleDot' },
  { id: 'lines', label: 'Line', icon: 'Minus' },
  { id: 'special_lines', label: 'Construct', icon: 'CornerDownRight' },
  { id: 'polygons', label: 'Polygon', icon: 'Polygon' },
  { id: 'circles', label: 'Circle', icon: 'Circle' },
  { id: 'measurements', label: 'Angle', icon: 'PieChart' },
  { id: 'transformations', label: 'Transform', icon: 'FlipHorizontal' },
  { id: 'others', label: 'More', icon: 'SlidersHorizontal' },
];

export const TOOLS: ToolDefinition[] = [
  // Move / Select
  {
    id: 'select',
    category: 'select',
    name: 'Move',
    description: 'Drag objects or canvas',
    icon: 'MousePointer2',
    instruction: '',
    requiredClicks: 0,
  },

  // Points
  {
    id: 'point',
    category: 'points',
    name: 'Point',
    description: 'New point or point on curve',
    icon: 'CircleDot',
    instruction: 'Click canvas or curve',
    requiredClicks: 1,
  },
  {
    id: 'intersection',
    category: 'points',
    name: 'Intersect',
    description: 'Intersection of two curves',
    icon: 'Crosshair',
    instruction: 'Select two objects',
    requiredClicks: 2,
  },
  {
    id: 'midpoint',
    category: 'points',
    name: 'Midpoint',
    description: 'Midpoint of 2 points or segment',
    icon: 'BetweenHorizontalStart',
    instruction: 'Select two points or segment',
    requiredClicks: 2,
  },

  // Lines
  {
    id: 'segment',
    category: 'lines',
    name: 'Segment',
    description: 'Segment between 2 points',
    icon: 'Minus',
    instruction: 'Select 2 points',
    requiredClicks: 2,
  },
  {
    id: 'line',
    category: 'lines',
    name: 'Line',
    description: 'Line through 2 points',
    icon: 'MoveHorizontal',
    instruction: 'Select 2 points',
    requiredClicks: 2,
  },
  {
    id: 'ray',
    category: 'lines',
    name: 'Ray',
    description: 'Ray through 2 points',
    icon: 'ArrowRight',
    instruction: 'Select origin, then point',
    requiredClicks: 2,
  },
  {
    id: 'vector',
    category: 'lines',
    name: 'Vector',
    description: 'Vector from point to point',
    icon: 'ArrowUpRight',
    instruction: 'Select start point, then endpoint',
    requiredClicks: 2,
  },

  // Special Lines
  {
    id: 'perpendicular',
    category: 'special_lines',
    name: 'Perpendicular',
    description: 'Perpendicular line through point',
    icon: 'CornerDownRight',
    instruction: 'Select point and line',
    requiredClicks: 2,
  },
  {
    id: 'parallel',
    category: 'special_lines',
    name: 'Parallel',
    description: 'Parallel line through point',
    icon: 'AlignJustify',
    instruction: 'Select point and line',
    requiredClicks: 2,
  },
  {
    id: 'perpendicular_bisector',
    category: 'special_lines',
    name: 'Bisector (Line)',
    description: 'Perpendicular bisector',
    icon: 'Split',
    instruction: 'Select 2 points or segment',
    requiredClicks: 2,
  },
  {
    id: 'angle_bisector',
    category: 'special_lines',
    name: 'Bisector (Angle)',
    description: 'Angle bisector',
    icon: 'GitFork',
    instruction: 'Select 3 points',
    requiredClicks: 3,
  },
  {
    id: 'tangent',
    category: 'special_lines',
    name: 'Tangent',
    description: 'Tangent lines to circle',
    icon: 'CircleSlash',
    instruction: 'Select point and circle',
    requiredClicks: 2,
  },

  // Polygons
  {
    id: 'polygon',
    category: 'polygons',
    name: 'Polygon',
    description: 'Polygon vertices',
    icon: 'Polygon',
    instruction: 'Click vertices, click 1st to close',
    requiredClicks: -1,
  },
  {
    id: 'regular_polygon',
    category: 'polygons',
    name: 'Regular Polygon',
    description: 'Equal sides polygon',
    icon: 'Hexagon',
    instruction: 'Select 2 points, enter vertices',
    requiredClicks: 2,
  },

  // Circles
  {
    id: 'circle_2p',
    category: 'circles',
    name: 'Circle',
    description: 'Center through point',
    icon: 'Circle',
    instruction: 'Select center, then point',
    requiredClicks: 2,
  },
  {
    id: 'circle_3p',
    category: 'circles',
    name: '3-Point Circle',
    description: 'Circle through 3 points',
    icon: 'Target',
    instruction: 'Select 3 points',
    requiredClicks: 3,
  },

  // Measurements
  {
    id: 'angle',
    category: 'measurements',
    name: 'Angle',
    description: 'Angle between 3 points',
    icon: 'PieChart',
    instruction: 'Select 3 points',
    requiredClicks: 3,
  },

  // Transformations
  {
    id: 'reflect_line',
    category: 'transformations',
    name: 'Reflect',
    description: 'Reflect object across line',
    icon: 'FlipHorizontal',
    instruction: 'Select object, then line',
    requiredClicks: 2,
  },
  {
    id: 'rotate_point',
    category: 'transformations',
    name: 'Rotate',
    description: 'Rotate around point by angle',
    icon: 'RotateCcw',
    instruction: 'Select object, center, enter angle',
    requiredClicks: 2,
  },
  {
    id: 'translate_vector',
    category: 'transformations',
    name: 'Translate',
    description: 'Translate object by vector',
    icon: 'Move',
    instruction: 'Select object, then vector',
    requiredClicks: 2,
  },
  {
    id: 'dilate_point',
    category: 'transformations',
    name: 'Dilate',
    description: 'Scale from center point',
    icon: 'Maximize2',
    instruction: 'Select object, center, enter factor',
    requiredClicks: 2,
  },

  // Controls & Labels
  {
    id: 'slider',
    category: 'others',
    name: 'Slider',
    description: 'Numeric slider',
    icon: 'SlidersHorizontal',
    instruction: 'Click canvas to place',
    requiredClicks: 1,
  },
  {
    id: 'text_label',
    category: 'others',
    name: 'Text',
    description: 'Formula or text',
    icon: 'Type',
    instruction: 'Click canvas to place text',
    requiredClicks: 1,
  },
];

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}
