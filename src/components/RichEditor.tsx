import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Image as TiptapImage } from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Node, mergeAttributes } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Link2,
  Image as ImageIcon,
  Undo,
  Redo,
  Code,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

// Faz upload de um File para o Storage e retorna a URL pública.
async function uploadWikiImage(file: File): Promise<string | null> {
  try {
    let toUpload: File = file;
    try {
      toUpload = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1000,
        useWebWorker: true,
      });
    } catch {}
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `wiki/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("crests")
      .upload(path, toUpload, { upsert: false, contentType: file.type || "image/png" });
    if (error) {
      toast.error("Falha ao enviar imagem: " + error.message);
      return null;
    }
    return supabase.storage.from("crests").getPublicUrl(path).data.publicUrl;
  } catch (e: any) {
    toast.error("Erro no upload: " + (e?.message ?? e));
    return null;
  }
}

// Converte data:URL base64 em File para reuso da rotina de upload.
function dataUrlToFile(dataUrl: string, filename = "pasted.png"): File | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    if (!b64) return null;
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  } catch {
    return null;
  }
}

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}

// ── Resizable Image Node ──────────────────────────────────────────────────────

const ResizableImageComponent = ({ node, updateAttributes, deleteNode, selected }: NodeViewProps) => {
  const { src, alt, width } = node.attrs;
  const [resizing, setResizing] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault();
      setResizing(true);
      startX.current = e.clientX;
      startW.current = imgRef.current?.offsetWidth ?? (typeof width === "number" ? width : 400);

      const onMove = (me: MouseEvent) => {
        const delta = direction === "right" ? me.clientX - startX.current : startX.current - me.clientX;
        const newW = Math.max(80, Math.min(startW.current + delta, 900));
        updateAttributes({ width: newW });
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      as="div"
      className="relative group my-4 select-none"
      style={{ textAlign: "inherit" }}
      data-drag-handle
    >
      <button
        onClick={deleteNode}
        className="absolute -top-2.5 -right-2.5 z-10 h-6 w-6 rounded-full bg-destructive text-destructive-foreground items-center justify-center shadow hidden group-hover:flex transition-opacity"
        title="Remover imagem"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      <span
        onMouseDown={(e) => onMouseDown(e, "left")}
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-2 h-10 rounded cursor-ew-resize bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
      />

      <img
        ref={imgRef}
        src={src}
        alt={alt ?? ""}
        style={{ width: width ? `min(${width}px, 100%)` : "auto", maxWidth: "100%", display: "inline-block" }}
        className={`rounded-lg border ${selected ? "ring-2 ring-primary" : "border-border"}`}
        draggable={false}
      />

      <span
        onMouseDown={(e) => onMouseDown(e, "right")}
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 w-2 h-10 rounded cursor-ew-resize bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
      />

      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-popover border border-border rounded-md px-2 py-1 shadow-md z-10">
        {[200, 400, 600, 900].map((w) => (
          <button
            key={w}
            onClick={() => updateAttributes({ width: w })}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 transition-colors"
          >
            {w === 200 ? "P" : w === 400 ? "M" : w === 600 ? "G" : "Max"}
          </button>
        ))}
      </span>
    </NodeViewWrapper>
  );
};

const ResizableImage = Node.create({
  name: "resizableImage",
  group: "inline",
  inline: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { style: `width:${HTMLAttributes.width}px;max-width:100%` })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

export function RichEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Conte a história do clube...",
}: RichEditorProps) {
  const [openImageUpload, setOpenImageUpload] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      ResizableImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  if (!editable) {
    return (
      <>
        <style>{`
          .wiki-prose-render p { margin-bottom: 1rem; line-height: 1.625; }
          .wiki-prose-render ul { list-style: disc; margin-left: 1.5rem; margin-bottom: 1rem; }
          .wiki-prose-render ol { list-style: decimal; margin-left: 1.5rem; margin-bottom: 1rem; }
          .wiki-prose-render li { margin-top: 0.25rem; }
          .wiki-prose-render h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; }
          .wiki-prose-render h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
          .wiki-prose-render blockquote { border-left: 4px solid; padding-left: 1rem; font-style: italic; margin: 1rem 0; }
          .wiki-prose-render img { border-radius: 0.5rem; margin: 1rem 0; max-width: 100%; }
          .wiki-prose-render a { text-decoration: underline; }
          .wiki-prose-render [style*="text-align: center"] { text-align: center; }
          .wiki-prose-render [style*="text-align: center"] img { display: inline-block; }
          .wiki-prose-render [style*="text-align: right"] { text-align: right; }
          .wiki-prose-render [style*="text-align: right"] img { display: inline-block; }
          .wiki-prose-render [style*="text-align: left"] { text-align: left; }
          .wiki-prose-render .tiptap { outline: none; }
        `}</style>
        <div
          className="wiki-prose-render overflow-x-hidden break-words"
          dangerouslySetInnerHTML={{
            __html: content || "<p class='text-muted-foreground italic mb-0'>Sem conteúdo na wiki ainda.</p>",
          }}
        />
      </>
    );
  }

  const ToolBtn = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  return (
    <>
      <style>{`
    .wiki-prose-render p { margin-bottom: 1rem; line-height: 1.625; }
    .wiki-prose-render ul { list-style: disc; margin-left: 1.5rem; margin-bottom: 1rem; }
    .wiki-prose-render ol { list-style: decimal; margin-left: 1.5rem; margin-bottom: 1rem; }
    .wiki-prose-render li { margin-top: 0.25rem; }
    .wiki-prose-render h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; }
    .wiki-prose-render h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    .wiki-prose-render blockquote { border-left: 4px solid; padding-left: 1rem; font-style: italic; margin: 1rem 0; }
    .wiki-prose-render img { border-radius: 0.5rem; margin: 1rem 0; max-width: 100%; }
    .wiki-prose-render a { text-decoration: underline; }
    .wiki-prose-render [style*="text-align: center"] { text-align: center; }
    .wiki-prose-render [style*="text-align: center"] img { display: inline-block; }
    .wiki-prose-render [style*="text-align: right"] { text-align: right; }
    .wiki-prose-render [style*="text-align: right"] img { display: inline-block; }
    .wiki-prose-render [style*="text-align: left"] { text-align: left; }
    .wiki-prose-render .tiptap { outline: none; }
  `}</style>
      <div className="group border border-border rounded-xl bg-card overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-all">
        <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-0.5">
            <ToolBtn
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="Negrito"
            >
              <Bold className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="Itálico"
            >
              <Italic className="h-4 w-4" />
            </ToolBtn>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <div className="flex items-center gap-0.5">
            <ToolBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
              title="Título"
            >
              <Heading2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive("heading", { level: 3 })}
              title="Subtítulo"
            >
              <Heading3 className="h-4 w-4" />
            </ToolBtn>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <div className="flex items-center gap-0.5">
            <ToolBtn
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="Lista Numerada"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
              title="Citação"
            >
              <Quote className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive("codeBlock")}
              title="Código"
            >
              <Code className="h-4 w-4" />
            </ToolBtn>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Alinhamento */}
          <div className="flex items-center gap-0.5">
            <ToolBtn
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              active={editor.isActive({ textAlign: "left" })}
              title="Alinhar à esquerda"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              active={editor.isActive({ textAlign: "center" })}
              title="Centralizar"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              active={editor.isActive({ textAlign: "right" })}
              title="Alinhar à direita"
            >
              <AlignRight className="h-4 w-4" />
            </ToolBtn>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Cor do texto */}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="sm" title="Cor do texto" className="h-8 w-8 p-0 relative">
                <Palette className="h-4 w-4" />
                <span
                  className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded"
                  style={{ background: editor.getAttributes("textStyle").color || "currentColor" }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-7 gap-1.5">
                {[
                  "#ffffff",
                  "#000000",
                  "#9ca3af",
                  "#ef4444",
                  "#f97316",
                  "#f59e0b",
                  "#eab308",
                  "#84cc16",
                  "#22c55e",
                  "#10b981",
                  "#14b8a6",
                  "#06b6d4",
                  "#3b82f6",
                  "#6366f1",
                  "#8b5cf6",
                  "#a855f7",
                  "#d946ef",
                  "#ec4899",
                  "#f43f5e",
                  "#facc15",
                  "#7c2d12",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => editor.chain().focus().setColor(c).run()}
                    className="h-6 w-6 rounded border border-border/40 hover:scale-110 transition-transform"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                <input
                  type="color"
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  className="h-7 w-10 cursor-pointer bg-transparent border border-border/40 rounded"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().unsetColor().run()}
                  className="text-xs h-7 flex-1"
                >
                  Remover cor
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <div className="flex items-center gap-0.5">
            <ToolBtn
              onClick={() => {
                const url = prompt("URL do link:");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              active={editor.isActive("link")}
              title="Adicionar Link"
            >
              <Link2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => setOpenImageUpload(true)} title="Upload de Imagem">
              <ImageIcon className="h-4 w-4" />
            </ToolBtn>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-0.5">
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
              <Undo className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer">
              <Redo className="h-4 w-4" />
            </ToolBtn>
          </div>
        </div>

        <div className="wiki-prose-render p-4 min-h-[250px] max-h-[70vh] overflow-y-auto overflow-x-hidden cursor-text">
          <EditorContent editor={editor} />
        </div>

        <Dialog open={openImageUpload} onOpenChange={setOpenImageUpload}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar imagem para a Wiki</DialogTitle>
            </DialogHeader>
            <ImageUpload
              bucket="crests"
              folder="wiki"
              onChange={(url) => {
                if (url) {
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "resizableImage",
                      attrs: { src: url, width: 400 },
                    })
                    .run();
                  setOpenImageUpload(false);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
