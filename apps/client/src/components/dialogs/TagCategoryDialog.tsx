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

const buildTree = (categories: TagCategory[]) : TreeNode[] => {
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
  }
  setDepths(roots, 0);

  return roots;
}

const flattenTree = (nodes: TreeNode[]) : TreeNode[] => {
  const result: TreeNode[] = [];
  for (const n of nodes) {
    result.push(n);
    result.push(...flattenTree(n.children));
  }
  return result;
}

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
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-xp-border flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Tags className="w-4 h-4 text-xp-text-muted" />
            <h2 className="text-sm font-semibold text-xp-text">Tag Categories</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
            aria-label="Close tag categories dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <p className="text-sm text-xp-text-muted">Loading...</p>
          ) : flatNodes.length === 0 && !showAddForm ? (
            <p className="text-sm text-xp-text-muted italic">
              No tag categories yet — add one below.
            </p>
          ) : (
            <ul className="space-y-1">
              {flatNodes.map((node) => (
                <li
                  key={node.category.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-xp-surface-light group transition-colors"
                  style={{ paddingLeft: `${8 + node.depth * 20}px` }}
                >
                  {editingId === node.category.id ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-black border-opacity-20 cursor-pointer"
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
                        className="flex-1 bg-xp-bg border border-xp-border rounded px-2 py-0.5 text-sm text-xp-text focus:outline-none focus:ring-2 focus:ring-xp-blue focus:border-xp-blue"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(node.category.id)}
                        className="p-1 rounded text-green-400 hover:bg-xp-surface-light transition-colors"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded text-xp-text-muted hover:bg-xp-surface-light transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2 min-w-0">
                        {node.children.length > 0 && (
                          <ChevronRight className="w-3 h-3 text-xp-text-muted flex-shrink-0" />
                        )}
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 border border-black border-opacity-20"
                          style={{ backgroundColor: node.category.color }}
                        />
                        <span className="text-sm text-xp-text truncate">{node.category.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                        <button
                          onClick={() => startEditing(node.category)}
                          className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-blue transition-colors"
                          title="Edit"
                          aria-label={`Edit category ${node.category.name}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(node.category.id)}
                          className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-red-400 transition-colors"
                          title="Delete"
                          aria-label={`Delete category ${node.category.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
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
            <div className="border border-xp-blue border-opacity-50 rounded-md p-3 space-y-2">
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
                className="w-full bg-xp-bg border border-xp-border rounded px-3 py-1.5 text-sm text-xp-text placeholder-xp-text-muted focus:outline-none focus:ring-2 focus:ring-xp-blue focus:border-xp-blue transition-colors"
                placeholder="Category name..."
                maxLength={50}
              />

              {/* Color picker */}
              <div className="flex items-center space-x-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className="w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: c.value,
                      borderColor: newColor === c.value ? 'white' : 'transparent',
                      boxShadow: newColor === c.value ? `0 0 0 1px ${c.value}` : 'none',
                    }}
                    title={c.label}
                    aria-label={`Select ${c.label} color`}
                  >
                    {newColor === c.value && (
                      <Check className="w-2.5 h-2.5 text-white drop-shadow" />
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

              <div className="flex items-center space-x-2 justify-end">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 text-xs text-xp-text-muted hover:text-xp-text rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-xp-blue text-white rounded text-xs font-medium hover:bg-opacity-90 disabled:opacity-40 transition-colors"
                >
                  {saving ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400 bg-opacity-10 border border-red-400 border-opacity-30 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-xp-border flex-shrink-0">
          <span className="text-xs text-xp-text-muted">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </span>
          <div className="flex items-center space-x-2">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded transition-colors"
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
