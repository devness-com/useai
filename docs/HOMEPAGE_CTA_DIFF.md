# Homepage CTA copy diff (apply in `useai-cloud/packages/web`)

This is a pasteable diff for `useai-cloud/packages/web/src/app/(public)/page.tsx`. We don't edit it from `useai-oss` because they're separate repos.

## What changes

Two occurrences of `npx @devness/useai` in `page.tsx` need to flip to `npm install -g @devness/useai`. The `npx` line stays around as a smaller "or run once" secondary option directly below the hero CTA.

## Diff

```diff
diff --git a/packages/web/src/app/(public)/page.tsx b/packages/web/src/app/(public)/page.tsx
@@ -89,7 +89,7 @@ const STEPS = [
   {
     step: '01',
     title: 'Install',
     description: 'One command sets up the MCP server. Works with Claude Code, Cursor, Copilot, Windsurf, and 10+ AI tools.',
-    command: 'npx @devness/useai',
+    command: 'npm install -g @devness/useai',
   },
@@ -749,9 +749,17 @@
               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={heroReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                 transition={{ duration: 0.5, delay: 0.1 }}
                 className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-full sm:max-w-xl"
               >
-                <CopyCommand command="npx @devness/useai" className="w-full sm:w-auto shrink-0 px-4 sm:px-6 h-[44px] sm:h-[50px] flex items-center" />
+                <div className="flex flex-col gap-1 w-full sm:w-auto">
+                  <CopyCommand command="npm install -g @devness/useai" className="w-full sm:w-auto shrink-0 px-4 sm:px-6 h-[44px] sm:h-[50px] flex items-center" />
+                  <p className="text-xs text-muted-foreground pl-1">
+                    or run once: <code className="font-mono">npx @devness/useai</code>
+                  </p>
+                </div>
                 <PlayVideoButton onClick={() => setIsVideoOpen(true)} className="w-full sm:w-auto shrink-0 px-4 sm:px-6 h-[44px] sm:h-[50px] flex items-center justify-center" />
               </motion.div>
```

## Notes

- The `STEPS[0].command` change updates the "01 Install" step card further down the page so the two install commands stay in sync.
- The hero CTA wraps the existing `CopyCommand` in a flex column with a small secondary "or run once" line beneath it. This keeps the trial-mode npx path discoverable for users who don't want a global install yet, without crowding the primary call to action.
- Verify `text-muted-foreground` exists in the Tailwind theme used by useai-cloud — if not, swap for whatever the equivalent muted text class is in that project (`text-foreground/60` or similar).
- After applying, run the page through `pnpm dev:web` from `useai-cloud/` and visually confirm at small breakpoints.
