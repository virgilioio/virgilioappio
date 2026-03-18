

# Fix: Wrap Tooltip in TooltipProvider

The `Tooltip` added for the "View full candidate profile" button is missing its required `TooltipProvider` wrapper.

## Change

**File: `src/components/candidates/CandidateProfileSheet.tsx`**

Wrap the `Tooltip` at line 918 with `<TooltipProvider>` and add `TooltipProvider` to the imports from `@/components/ui/tooltip`.

```
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      ...
    </TooltipTrigger>
    <TooltipContent>View full candidate profile</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Also need to verify the import line includes `TooltipProvider` alongside `Tooltip`, `TooltipTrigger`, `TooltipContent`.

