import { CreditCard, Wifi } from 'lucide-react';

interface CreditCardVisualProps {
  children: React.ReactNode;
}

/**
 * A credit card–shaped container (ISO 7810 ratio 1.586:1) with a visual
 * chip/contactless overlay. Uses container-query units (cqi) so that
 * everything inside scales proportionally with the card's width —
 * mobile and desktop share the exact same layout, just at different sizes.
 */
export const CreditCardVisual = ({ children }: CreditCardVisualProps) => {
  return (
    /* Container query context – the card measures its own inline size */
    <div style={{ containerType: 'inline-size' }} className="w-full">
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-border/40 shadow-lg"
        style={{
          aspectRatio: '1.586 / 1',
          background:
            'linear-gradient(135deg, hsl(210 40% 28%), hsl(215 35% 22%), hsl(220 30% 18%))',
          /* Base font-size scales with card width via cqi */
          fontSize: '4cqi',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute rounded-full bg-primary/5" style={{ top: '-2.9em', right: '-2.9em', width: '11.7em', height: '11.7em' }} />
        <div className="absolute rounded-full bg-primary/5" style={{ bottom: '-4.1em', left: '-4.1em', width: '15.2em', height: '15.2em' }} />

        {/* Top bar: chip + contactless */}
        <div
          className="absolute flex items-center pointer-events-none select-none"
          style={{ top: '1.17em', right: '1.45em', gap: '0.87em' }}
        >
          {/* EMV chip */}
          <div
            className="rounded-md bg-gradient-to-br from-amber-300/80 to-amber-500/60 border border-amber-400/30 flex items-center justify-center"
            style={{ width: '2.9em', height: '2em' }}
          >
            <div
              className="rounded-sm border border-amber-600/30"
              style={{ width: '1.75em', height: '1.17em' }}
            />
          </div>
          <Wifi
            className="text-slate-400/50 rotate-90"
            style={{ width: '1.45em', height: '1.45em' }}
          />
        </div>

        {/* Card brand icon – bottom right */}
        <div
          className="absolute pointer-events-none select-none"
          style={{ bottom: '0.87em', right: '1.45em' }}
        >
          <CreditCard
            className="text-slate-400/30"
            style={{ width: '1.75em', height: '1.75em' }}
          />
        </div>

        {/* Interactive fields – proportionally scaled */}
        <div
          className="relative z-10 flex flex-col justify-center h-full"
          style={{ padding: '4.1em 1.45em 2.3em' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
