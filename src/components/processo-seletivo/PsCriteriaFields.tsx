import { PS_CRITERIA, psFinalScore, psClassification, PS_CLASSIFICATION_LABEL } from '@/lib/psConstants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
}

export function PsCriteriaFields({ values, onChange }: Props) {
  const score = psFinalScore(values);
  const classification = psClassification(score);

  return (
    <div className="space-y-3">
      {PS_CRITERIA.map((c) => (
        <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
          <span className="text-sm font-medium">{c.label}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                size="icon"
                variant={values[c.key] >= n ? 'default' : 'outline'}
                className="h-8 w-8"
                onClick={() => onChange({ ...values, [c.key]: n })}
              >
                <Star className={cn('h-4 w-4', values[c.key] >= n && 'fill-current')} />
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
        <span className="text-sm font-semibold">Nota final</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{score.toFixed(2)}</span>
          <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[classification]}</Badge>
        </div>
      </div>
    </div>
  );
}

export const emptyCriteria = () =>
  PS_CRITERIA.reduce((acc, c) => ({ ...acc, [c.key]: 0 }), {} as Record<string, number>);
