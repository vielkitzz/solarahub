import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Image as TiptapImage } from "@tiptap/extension-image";
import { Node, mergeAttributes } from "@tiptap/core";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageUpload } from "@/components/ImageUpload";
import { Separator } from "@/components/ui/separator";
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
  Palette,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const getMaxWidth = useCallback(() => {
    // Obter a largura máxima disponível do container pai
    if (containerRef.current?.parentElement) {
      const parentWidth = containerRef.current.parentElement.clientWidth;
      return parentWidth - 40; // Margem de 20px de cada lado
    }
    return 600; // Valor padrão
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const maxWidth = getMaxWidth();
      startX.current = e.clientX;
      startW.current = imgRef.current?.offsetWidth ?? (typeof width === "number" ? Math.min(width, maxWidth) : 400);

      const onMove = (me: MouseEvent) => {
        const delta = direction === "right" ? me.clientX - startX.current : startX.current - me.clientX;
        let newW = Math.max(80, Math.min(startW.current + delta, maxWidth));
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
    [updateAttributes, getMaxWidth, width],
  );

  // Reajustar largura quando a janela for redimensionada
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = getMaxWidth();
      if (width && width > maxWidth) {
        updateAttributes({ width: maxWidth });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [width, updateAttributes, getMaxWidth]);

  // Largura segura que nunca ultrapassa o container
  const safeWidth = width ? Math.min(width, getMaxWidth()) : 400;

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block relative group my-4"
      style={{
        display: "inline-block",
        maxWidth: "100%",
        position: "relative",
      }}
      data-drag-handle
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        {/* Delete button */}
        <button
          onClick={deleteNode}
          className="absolute -top-2.5 -right-2.5 z-10 h-6 w-6 rounded-full bg-destructive text-destructive-foreground items-center justify-center shadow hidden group-hover:flex transition-opacity"
          title="Remover imagem"
        >
          <Trash2 className="h-3 w-3" />
        </button>

        {/* Resize handle — left */}
        <span
          onMouseDown={(e) => onMouseDown(e, "left")}
          className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-2 h-10 rounded cursor-ew-resize bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
        />

        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          style={{
            width: `${safeWidth}px`,
            maxWidth: "100%",
            height: "auto",
            display: "block",
          }}
          className={`rounded-lg border ${selected ? "ring-2 ring-primary" : "border-border"}`}
          draggable={false}
        />

        {/* Resize handle — right */}
        <span
          onMouseDown={(e) => onMouseDown(e, "right")}
          className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 w-2 h-10 rounded cursor-ew-resize bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
        />

        {/* Size presets - ajustados para não ultrapassarem */}
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-popover border border-border rounded-md px-2 py-1 shadow-md z-10 whitespace-nowrap">
          {[200, 400, 600].map((w) => {
            const maxW = getMaxWidth();
            const isDisabled = w > maxW;
            return (
              <button
                key={w}
                onClick={() => !isDisabled && updateAttributes({ width: Math.min(w, maxW) })}
                className={`text-[10px] px-1 transition-colors ${
                  isDisabled
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                disabled={isDisabled}
              >
                {w === 200 ? "P" : w === 400 ? "M" : "G"}
              </button>
            );
          })}
        </span>
      </div>
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
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        style: `width:min(${HTMLAttributes.width}px, 100%);max-width:100%;height:auto`,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

// ── Color palette ─────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "Padrão", value: "inherit" },
  { label: "Dourado", value: "#c9a84c" },
  { label: "Vermelho", value: "#ef4444" },
  { label: "Verde", value: "#22c55e" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Roxo", value: "#a855f7" },
  { label: "Laranja", value: "#f97316" },
  { label: "Cinza", value: "#6b7280" },
  { label: "Branco", value: "#ffffff" },
];

// ── Tiptap prose styles ───────────────────────────────────────────────────────

const tiptapStyles = `
  [&_.tiptap]:outline-none [&_.tiptap]:max-w-full
  [&_.tiptap_.ProseMirror]:max-w-full
  [&_.tiptap_.ProseMirror>*]:max-w-full
  [&_p]:mb-4 [&_p]:leading-relaxed
  [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4
  [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4
  [&_li]:mt-1
  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4
  [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3
  [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:text-muted-foreground
  [&_img]:rounded-lg [&_img]:my-4 [&_img]:border [&_img]:border-border [&_img]:max-w-full [&_img]:h-auto
  [&_a]:text-primary [&_a]:underline
  [&_.resizable-image-container]:max-w-full [&_.resizable-image-container]:inline-block
`;

// ── Main component ────────────────────────────────────────────────────────────

export function RichEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Conte a história do clube...",
}: RichEditorProps) {
  const [openImageUpload, setOpenImageUpload] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      TextStyle,
      Color,
      ResizableImage,
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  // ── Read-only view ──
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

  const currentColor = editor.getAttributes("textStyle").color ?? "inherit";

  return (
    <div className="rich-editor-container group border border-border rounded-xl bg-card overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-all">
      {/* TOOLBAR */}
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

        {/* Color picker */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title="Cor do texto" className="h-8 w-8 p-0 relative">
              <Palette className="h-4 w-4" />
              <span
                className="absolute bottom-1 left-1/2 -translate-x-1/2 h-[3px] w-4 rounded-full"
                style={{
                  backgroundColor: currentColor === "inherit" ? "transparent" : currentColor,
                  border: currentColor === "inherit" ? "1px solid currentColor" : "none",
                }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="grid grid-cols-3 gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => {
                    if (c.value === "inherit") {
                      editor.chain().focus().unsetColor().run();
                    } else {
                      editor.chain().focus().setColor(c.value).run();
                    }
                    setColorOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted text-xs transition-colors"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: c.value === "inherit" ? "transparent" : c.value }}
                  />
                  {c.label}
                </button>
              ))}
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

      {/* EDITOR AREA — scrollable, never overflows */}
      <div className="rich-editor-scroll p-4 min-h-[250px] max-h-[70vh] overflow-y-auto overflow-x-hidden cursor-text">
        <div className="max-w-full overflow-x-hidden">
          <EditorContent editor={editor} />
        </div>
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
