import { FileText, Image as ImageIcon, File, Download } from 'lucide-react';

interface CommentAttachmentDisplayProps {
  urls: string[];
}

export default function CommentAttachmentDisplay({ urls }: CommentAttachmentDisplayProps) {
  if (!urls || urls.length === 0) return null;

  const getFileInfo = (url: string) => {
    const name = decodeURIComponent(url.split('/').pop() || 'arquivo');
    // Remove the random prefix
    const cleanName = name.replace(/^\d+-[a-z0-9]+\./, '.');
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    return { name: cleanName.length > 2 ? cleanName : name, ext, isImage, isPdf };
  };

  return (
    <div className="mt-2 space-y-2">
      {urls.map((url, i) => {
        const { name, isImage } = getFileInfo(url);
        if (isImage) {
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={url}
                alt={name}
                className="max-w-[200px] max-h-[150px] rounded-md border object-cover hover:opacity-80 transition-opacity"
              />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-background border rounded-md hover:bg-muted/50 transition-colors text-sm w-fit"
          >
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="max-w-[180px] truncate">{name}</span>
            <Download className="w-3 h-3 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
