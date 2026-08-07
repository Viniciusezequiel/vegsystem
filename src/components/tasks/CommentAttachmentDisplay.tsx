import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CommentAttachmentDisplayProps {
  urls: string[];
}

const BUCKET = 'task-attachments';

/** Accepts either a legacy public URL or a bare object path and returns the object path. */
function toObjectPath(value: string) {
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return value.replace(/^\/+/, '');
  return decodeURIComponent(value.slice(idx + marker.length).split('?')[0]);
}

function getFileInfo(path: string) {
  const name = path.split('/').pop() || 'arquivo';
  const cleanName = name.replace(/^\d+-[a-z0-9]+\./, '.');
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  return { name: cleanName.length > 2 ? cleanName : name, isImage };
}

export default function CommentAttachmentDisplay({ urls }: CommentAttachmentDisplayProps) {
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!urls || urls.length === 0) return;
    let active = true;

    (async () => {
      const paths = urls.map(toObjectPath);
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, 60 * 60);
      if (!active || error || !data) return;
      const map: Record<string, string> = {};
      data.forEach((item, i) => {
        if (item.signedUrl) map[urls[i]] = item.signedUrl;
      });
      setSigned(map);
    })();

    return () => {
      active = false;
    };
  }, [urls]);

  if (!urls || urls.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {urls.map((raw, i) => {
        const path = toObjectPath(raw);
        const { name, isImage } = getFileInfo(path);
        const href = signed[raw];

        if (!href) {
          return (
            <div
              key={i}
              className="flex w-fit items-center gap-2 rounded-md border bg-background p-2 text-sm text-muted-foreground"
            >
              <FileText className="h-4 w-4" />
              <span className="max-w-[180px] truncate">{name}</span>
            </div>
          );
        }

        if (isImage) {
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={href}
                alt={name}
                className="max-h-[150px] max-w-[200px] rounded-md border object-cover transition-opacity hover:opacity-80"
              />
            </a>
          );
        }

        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-md border bg-background p-2 text-sm transition-colors hover:bg-muted/50"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[180px] truncate">{name}</span>
            <Download className="h-3 w-3 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
