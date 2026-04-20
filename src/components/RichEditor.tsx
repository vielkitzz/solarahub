import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Quote, Heading2, Heading3, Link2, Image as ImageIcon, Undo, Redo, Code } from "lucide-react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export function RichEditor({ content, onChange, editable = true, placeholder = "Conte a história do clube..." }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image,
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  if (!editable) {
    return <div className="prose-solara" dangerouslySetInnerHTML={{ __html: content || "<p class='text-muted-foreground italic'>Sem conteúdo na wiki ainda.</p>" }} />;
  }

  const ToolBtn = ({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) => (
    <Button type="button" variant={active ? "default" : "ghost"} size="sm" onClick={onClick} className="h-8 w-8 p-0">
      {children}
    </Button>
  );

  return (
    <div className="border border-border rounded-lg bg-card/40 overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-secondary/40">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}><Code className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => {
          const url = prompt("URL do link:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} active={editor.isActive("link")}><Link2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => {
          const url = prompt("URL da imagem:");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}><ImageIcon className="h-4 w-4" /></ToolBtn>
        <div className="flex-1" />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></ToolBtn>
      </div>
      <div className="p-4 tiptap-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
