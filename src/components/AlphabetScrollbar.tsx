import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const CHARS = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
const CHAR_COUNT = CHARS.length;

interface AlphabetScrollbarProps {
  onCharSelect: (char: string) => void;
  activeChar?: string | null;
  availableChars?: Set<string>;
}

const AlphabetScrollbar: React.FC<AlphabetScrollbarProps> = ({
  onCharSelect,
  activeChar = null,
  availableChars,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const activeIndex = useMemo(() => {
    if (!activeChar) return -1;
    return CHARS.indexOf(activeChar);
  }, [activeChar]);

  // Animate thumb via ref for smooth 60fps
  useEffect(() => {
    if (!thumbRef.current || activeIndex < 0) return;
    const pct = (activeIndex / CHAR_COUNT) * 100;
    thumbRef.current.style.top = `${pct}%`;
  }, [activeIndex]);

  const getCharFromY = useCallback((clientY: number): string | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const charHeight = rect.height / CHAR_COUNT;
    const index = Math.floor(relativeY / charHeight);
    if (index >= 0 && index < CHAR_COUNT) {
      return CHARS[index];
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const char = getCharFromY(e.clientY);
    if (char) onCharSelect(char);
  }, [getCharFromY, onCharSelect]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const char = getCharFromY(e.clientY);
      if (char) onCharSelect(char);
    };
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, getCharFromY, onCharSelect]);

  const normalize = (c: string) => (c === '0-9' ? '#' : c);
  const charHeight = 100 / CHAR_COUNT;

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      className="relative select-none touch-none rounded-full border border-border/40 bg-background/90 backdrop-blur-sm shadow-md overflow-hidden"
      style={{ width: 28, height: '100%' }}
    >
      {/* Thumb — animated via ref for smoothness */}
      {activeIndex >= 0 && (
        <div
          ref={thumbRef}
          className="absolute left-0 right-0 rounded-full bg-primary/20 border border-primary/30 pointer-events-none"
          style={{
            height: `${charHeight}%`,
            top: `${(activeIndex / CHAR_COUNT) * 100}%`,
            transition: 'top 120ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
      )}

      {/* Characters */}
      {CHARS.map((char, i) => {
        const isAvailable = !availableChars || availableChars.has(normalize(char));
        const isActive = activeChar === char;

        return (
          <div
            key={char}
            className={`absolute left-0 right-0 flex items-center justify-center text-[10px] leading-none font-bold pointer-events-none ${
              isActive
                ? 'text-primary z-10'
                : isAvailable
                  ? 'text-muted-foreground/70'
                  : 'text-muted-foreground/25'
            }`}
            style={{
              height: `${charHeight}%`,
              top: `${i * charHeight}%`,
            }}
          >
            {normalize(char)}
          </div>
        );
      })}
    </div>
  );
};

export default AlphabetScrollbar;
