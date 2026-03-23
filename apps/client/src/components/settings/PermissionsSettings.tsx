import { Globe, RotateCcw } from 'lucide-react';
import { type AgentPermissions, type SafeAgentSettings } from '@/lib/agent-service';
import { PermToggle, SectionTitle, Divider } from './shared';

interface PermissionsSettingsProps {
  permissions: AgentPermissions;
  setPermissions: (p: AgentPermissions) => void;
  agentSettings: SafeAgentSettings;
}

const ALL_TOOLS = {
  read: [
    { name: 'read_file', label: 'Read File', desc: 'Read file contents' },
    { name: 'list_directory', label: 'List Directory', desc: 'List files in a directory' },
    { name: 'search_files', label: 'Search Files', desc: 'Glob pattern file search' },
    { name: 'search_content', label: 'Search Content', desc: 'Regex search in file contents' },
    { name: 'get_system_info', label: 'System Info', desc: 'OS and system details' },
    { name: 'search_indexed', label: 'Search Index', desc: 'Search pre-built file index' },
    { name: 'extract_document_text', label: 'Extract Text', desc: 'Extract text from documents' },
    { name: 'recall', label: 'Recall Memory', desc: 'Retrieve stored memories' },
  ],
  write: [
    { name: 'write_file', label: 'Write File', desc: 'Create or overwrite files' },
    { name: 'create_directory', label: 'Create Directory', desc: 'Create directories' },
    { name: 'rename', label: 'Rename', desc: 'Rename files or directories' },
    { name: 'delete', label: 'Delete', desc: 'Move to trash' },
    { name: 'move_file', label: 'Move File', desc: 'Move files or directories' },
    { name: 'copy_file', label: 'Copy File', desc: 'Copy files or directories' },
    { name: 'execute_command', label: 'Execute Command', desc: 'Run shell commands' },
    { name: 'execute_plan', label: 'Execute Plan', desc: 'Execute approved plans' },
  ],
};

const DEFAULT_PERMISSIONS: AgentPermissions = {
  disabled_tools: [],
  auto_approve_tools: [],
  allowed_paths: [],
  blocked_paths: [],
  custom_blocked_commands: [],
  block_internet: true,
};

