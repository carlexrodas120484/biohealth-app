import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Aparición discreta al entrar en pantalla. Respeta "reducir movimiento". */
export function Revelar({ children, retardo = 0, className = '' }: { children: ReactNode; retardo?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`revelar ${visible ? 'es-visible' : ''} ${className}`} style={{ transitionDelay: `${retardo}ms` }}>
      {children}
    </div>
  );
}
