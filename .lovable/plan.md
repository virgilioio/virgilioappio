

# Move Integrations into Workspace Submenu

Move the "Integrations" nav item from a top-level settings item into the Workspace collapsible submenu, after "Job Settings".

## Change

**File: `src/components/settings/SettingsSidebar.tsx`**

1. Remove the standalone `integrations` entry (currently between "My Profile" and "Departments")
2. Add `{ id: 'integrations', label: 'Integrations', icon: Plug, show: true }` as the last item in the `workspace` submenu array (after `workspace-job-settings`)
3. Update the `workspaceOpen` default state check to include `'integrations'` in the list of IDs

Final Workspace submenu order:
- Company Profile
- Members
- Job Settings
- Integrations