const PermissionsSettings = ({
  permissions,
  setPermissions,
  agentSettings,
}: PermissionsSettingsProps) => {
  const toggleTool = (toolName: string) => {
    setPermissions({
      ...permissions,
      disabled_tools: permissions.disabled_tools.includes(toolName)
        ? permissions.disabled_tools.filter((t) => t !== toolName)
        : [...permissions.disabled_tools, toolName],
    });
  };

  const toggleAutoApprove = (toolName: string) => {
    setPermissions({
      ...permissions,
      auto_approve_tools: permissions.auto_approve_tools.includes(toolName)
        ? permissions.auto_approve_tools.filter((t) => t !== toolName)
        : [...permissions.auto_approve_tools, toolName],
    });
  };

  const addToList = (
    field: 'allowed_paths' | 'blocked_paths' | 'custom_blocked_commands',
    value: string,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (permissions[field].includes(trimmed)) return;
    setPermissions({ ...permissions, [field]: [...permissions[field], trimmed] });
  };

  const removeFromList = (
    field: 'allowed_paths' | 'blocked_paths' | 'custom_blocked_commands',
    index: number,
  ) => {
    setPermissions({
      ...permissions,
      [field]: permissions[field].filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-1">
      {/* Internet Sandbox */}
      <SectionTitle title="Network" />
      <div className="hover:bg-xp-surface-light/50 flex items-center justify-between gap-4 rounded-lg px-4 py-3 transition-colors">
        <div className="flex min-w-0 items-center gap-3">
          <Globe size={18} className="text-xp-text-secondary shrink-0" />
          <div className="min-w-0">
            <div className="text-xp-text text-sm font-medium">Block Internet Access</div>
            <div className="text-xp-text-secondary mt-0.5 text-xs leading-relaxed">
              Prevent the agent from running commands that access the network (ping, ftp, telnet,
              nslookup, URLs in arguments, etc.). Core network tools (curl, wget, ssh, nc) are
              always blocked regardless of this setting.
            </div>
          </div>
        </div>
        <PermToggle
          enabled={permissions.block_internet}
          onChange={() =>
            setPermissions({ ...permissions, block_internet: !permissions.block_internet })
          }
        />
      </div>

      <Divider />

      {/* Read Tools */}
      <SectionTitle title="Read Tools" description="Tools that run without approval" />
      <div className="grid grid-cols-1 gap-0.5">
        {ALL_TOOLS.read.map((tool) => {
          const enabled = !permissions.disabled_tools.includes(tool.name);
          return (
            <div
              key={tool.name}
              className={`hover:bg-xp-surface-light/50 flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 transition-colors ${!enabled ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="text-xp-text flex items-center gap-2 text-sm font-medium">
                  <code className="bg-xp-surface text-xp-accent/80 rounded px-1.5 py-0.5 font-mono text-[11px]">
                    {tool.name}
                  </code>
                  {tool.label}
                </div>
                <div className="text-xp-text-secondary mt-0.5 text-xs">{tool.desc}</div>
              </div>
              <PermToggle enabled={enabled} onChange={() => toggleTool(tool.name)} />
            </div>
          );
        })}
      </div>

      <Divider />
      <SectionTitle
        title="Write Tools"
        description="Tools that modify files (require approval by default)"
      />
      <div className="grid grid-cols-1 gap-0.5">
        {ALL_TOOLS.write.map((tool) => {
          const enabled = !permissions.disabled_tools.includes(tool.name);
          return (
            <div
              key={tool.name}
              className={`hover:bg-xp-surface-light/50 flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 transition-colors ${!enabled ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="text-xp-text flex items-center gap-2 text-sm font-medium">
                  <code className="bg-xp-surface text-xp-accent/80 rounded px-1.5 py-0.5 font-mono text-[11px]">
                    {tool.name}
                  </code>
                  {tool.label}
                </div>
                <div className="text-xp-text-secondary mt-0.5 text-xs">{tool.desc}</div>
              </div>
              <PermToggle enabled={enabled} onChange={() => toggleTool(tool.name)} />
            </div>
          );
        })}
      </div>

      {/* Per-tool auto-approve */}
      <Divider />
      <SectionTitle
        title="Auto-Approve Rules"
        description={
          agentSettings.auto_approve
            ? 'Global auto-approve is ON — all write tools skip approval'
            : 'Skip the approval prompt for specific write tools'
        }
      />
      {agentSettings.auto_approve ? (
        <div className="text-xp-text-secondary px-4 py-2 text-xs italic">
          Global auto-approve is enabled. Disable it in AI Agent settings to use per-tool rules.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0.5">
          {ALL_TOOLS.write.map((tool) => {
            const isDisabled = permissions.disabled_tools.includes(tool.name);
            if (isDisabled) return null;
            const autoApproved = permissions.auto_approve_tools.includes(tool.name);
            return (
              <div
                key={tool.name}
                className="hover:bg-xp-surface-light/50 flex items-center justify-between gap-4 rounded-lg px-4 py-2 transition-colors"
              >
                <div className="text-xp-text text-sm">{tool.label}</div>
                <PermToggle enabled={autoApproved} onChange={() => toggleAutoApprove(tool.name)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Allowed Paths */}
      <Divider />
      <SectionTitle
        title="Allowed Paths"
        description="If set, the agent can ONLY access these directories"
      />
      <div className="space-y-2 px-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. D:\Projects"
            className="border-xp-border bg-xp-bg text-xp-text focus:border-xp-accent focus:ring-xp-accent h-8 flex-1 rounded-md border px-3 font-mono text-sm focus:outline-none focus:ring-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addToList('allowed_paths', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addToList('allowed_paths', input.value);
              input.value = '';
            }}
            className="bg-xp-accent h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </div>
        {permissions.allowed_paths.length > 0 && (
          <div className="space-y-1">
            {permissions.allowed_paths.map((p, i) => (
              <div
                key={p}
                className="bg-xp-surface text-xp-text flex items-center justify-between gap-2 rounded-md px-3 py-1.5 font-mono text-sm"
              >
                <span className="truncate">{p}</span>
                <button
                  onClick={() => removeFromList('allowed_paths', i)}
                  className="text-xp-text-secondary shrink-0 text-xs hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked Paths */}
      <Divider />
      <SectionTitle
        title="Blocked Paths"
        description="Additional paths blocked beyond system defaults"
      />
      <div className="space-y-2 px-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. D:\Secrets"
            className="border-xp-border bg-xp-bg text-xp-text focus:border-xp-accent focus:ring-xp-accent h-8 flex-1 rounded-md border px-3 font-mono text-sm focus:outline-none focus:ring-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addToList('blocked_paths', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addToList('blocked_paths', input.value);
              input.value = '';
            }}
            className="bg-xp-accent h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </div>
        {permissions.blocked_paths.length > 0 && (
          <div className="space-y-1">
            {permissions.blocked_paths.map((p, i) => (
              <div
                key={p}
                className="bg-xp-surface text-xp-text flex items-center justify-between gap-2 rounded-md px-3 py-1.5 font-mono text-sm"
              >
                <span className="truncate">{p}</span>
                <button
                  onClick={() => removeFromList('blocked_paths', i)}
                  className="text-xp-text-secondary shrink-0 text-xs hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked Commands */}
      <Divider />
      <SectionTitle
        title="Custom Blocked Commands"
        description="Added on top of 60+ built-in blocked commands"
      />
      <div className="space-y-2 px-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. npm"
            className="border-xp-border bg-xp-bg text-xp-text focus:border-xp-accent focus:ring-xp-accent h-8 flex-1 rounded-md border px-3 font-mono text-sm focus:outline-none focus:ring-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addToList('custom_blocked_commands', e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              addToList('custom_blocked_commands', input.value);
              input.value = '';
            }}
            className="bg-xp-accent h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </div>
        {permissions.custom_blocked_commands.length > 0 && (
          <div className="space-y-1">
            {permissions.custom_blocked_commands.map((c, i) => (
              <div
                key={c}
                className="bg-xp-surface text-xp-text flex items-center justify-between gap-2 rounded-md px-3 py-1.5 font-mono text-sm"
              >
                <span className="truncate">{c}</span>
                <button
                  onClick={() => removeFromList('custom_blocked_commands', i)}
                  className="text-xp-text-secondary shrink-0 text-xs hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset */}
      <Divider />
      <div className="px-4 pt-2">
        <button
          onClick={() => setPermissions(DEFAULT_PERMISSIONS)}
          className="text-xp-text-secondary hover:text-xp-text hover:bg-xp-surface-light flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
        >
          <RotateCcw size={14} />
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

export default PermissionsSettings;
