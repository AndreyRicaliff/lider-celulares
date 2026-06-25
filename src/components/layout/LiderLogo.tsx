import { cn } from '@/lib/utils';

interface LiderLogoProps {
  collapsed?: boolean;
  className?: string;
}

// Marca da Líder em traço verde: triângulo (Λ/A) com coroa no topo ("líder").
// Recriação SVG do logo original (antes em PNG); usa currentColor → herda a paleta.
export const LiderTriangulo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 44" fill="none" className={cn('text-primary', className)} aria-label="Líder">
    <path d="M24 6 L44 39 H4 Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
    <path d="M24 17 L35.5 39" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LiderLogo = ({ collapsed = false, className }: LiderLogoProps) => (
  <div className={cn('flex items-center gap-2.5', collapsed && 'lg:justify-center', className)}>
    <LiderTriangulo className="h-8 w-8 shrink-0" />
    <div className={cn('leading-none', collapsed && 'lg:hidden')}>
      <p className="text-sm font-extrabold tracking-tight text-foreground">LÍDER</p>
      <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mt-0.5">Celulares</p>
    </div>
  </div>
);
