import React, { useState, useEffect, useRef } from 'react';
import { TauriAPI, type TagCategory } from '@/lib/tauri-api';
import { Tags, X, Plus, Check, Pencil, Trash2, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const PRESET_COLORS = [
  { label: 'Blue', value: '#7aa2f7' },
  { label: 'Green', value: '#9ece6a' },
  { label: 'Red', value: '#f7768e' },
  { label: 'Orange', value: '#ff9e64' },
  { label: 'Purple', value: '#bb9af7' },
  { label: 'Yellow', value: '#e0af68' },
];

interface TagCategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TreeNode {
  category: TagCategory;
  children: TreeNode[];
  depth: number;
}

const buildTree = (categories: TagCategory[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const cat of categories) {
    map.set(cat.id, { category: cat, children: [], depth: 0 });
  }

  // Build tree
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      const parent = map.get(cat.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Fix depths recursively
  const setDepths = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      n.depth = depth;
      setDepths(n.children, depth + 1);
    }
  };
  setDepths(roots, 0);

  return roots;
};

const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
  const result: TreeNode[] = [];
  for (const n of nodes) {
    result.push(n);
    result.push(...flattenTree(n.children));
  }
  return result;
};

const TagCategoryDialog = ({ isOpen, onClose }: TagCategoryDialogProps) => {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].value);
  const [newParentId, setNewParentId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowAddForm(false);
    setEditingId(null);

    setLoading(true);
    TauriAPI.getTagCategories()
      .then(setCategories)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [showAddForm]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    if (
      categories.some(
        (c) => c.name.toLowerCase() === name.toLowerCase() && c.parent_id === (newParentId || null),
      )
    ) {
      setError(`Category "${name}" already exists at this level.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const cat = await TauriAPI.addTagCategory(name, newColor, newParentId || undefined);
      setCategories((prev) => [...prev, cat]);
      setNewName('');
      setNewColor(PRESET_COLORS[0].value);
      setNewParentId('');
      setShowAddForm(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await TauriAPI.updateTagCategory(id, editName || undefined, editColor || undefined);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, name: editName || c.name, color: editColor || c.color } : c,
        ),
      );
      setEditingId(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await TauriAPI.deleteTagCategory(id);
      // Orphan children (set their parent to null)
      setCategories((prev) =>
        prev
          .filter((c) => c.id !== id)
          .map((c) => (c.parent_id === id ? { ...c, parent_id: null } : c)),
      );
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const startEditing = (cat: TagCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  if (!isOpen) return null;

  const tree = buildTree(categories);
  const flatNodes = flattenTree(tree);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-xp-surface border-xp-border mx-4 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <Tags className="text-xp-text-muted h-4 w-4" />
            <h2 className="text-xp-text text-sm font-semibold">Tag Categories</h2>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1 transition-colors"
            aria-label="Close tag categories dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {/* eslint-disable-next-line no-nested-ternary */}
          {loading ? (
            <p className="text-xp-text-muted text-sm">Loading...</p>
          ) : flatNodes.length === 0 && !showAddForm ? (
            <p className="text-xp-text-muted text-sm italic">
              No tag categories yet — add one below.
            </p>
          ) : (
            <ul className="space-y-1">
              {flatNodes.map((node) => (
                <li
                  key={node.category.id}
                  className="hover:bg-xp-surface-light group flex items-center justify-between rounded px-2 py-1.5 transition-colors"
                  style={{ paddingLeft: `${8 + node.depth * 20}px` }}
                >
                  {editingId === node.category.id ? (
                    <div className="flex flex-1 items-center space-x-2">
                      <span
                        className="h-3 w-3 flex-shrink-0 cursor-pointer rounded-full border border-black border-opacity-20"
                        style={{ backgroundColor: editColor }}
                        onClick={() => {
                          const idx = PRESET_COLORS.findIndex((c) => c.value === editColor);
                          setEditColor(PRESET_COLORS[(idx + 1) % PRESET_COLORS.length].value);
                        }}
                        title="Click to cycle color"
                        aria-label="Cycle through color options"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(node.category.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="bg-xp-bg border-xp-border text-xp-text focus:ring-xp-blue focus:border-xp-blue flex-1 rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-2"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(node.category.id)}
                        className="hover:bg-xp-surface-light rounded p-1 text-green-400 transition-colors"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xp-text-muted hover:bg-xp-surface-light rounded p-1 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex min-w-0 items-center space-x-2">
                        {node.children.length > 0 && (
                          <ChevronRight className="text-xp-text-muted h-3 w-3 flex-shrink-0" />
                        )}
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full border border-black border-opacity-20"
                          style={{ backgroundColor: node.category.color }}
                        />
                        <span className="text-xp-text truncate text-sm">{node.category.name}</span>
                      </div>
                      <div className="ml-2 flex flex-shrink-0 items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEditing(node.category)}
                          className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-blue rounded p-1 transition-colors"
                          title="Edit"
                          aria-label={`Edit category ${node.category.name}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(node.category.id)}
                          className="hover:bg-xp-surface-light text-xp-text-muted rounded p-1 transition-colors hover:text-red-400"
                          title="Delete"
                          aria-label={`Delete category ${node.category.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add form */}
          {showAddForm && (
            <div className="border-xp-blue space-y-2 rounded-md border border-opacity-50 p-3">
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') setShowAddForm(false);
                }}
                className="bg-xp-bg border-xp-border text-xp-text placeholder-xp-text-muted focus:ring-xp-blue focus:border-xp-blue w-full rounded border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2"
                placeholder="Category name..."
                maxLength={50}
              />

              {/* Color picker */}
              <div className="flex items-center space-x-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c.value,
                      borderColor: newColor === c.value ? 'white' : 'transparent',
                      boxShadow: newColor === c.value ? `0 0 0 1px ${c.value}` : 'none',
                    }}
                    title={c.label}
                    aria-label={`Select ${c.label} color`}
                  >
                    {newColor === c.value && (
                      <Check className="h-2.5 w-2.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>

              {/* Parent dropdown */}
              <Select
                value={newParentId || '__none__'}
                onValueChange={(v) => setNewParentId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="No parent (root category)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent (root category)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-xp-text-muted hover:text-xp-text rounded px-2.5 py-1 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="bg-xp-blue flex items-center space-x-1 rounded px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-opacity-90 disabled:opacity-40"
                >
                  {saving ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded border border-red-400 border-opacity-30 bg-red-400 bg-opacity-10 px-2 py-1 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-t px-4 py-3">
          <span className="text-xp-text-muted text-xs">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </span>
          <div className="flex items-center space-x-2">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-xp-blue flex items-center space-x-1.5 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Category</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded px-3 py-1.5 text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagCategoryDialog;
