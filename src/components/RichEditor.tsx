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
        // Limita a largura entre 100px e 800px para evitar quebra de layout
        const newW = Math.max(100, Math.min(startW.current + delta, 800));
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
    [updateAttributes, width],
  );

  return (
    <NodeViewWrapper as="div" className="flex justify-center w-full my-6 overflow-hidden">
      <div className="relative group inline-block" style={{ width: width ? `${width}px` : "auto", maxWidth: "100%" }}>
        <button
          onClick={deleteNode}
          className="absolute -top-2 -right-2 z-30 h-6 w-6 rounded-full bg-destructive text-white items-center justify-center shadow-md hidden group-hover:flex transition-opacity"
          title="Remover imagem"
        >
          <Trash2 className="h-3 w-3" />
        </button>

        <span
          onMouseDown={(e) => onMouseDown(e, "left")}
          className={`absolute left-0 top-0 bottom-0 w-2 z-10 cursor-ew-resize bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
        />

        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          className={`rounded-lg border block w-full h-auto transition-all ${selected ? "ring-2 ring-primary border-transparent" : "border-border"}`}
          draggable={false}
        />

        <span
          onMouseDown={(e) => onMouseDown(e, "right")}
          className={`absolute right-0 top-0 bottom-0 w-2 z-10 cursor-ew-resize bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "opacity-100" : ""}`}
        />
      </div>
    </NodeViewWrapper>
  );
};

const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block",
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      width: { default: 400 },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        style: `width: ${HTMLAttributes.width}px; max-width: 100%; height: auto; display: block; margin: 0 auto;`,
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

// ── Main Component ────────────────────────────────────────────────────────────

export function RichEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Conte a história...",
}: {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}) {
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
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  // Visualização apenas leitura
  if (!editable) {
    return (
      <div className="wiki-prose break-words overflow-hidden" dangerouslySetInnerHTML={{ __html: content || "" }} />
    );
  }

  return (
    <div className="flex flex-col border rounded-lg bg-card overflow-hidden w-full h-[550px] max-h-[70vh]">
      {/* TOOLBAR FIXA */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-accent" : ""}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-accent" : ""}
          >
            <Italic className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "bg-accent" : ""}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive("heading", { level: 3 }) ? "bg-accent" : ""}
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-accent" : ""}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-accent" : ""}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "bg-accent" : ""}
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const url = prompt("URL do link:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={editor.isActive("link") ? "bg-accent" : ""}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpenImageUpload(true)}>
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ÁREA DE TEXTO COM SCROLL INTERNO */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 focus-within:outline-none">
        <style>{`
          .tiptap-editor .tiptap { outline: none; }
          .tiptap-editor .tiptap img { max-width: 100% !important; height: auto !important; }
        `}</style>
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>

      <Dialog open={openImageUpload} onOpenChange={setOpenImageUpload}>
        <DialogContent className="max-w-md">
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
