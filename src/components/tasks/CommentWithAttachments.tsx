import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Paperclip, X, FileText, Image as ImageIcon, File } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CommentWithAttachmentsProps {
  onSubmit: (content: string, attachmentUrls: string[]) => Promise<void>;
  isPending: boolean;
}

export default function CommentWithAttachments({ onSubmit, isPending }: CommentWithAttachmentsProps) {
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = selectedFiles.filter(f => {
      if (f.size > maxSize) {
        toast.error(`Arquivo "${f.name}" excede 10MB`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!comment.trim() && files.length === 0) return;

    let attachmentUrls: string[] = [];

    if (files.length > 0) {
      setUploading(true);
      try {
        const uploads = await Promise.all(
          files.map(async (file) => {
            const ext = file.name.split('.').pop();
            const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage
              .from('task-attachments')
              .upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage
              .from('task-attachments')
              .getPublicUrl(path);
            return urlData.publicUrl;
          })
        );
        attachmentUrls = uploads;
      } catch (err) {
        toast.error('Erro ao enviar anexo(s)');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    await onSubmit(comment, attachmentUrls);
    setComment('');
    setFiles([]);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className="w-3 h-3" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText className="w-3 h-3" />;
    return <File className="w-3 h-3" />;
  };

  const busy = isPending || uploading;

  return (
    <div className="space-y-2 mt-3 pt-3 border-t">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {getFileIcon(file.name)}
              <span className="max-w-[120px] truncate text-xs">{file.name}</span>
              <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => removeFile(i)}>
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="flex-1 flex gap-2">
          <Textarea
            placeholder="Adicionar comentário..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="resize-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(!comment.trim() && files.length === 0) || busy}
            size="icon"
            className="h-auto flex-1"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAddFiles}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
      />
    </div>
  );
}
