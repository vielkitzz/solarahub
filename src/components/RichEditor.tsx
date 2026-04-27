import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Node, mergeAttributes } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { Separator } from "@/components/ui/separator";
import { Bold, Italic, List, Heading2, Image as ImageIcon, Undo, Redo, Trash2 } from "lucide-react";
import { useState, useRef, useCallback } from "react";

// ── Resizable Image Node ──────────────────────────────────────────────────────

const ResizableImageComponent = ({ node, updateAttributes, deleteNode, selected }: NodeViewProps) => {
  const { src, width } = node.attrs;
  const [resizing, setResizing] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault();
      setResizing(true);
      startX.current = e.clientX;
      // Captura a largura atual real da imagem para o cálculo
      startW.current = e.currentTarget.parentElement?.querySelector("img")?.offsetWidth || width || 400;

      const onMove = (me: MouseEvent) => {
        const delta = direction === "right" ? me.clientX - startX.current : startX.current - me.clientX;
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
    <NodeViewWrapper className="flex justify-center w-full my-4 overflow-hidden">
      <div className="relative group inline-block" style={{ width: width ? `${width}px` : "100%", maxWidth: "100%" }}>
        <button
          onClick={deleteNode}
          className="absolute -top-2 -right-2 z-30 h-6 w-6 rounded-full bg-destructive text-white items-center justify-center shadow-md hidden group-hover:flex"
        >
          <Trash2 className="h-3 w-3" />
        </button>

        {/* Alças de redimensionamento */}
        <span
          onMouseDown={(e) => onMouseDown(e, "left")}
          className="absolute left-0 top-0 bottom-0 w-2 z-10 cursor-ew-resize hover:bg-primary/20"
        />

        <img
          src={src}
          alt=""
          className={`rounded-lg border block w-full h-auto transition-shadow ${selected ? "ring-2 ring-primary" : "border-border"}`}
          draggable={false}
        />

        <span
          onMouseDown={(e) => onMouseDown(e, "right")}
          className="absolute right-0 top-0 bottom-0 w-2 z-10 cursor-ew-resize hover:bg-primary/20"
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
    return { src: { default: null }, width: { default: 400 } };
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

export function RichEditor({ content, onChange, editable = true, placeholder = "" }: any) {
  const [openImageUpload, setOpenImageUpload] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, ResizableImage],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  if (!editable) {
    return <div className="prose prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return (
    <div className="flex flex-col border rounded-lg bg-card overflow-hidden w-full h-[500px] max-h-[60vh]">
      {/* Toolbar Fixa */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/40 shrink-0">
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
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

      {/* Área de Scroll Crítica */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <style>{`
          .tiptap-wrapper .tiptap { 
            outline: none; 
            max-width: 100%;
            word-break: break-word;
          }
          .tiptap-wrapper .tiptap img { 
            max-width: 100% !important; 
            height: auto !important; 
          }
        `}</style>
        <div className="tiptap-wrapper">
          <EditorContent editor={editor} />
        </div>
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
