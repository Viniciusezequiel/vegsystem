import { supabase } from '@/integrations/supabase/client';

export type LostItemAiSuggestion = {
  item_type: string | null;
  description_suggestion: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  brand: string | null;
  material: string | null;
  features: string[];
  condition: string | null;
  storage_category: string | null;
  visible_text_safe: string[];
  confidence: number;
};

export async function analyzeLostItemImage(file: File): Promise<LostItemAiSuggestion> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const workerUrl = String(import.meta.env.VITE_STORAGE_WORKER_URL ?? '').replace(/\/+$/, '');
  if (!workerUrl) {
    throw new Error('AI indisponível no momento.');
  }

  const response = await fetch(`${workerUrl}/v1/ai/lost-item`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (response.status === 429) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.code === 'AI_DAILY_LIMIT' ? 'Limite diário da identificação inteligente atingido. Continue o cadastro normalmente.' : 'Identificação inteligente indisponível no momento. Você pode continuar o cadastro normalmente.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.code === 'AI_DAILY_LIMIT'
      ? 'Limite diário da identificação inteligente atingido. Continue o cadastro normalmente.'
      : 'Identificação inteligente indisponível no momento. Você pode continuar o cadastro normalmente.';
    throw new Error(message);
  }

  return (await response.json()) as LostItemAiSuggestion;
}
