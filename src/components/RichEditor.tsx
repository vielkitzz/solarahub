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
      as="span"
      className="inline-block relative group my-4 select-none"
      style={{ width: width ? `min(${width}px, 100%)` : "auto", maxWidth: "100%" }}
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
        style={{ width: "100%", maxWidth: width ? `${width}px` : "100%", display: "block" }}
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

// ── Tiptap prose styles ───────────────────────────────────────────────────────

const tiptapStyles = `
  [&_.tiptap]:outline-none
  [&_p]:mb-4 [&_p]:leading-relaxed
  [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4
  [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4
  [&_li]:mt-1
  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4
  [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3
  [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:text-muted-foreground
  [&_img]:rounded-lg [&_img]:my-4 [&_img]:border [&_img]:border-border [&_img]:max-w-full
  [&_a]:text-primary [&_a]:underline
`;

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
      <div
        className={`overflow-x-hidden break-words ${tiptapStyles}`}
        dangerouslySetInnerHTML={{
          __html: content || "<p class='text-muted-foreground italic mb-0'>Sem conteúdo na wiki ainda.</p>",
        }}
      />
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Cor do texto"
              className="h-8 w-8 p-0 relative"
            >
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
                "#ffffff", "#000000", "#9ca3af", "#ef4444", "#f97316", "#f59e0b", "#eab308",
                "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
                "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#facc15", "#7c2d12",
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

      <div className={`p-4 min-h-[250px] max-h-[70vh] overflow-y-auto overflow-x-hidden cursor-text ${tiptapStyles}`}>
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
  );
}
