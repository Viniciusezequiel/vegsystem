import { useEffect, useState } from 'react';
import { getSignatureDisplayState } from '@/lib/signatureStorageCore.mjs';
import { resolveSignatureDataUrl } from '@/lib/signatureStorage';

type SignatureState = {
  status: 'empty' | 'ready' | 'resolving' | 'error';
  source: string | null;
  locator?: string;
};

interface ProviderAwareSignatureImageProps {
  value: string | null | undefined;
  alt: string;
  expectedModule?: string;
  className?: string;
}

export function ProviderAwareSignatureImage({
  value,
  alt,
  expectedModule,
  className,
}: ProviderAwareSignatureImageProps) {
  const [state, setState] = useState<SignatureState>(() => getSignatureDisplayState(value, expectedModule));

  useEffect(() => {
    const next = getSignatureDisplayState(value, expectedModule) as SignatureState;
    setState(next);
    if (next.status !== 'resolving' || !next.locator) return;

    let cancelled = false;
    void resolveSignatureDataUrl(next.locator).then(source => {
      if (!cancelled) setState(source
        ? { status: 'ready', source }
        : { status: 'error', source: null });
    });
    return () => { cancelled = true; };
  }, [value, expectedModule]);

  if (state.status === 'empty') return null;
  if (state.status === 'resolving') {
    return <p role="status" className="text-xs text-muted-foreground">Carregando assinatura…</p>;
  }
  if (state.status === 'error' || !state.source) {
    return <p role="status" className="text-xs text-muted-foreground">Assinatura indisponível.</p>;
  }
  return <img src={state.source} alt={alt} className={className} />;
}
