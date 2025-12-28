// frontend/src/components/editor/RichTextEditor.tsx
import React, { Suspense } from "react";

const RichTextEditorClient = React.lazy(() => import("./RichTextEditor.client"));

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export default function RichTextEditor(props: Props) {
  return (
    <Suspense fallback={<div className="py-2">Loading editor…</div>}>
      <RichTextEditorClient {...props} />
    </Suspense>
  );
}
