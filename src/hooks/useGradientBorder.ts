import { useRef, useCallback, useState, type CSSProperties } from "react";

export function useGradientBorder() {
  const ref = useRef<HTMLDivElement>(null);
  const [gradientStyle, setGradientStyle] = useState<CSSProperties>({
    background: "hsl(var(--pastel-purple) / 0.5)",
  });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setGradientStyle({
      background: `radial-gradient(circle 80px at ${x}px ${y}px, hsl(270 70% 60%), hsl(var(--pastel-purple) / 0.5) 70%)`,
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    setGradientStyle({
      background: "hsl(var(--pastel-purple) / 0.5)",
    });
  }, []);

  return { ref, onMouseMove, onMouseLeave, style: gradientStyle };
}
