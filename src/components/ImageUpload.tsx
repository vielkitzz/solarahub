import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  className?: string;
}

export const ImageUpload = ({ value, onChange, bucket = "crests", folder = "", className }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter menos de 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center p-6 min-h-[140px]",
          dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-secondary/30",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Enviando...</p>
          </>
        ) : value ? (
          <>
            <img src={value} alt="" className="max-h-24 object-contain mb-2" />
            <p className="text-xs text-muted-foreground">Clique ou arraste para trocar</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center hover:bg-destructive"
              aria-label="Remover imagem"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Arraste uma imagem ou clique</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP até 5MB</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
    </div>
  );
};
