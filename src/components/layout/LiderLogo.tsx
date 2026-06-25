import { cn } from '@/lib/utils';

interface LiderLogoProps {
  collapsed?: boolean;
  className?: string;
}

// Marca da Líder em traço verde: triângulo (Λ/A) com coroa no topo ("líder").
// Recriação SVG do logo original (antes em PNG); usa currentColor → herda a paleta.
export const LiderTriangulo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 44 46" fill="none" className={cn('text-primary', className)} aria-label="Líder">
    <path d="M16 16 L17 9.5 L19.5 13.5 L22 8 L24.5 13.5 L27 9.5 L28 16 Z" fill="currentColor" />
    <path d="M22 18 L37 40 H7 Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M22 26 L14.5 40" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
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
