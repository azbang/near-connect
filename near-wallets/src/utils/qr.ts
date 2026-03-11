import qrcode from "qrcode-generator";

export function createQRSvg(data: string, size: number): SVGElement {
  const qr = qrcode(0, "Q");
  qr.addData(data);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const cellSize = size / (moduleCount + 8); // 4-cell quiet zone each side
  const margin = cellSize * 4;

  let path = "";
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        const x = c * cellSize + margin;
        const y = r * cellSize + margin;
        path += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z`;
      }
    }
  }

  const svgSize = moduleCount * cellSize + margin * 2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.innerHTML = `<path d="${path}" fill="#FFFFFF"/>`;
  return svg;
}
