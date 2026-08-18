# Code Blocks

A TypeScript block (language tag should read "TypeScript", copy button present, dark background):

```typescript
export interface TreeNode {
  name: string;
  path: string;
  title: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export function labelFor(node: TreeNode): string {
  return node.title || node.name.replace(/\.mdx?$/, "");
}
```

A shell block:

```bash
git commit -m "docs: add rendering fixtures"
git push origin main
```

A block with no language (should still render in the dark frame, tag may read "text"):

```
plain preformatted text
  with preserved   spacing
```
