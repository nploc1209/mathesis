import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { Board } from 'jsxgraph';

/**
 * Generates and downloads a GeoGebra (.ggb) archive from the JSXGraph board.
 */
export async function downloadGGB(board: Board, filename = 'mathesis.ggb'): Promise<void> {
  if (!board) return;

  const objects = Object.values(board.objects) as any[];
  const userObjects = objects.filter(
    (obj) =>
      obj.elType !== 'axis' &&
      obj.elType !== 'ticks' &&
      obj.elType !== 'grid' &&
      !obj.visProp?.isLabel &&
      obj.type !== 4 &&
      obj.dump !== false &&
      !/^t[a-z0-9_]*$/i.test(obj.name || '') &&
      !(
        obj.elType === 'point' &&
        obj.isDraggable === false &&
        ((obj.X?.() === 0 && obj.Y?.() === 0) ||
          (obj.X?.() === 1 && obj.Y?.() === 0) ||
          (obj.X?.() === 0 && obj.Y?.() === 1))
      )
  );

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<geogebra format="5.0" version="5.0.0.0" app="classic" platform="w">
  <gui>
    <window width="${board.canvasWidth || 1000}" height="${board.canvasHeight || 700}" />
  </gui>
  <euclidianView>
    <size width="${board.canvasWidth || 1000}" height="${board.canvasHeight || 700}"/>
    <coordSystem xZero="500" yZero="350" scale="50" yscale="50"/>
    <show axes="true" grid="true"/>
  </euclidianView>
  <kernel>
    <continuous val="true"/>
    <decimals val="2"/>
    <angleUnit val="degree"/>
  </kernel>
  <construction title="${filename.replace(/\.ggb$/i, '')}">
`;

  // First pass: Points
  for (const obj of userObjects) {
    if (obj.elType === 'point' || obj.elType === 'glider') {
      const x = typeof obj.X === 'function' ? obj.X() : 0;
      const y = typeof obj.Y === 'function' ? obj.Y() : 0;
      const color = obj.visProp?.strokecolor || '#1e3a8a';
      const rgb = parseColorToRGB(color);
      xml += `    <element type="point" label="${obj.name}">
      <show object="${obj.visProp?.visible !== false}" label="${obj.visProp?.withlabel !== false}"/>
      <objColor r="${rgb.r}" g="${rgb.g}" b="${rgb.b}" alpha="0.0"/>
      <layer val="0"/>
      <coords x="${x}" y="${y}" z="1.0"/>
      <pointSize val="${obj.visProp?.size || 3}"/>
    </element>
`;
    }
  }

  // Second pass: Dependent elements (segments, lines, circles, polygons)
  for (const obj of userObjects) {
    const color = obj.visProp?.strokecolor || '#0f172a';
    const rgb = parseColorToRGB(color);

    if (obj.elType === 'segment') {
      const p1 = obj.point1?.name;
      const p2 = obj.point2?.name;
      if (p1 && p2) {
        xml += `    <command name="Segment">
      <input a0="${p1}" a1="${p2}"/>
      <output a0="${obj.name}"/>
    </command>
    <element type="segment" label="${obj.name}">
      <show object="${obj.visProp?.visible !== false}" label="false"/>
      <objColor r="${rgb.r}" g="${rgb.g}" b="${rgb.b}" alpha="0.0"/>
      <lineStyle thickness="${obj.visProp?.strokewidth || 2}"/>
    </element>
`;
      }
    } else if (obj.elType === 'line') {
      const p1 = obj.point1?.name;
      const p2 = obj.point2?.name;
      if (p1 && p2) {
        xml += `    <command name="Line">
      <input a0="${p1}" a1="${p2}"/>
      <output a0="${obj.name}"/>
    </command>
    <element type="line" label="${obj.name}">
      <show object="${obj.visProp?.visible !== false}" label="true"/>
      <objColor r="${rgb.r}" g="${rgb.g}" b="${rgb.b}" alpha="0.0"/>
      <lineStyle thickness="${obj.visProp?.strokewidth || 2}"/>
    </element>
`;
      }
    } else if (obj.elType === 'circle') {
      const center = obj.center?.name;
      const point2 = obj.point2?.name;
      if (center && point2) {
        xml += `    <command name="Circle">
      <input a0="${center}" a1="${point2}"/>
      <output a0="${obj.name}"/>
    </command>
    <element type="circle" label="${obj.name}">
      <show object="${obj.visProp?.visible !== false}" label="true"/>
      <objColor r="${rgb.r}" g="${rgb.g}" b="${rgb.b}" alpha="0.05"/>
      <lineStyle thickness="${obj.visProp?.strokewidth || 2}"/>
    </element>
`;
      } else if (center) {
        const r = typeof obj.Radius === 'function' ? obj.Radius() : 3;
        xml += `    <command name="Circle">
      <input a0="${center}" a1="${r}"/>
      <output a0="${obj.name}"/>
    </command>
    <element type="circle" label="${obj.name}">
      <show object="${obj.visProp?.visible !== false}" label="true"/>
      <objColor r="${rgb.r}" g="${rgb.g}" b="${rgb.b}" alpha="0.05"/>
      <lineStyle thickness="${obj.visProp?.strokewidth || 2}"/>
    </element>
`;
      }
    } else if (obj.elType === 'polygon' && obj.vertices) {
      const vLabels = obj.vertices.map((v: any) => v.name).filter(Boolean);
      if (vLabels.length >= 3) {
        const inputAttrs = vLabels.map((l: string, idx: number) => `a${idx}="${l}"`).join(' ');
        xml += `    <command name="Polygon">
      <input ${inputAttrs}/>
      <output a0="${obj.name}"/>
    </command>
    <element type="polygon" label="${obj.name}">
      <show object="${obj.visProp?.visible !== false}" label="true"/>
      <objColor r="${rgb.r}" g="${rgb.g}" b="${rgb.b}" alpha="0.15"/>
    </element>
`;
      }
    }
  }

  xml += `  </construction>
</geogebra>`;

  const zip = new JSZip();
  zip.file('geogebra.xml', xml);
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, filename.endsWith('.ggb') ? filename : `${filename}.ggb`);
}

/**
 * Exports the JSXGraph board to SVG string.
 */
export function exportToSVG(board: Board): string {
  if (!board) return '';
  const container = document.getElementById(board.container) || board.containerObj;
  const svg = container?.querySelector('svg') || (board.renderer as any)?.svgRoot;
  if (!svg) {
    throw new Error('SVG root element not found');
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const width = board.canvasWidth || container?.clientWidth || 800;
  const height = board.canvasHeight || container?.clientHeight || 600;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Insert background white rectangle at beginning
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', '#ffffff');
  clone.insertBefore(bgRect, clone.firstChild);

  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="utf-8"?>\n' + serializer.serializeToString(clone);
}

/**
 * Downloads SVG file.
 */
export function downloadSVG(board: Board, filename = 'mathesis.svg'): void {
  const svgStr = exportToSVG(board);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.svg') ? filename : `${filename}.svg`);
}

/**
 * Exports board to PNG via canvas.
 */
export async function exportToPNG(board: Board, scale = 2): Promise<string> {
  const svgStr = exportToSVG(board);
  const width = (board.canvasWidth || 800) * scale;
  const height = (board.canvasHeight || 600) * scale;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context could not be created'));
      return;
    }

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      // Fallback: draw directly using XML string in data URI
      const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(fallbackImg, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      fallbackImg.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      fallbackImg.src = dataUri;
    };

    img.src = url;
  });
}

/**
 * Downloads PNG image.
 */
export async function downloadPNG(board: Board, filename = 'mathesis.png'): Promise<void> {
  const dataUrl = await exportToPNG(board, 2);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Exports board to PDF document.
 */
export async function downloadPDF(board: Board, filename = 'mathesis.pdf', title = 'Mathesis'): Promise<void> {
  const pngDataUrl = await exportToPNG(board, 2);
  const pxWidth = board.canvasWidth || 800;
  const pxHeight = board.canvasHeight || 600;

  const isLandscape = pxWidth > pxHeight;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Header in PDF
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(title, 14, 14);

  const margin = 14;
  const availWidth = pageWidth - margin * 2;
  const availHeight = pageHeight - margin * 2 - 12;

  const ratio = Math.min(availWidth / pxWidth, availHeight / pxHeight);
  const imgW = pxWidth * ratio;
  const imgH = pxHeight * ratio;
  const x = margin + (availWidth - imgW) / 2;
  const y = 20 + (availHeight - imgH) / 2;

  pdf.addImage(pngDataUrl, 'PNG', x, y, imgW, imgH);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseColorToRGB(colorStr: string): { r: number; g: number; b: number } {
  if (!colorStr) return { r: 15, g: 23, b: 42 };
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }
  return { r: 15, g: 23, b: 42 };
}
