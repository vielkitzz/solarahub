import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Node, mergeAttributes } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Trash2,
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
      as="div" // Mudado para div para melhor controle de bloco
      className="relative group my-4 select-none flex justify-center"
      data-drag-handle
    >
      <div className="relative" style={{ width: width ? `${width}px` : "auto", maxWidth: "100%" }}>
        <button
          onClick={deleteNode}
          className="absolute -top-2 -right-2 z-20 h-6 w-6 rounded-full bg-destructive text-white items-center justify-center shadow-lg hidden group-hover:flex"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <span
          onMouseDown={(e) => onMouseDown(e, "left")}
          className={`absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-ew-resize bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
        />

        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          className={`rounded-lg border w-full h-auto block ${selected ? "ring-2 ring-primary border-transparent" : "border-border"}`}
          draggable={false}
        />

        <span
          onMouseDown={(e) => onMouseDown(e, "right")}
          className={`absolute right-0 top-0 bottom-0 w-1.5 z-10 cursor-ew-resize bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
        />

        {/* Presets simplificados para não vazar */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-2 bg-background border rounded-md px-2 py-1 shadow-sm z-30">
          {[200, 400, 600].map((w) => (
            <button
              key={w}
              onClick={() => updateAttributes({ width: w })}
              className="text-[10px] font-medium hover:text-primary"
            >
              {w === 200 ? "P" : w === 400 ? "M" : "G"}
            </button>
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block", // Mudado para block para evitar problemas de linha
  draggable: true,
  atom: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: null }, width: { default: 400 } };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, { style: `width:${HTMLAttributes.width}px; max-width:100%; height:auto;` }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

// Estilos para forçar o scroll e conter elementos
const tiptapStyles = `
  [&_.tiptap]:outline-none
  [&_.tiptap]:min-h-[200px]
  [&_p]:mb-4
  [&_img]:max-w-full
  [&_img]:h-auto
`;

export function RichEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Conte a história...",
}: RichEditorProps) {
  const [openImageUpload, setOpenImageUpload] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      ResizableImage,
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  if (!editable) {
    return (
      <div className={`overflow-hidden break-words ${tiptapStyles}`} dangerouslySetInnerHTML={{ __html: content }} />
    );
  }

  return (
    <div className="flex flex-col border rounded-lg bg-card max-h-[500px]">
      {/* Toolbar fixa no topo */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/20 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-muted" : ""}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-muted" : ""}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpenImageUpload(true)}>
          <ImageIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Área de edição com scroll forçado */}
      <div className={`p-4 overflow-y-auto overflow-x-hidden ${tiptapStyles}`}>
        <EditorContent editor={editor} />
      </div>

      <Dialog open={openImageUpload} onOpenChange={setOpenImageUpload}>
        <DialogContent>
          <ImageUpload
            bucket="crests"
            folder="wiki"
            onChange={(url) => {
              if (url) {
                editor
                  .chain()
                  .focus()
                  .insertContent({ type: "resizableImage", attrs: { src: url, width: 400 } })
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
