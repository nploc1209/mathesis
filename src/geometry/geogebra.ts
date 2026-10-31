import JSZip from 'jszip';
import type { Board } from 'jsxgraph';

export interface GgbImportResult {
  success: boolean;
  elementCount: number;
  warnings: string[];
  error?: string;
}

/**
 * Imports a GeoGebra (.ggb) file into a JSXGraph board.
 */
export async function importGgbFile(
  file: File | ArrayBuffer,
  board: Board
): Promise<GgbImportResult> {
  const warnings: string[] = [];
  let elementCount = 0;

  try {
    const zip = await JSZip.loadAsync(file);
    const xmlFile = zip.file('geogebra.xml');
    if (!xmlFile) {
      throw new Error('geogebra.xml not found in .ggb archive');
    }

    const xmlText = await xmlFile.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Failed to parse geogebra.xml: ' + parseError.textContent);
    }

    board.suspendUpdate();

    // Map of element label to JSXGraph element
    const createdElements = new Map<string, any>();

    // 1. First pass: Parse element definitions and styling
    const elementNodes = doc.querySelectorAll('element');
    const elementData = new Map<string, {
      type: string;
      label: string;
      color?: string;
      visible?: boolean;
      strokeWidth?: number;
      coords?: [number, number];
      value?: number;
    }>();

    elementNodes.forEach((node) => {
      const type = node.getAttribute('type') || '';
      const label = node.getAttribute('label') || '';
      if (!label) return;

      const showNode = node.querySelector('show');
      const visible = showNode ? showNode.getAttribute('object') !== 'false' : true;

      const colorNode = node.querySelector('objColor');
      let color: string | undefined;
      if (colorNode) {
        const r = parseInt(colorNode.getAttribute('r') || '0', 10);
        const g = parseInt(colorNode.getAttribute('g') || '0', 10);
        const b = parseInt(colorNode.getAttribute('b') || '0', 10);
        color = `rgb(${r}, ${g}, ${b})`;
      }

      const coordsNode = node.querySelector('coords');
      let coords: [number, number] | undefined;
      if (coordsNode) {
        const x = parseFloat(coordsNode.getAttribute('x') || '0');
        const y = parseFloat(coordsNode.getAttribute('y') || '0');
        const z = parseFloat(coordsNode.getAttribute('z') || '1');
        // GeoGebra uses homogeneous coordinates [x, y, z]
        coords = z !== 0 ? [x / z, y / z] : [x, y];
      }

      const lineStyleNode = node.querySelector('lineStyle');
      const thickness = lineStyleNode ? parseInt(lineStyleNode.getAttribute('thickness') || '2', 10) : 2;

      elementData.set(label, {
        type,
        label,
        color,
        visible,
        strokeWidth: thickness,
        coords,
      });
    });

    // 2. Second pass: Create free points that are not produced by commands
    const commandOutputs = new Set<string>();
    const commandNodes = doc.querySelectorAll('command');
    commandNodes.forEach((cmd) => {
      const outputNode = cmd.querySelector('output');
      if (outputNode) {
        Array.from(outputNode.attributes).forEach((attr) => {
          commandOutputs.add(attr.value);
        });
      }
    });

    // Create free points
    elementData.forEach((data, label) => {
      if (data.type === 'point' && !commandOutputs.has(label) && data.coords) {
        try {
          const pt = board.create('point', data.coords, {
            name: label,
            strokeColor: data.color || '#2563eb',
            fillColor: data.color || '#3b82f6',
            visible: data.visible,
            strokeWidth: data.strokeWidth || 2,
            size: 3,
          });
          createdElements.set(label, pt);
          elementCount++;
        } catch (e) {
          warnings.push(`Could not create free point ${label}: ${e}`);
        }
      }
    });

    // 3. Third pass: Process commands in order
    commandNodes.forEach((cmd) => {
      const cmdName = cmd.getAttribute('name');
      const inputNode = cmd.querySelector('input');
      const outputNode = cmd.querySelector('output');
      if (!cmdName || !outputNode) return;

      const outputs = Array.from(outputNode.attributes).map((a) => a.value);
      const inputs = inputNode ? Array.from(inputNode.attributes).map((a) => a.value) : [];
      const primaryOutput = outputs[0];
      const outMeta = elementData.get(primaryOutput);

      try {
        switch (cmdName) {
          case 'Segment': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            if (p1 && p2) {
              const seg = board.create('segment', [p1, p2], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#0f172a',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, seg);
              elementCount++;
            }
            break;
          }

          case 'Line': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            if (p1 && p2) {
              const line = board.create('line', [p1, p2], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#0f172a',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, line);
              elementCount++;
            }
            break;
          }

          case 'Ray': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            if (p1 && p2) {
              const ray = board.create('ray', [p1, p2], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#0f172a',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, ray);
              elementCount++;
            }
            break;
          }

          case 'Vector': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            if (p1 && p2) {
              const arrow = board.create('arrow', [p1, p2], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#0f172a',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, arrow);
              elementCount++;
            }
            break;
          }

          case 'Circle': {
            const center = createdElements.get(inputs[0]);
            const second = createdElements.get(inputs[1]);
            if (center && second) {
              const circ = board.create('circle', [center, second], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#2563eb',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, circ);
              elementCount++;
            } else if (center && !isNaN(parseFloat(inputs[1]))) {
              const r = parseFloat(inputs[1]);
              const circ = board.create('circle', [center, r], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#2563eb',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, circ);
              elementCount++;
            }
            break;
          }

          case 'CircleThreePoints': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            const p3 = createdElements.get(inputs[2]);
            if (p1 && p2 && p3) {
              const circ = board.create('circumcircle', [p1, p2, p3], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#2563eb',
                strokeWidth: outMeta?.strokeWidth || 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, circ);
              elementCount++;
            }
            break;
          }

          case 'Midpoint': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            if (p1 && p2) {
              const mid = board.create('midpoint', [p1, p2], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#059669',
                fillColor: outMeta?.color || '#10b981',
                visible: outMeta?.visible ?? true,
                size: 3,
              });
              createdElements.set(primaryOutput, mid);
              elementCount++;
            }
            break;
          }

          case 'OrthogonalLine': {
            const p = createdElements.get(inputs[0]);
            const line = createdElements.get(inputs[1]);
            if (p && line) {
              const perp = board.create('perpendicular', [line, p], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#64748b',
                strokeWidth: outMeta?.strokeWidth || 1.5,
                dash: 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, perp);
              elementCount++;
            }
            break;
          }

          case 'LineBisector': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            if (p1 && p2) {
              const pb = board.create('perpendicularbisector', [p1, p2], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#64748b',
                strokeWidth: outMeta?.strokeWidth || 1.5,
                dash: 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, pb);
              elementCount++;
            }
            break;
          }

          case 'AngularBisector': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            const p3 = createdElements.get(inputs[2]);
            if (p1 && p2 && p3) {
              const bis = board.create('bisector', [p1, p2, p3], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#64748b',
                strokeWidth: outMeta?.strokeWidth || 1.5,
                dash: 2,
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, bis);
              elementCount++;
            }
            break;
          }

          case 'Polygon': {
            const vertices = inputs.map((inp) => createdElements.get(inp)).filter(Boolean);
            if (vertices.length >= 3) {
              const poly = board.create('polygon', vertices, {
                name: primaryOutput,
                fillColor: outMeta?.color || '#3b82f6',
                fillOpacity: 0.15,
                borders: {
                  strokeColor: outMeta?.color || '#1d4ed8',
                  strokeWidth: outMeta?.strokeWidth || 2,
                },
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, poly);
              elementCount++;
            }
            break;
          }

          case 'Intersect': {
            const el1 = createdElements.get(inputs[0]);
            const el2 = createdElements.get(inputs[1]);
            if (el1 && el2) {
              const inter = board.create('intersection', [el1, el2, 0], {
                name: primaryOutput,
                strokeColor: outMeta?.color || '#dc2626',
                fillColor: outMeta?.color || '#ef4444',
                visible: outMeta?.visible ?? true,
                size: 3,
              });
              createdElements.set(primaryOutput, inter);
              elementCount++;
            }
            break;
          }

          case 'Angle': {
            const p1 = createdElements.get(inputs[0]);
            const p2 = createdElements.get(inputs[1]);
            const p3 = createdElements.get(inputs[2]);
            if (p1 && p2 && p3) {
              const ang = board.create('angle', [p1, p2, p3], {
                name: primaryOutput,
                fillColor: '#f59e0b',
                fillOpacity: 0.25,
                strokeColor: '#d97706',
                visible: outMeta?.visible ?? true,
              });
              createdElements.set(primaryOutput, ang);
              elementCount++;
            }
            break;
          }

          default:
            warnings.push(`Command "${cmdName}" is not currently mapped in GeoGebra importer`);
        }
      } catch (err) {
        warnings.push(`Error executing command ${cmdName} for ${primaryOutput}: ${err}`);
      }
    });

    board.unsuspendUpdate();
    board.fullUpdate();

    return {
      success: true,
      elementCount,
      warnings,
    };
  } catch (err: any) {
    board.unsuspendUpdate();
    return {
      success: false,
      elementCount,
      warnings,
      error: err.message || String(err),
    };
  }
}
