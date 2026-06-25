import { cn } from '@/lib/utils';

interface LiderLogoProps {
  collapsed?: boolean;
  className?: string;
}

// Marca minimalista em traço único (verde): "L" de Líder + linha ascendente (crescimento/vendas).
// Usa currentColor → herda a paleta (text-primary).
export const LiderLogo = ({ collapsed = false, className }: LiderLogoProps) => (
  <div className={cn('flex items-center gap-2.5', collapsed && 'lg:justify-center', className)}>
    <svg
      width="30"
      height="30"
      viewBox="0 0 32 32"
      fill="none"
      className="text-primary shrink-0"
      aria-label="Líder Celulares"
    >
      <path
        d="M8 5 V20 a4 4 0 0 0 4 4 H24"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 18 L17.5 12.5 L21 15.5 L27 7.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <div className={cn('leading-none', collapsed && 'lg:hidden')}>
      <p className="text-sm font-extrabold tracking-tight text-foreground">LÍDER</p>
      <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mt-0.5">Celulares</p>
    </div>
  </div>
);
