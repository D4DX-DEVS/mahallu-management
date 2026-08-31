import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX } from 'react-icons/fi';
import { menuItems, MenuItem } from '@/constants/menuItems';
import { cn } from '@/utils/cn';
import { getModalPortalTarget } from '@/utils/modalPortal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FlatMenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  breadcrumb: string[];
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Flatten menu items to make them searchable
  const flattenMenuItems = (items: MenuItem[], breadcrumb: string[] = []): FlatMenuItem[] => {
    const result: FlatMenuItem[] = [];

    items.forEach((item) => {
      const currentBreadcrumb = [...breadcrumb, item.label];

      if (item.path) {
        result.push({
          id: item.id,
          label: item.label,
          path: item.path,
          icon: item.icon,
          breadcrumb: currentBreadcrumb,
        });
      }

      if (item.children) {
        result.push(...flattenMenuItems(item.children, currentBreadcrumb));
      }
    });

    return result;
  };

  const allMenuItems = flattenMenuItems(menuItems);

  const filteredItems = search
    ? allMenuItems.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.breadcrumb.some((b) => b.toLowerCase().includes(search.toLowerCase()))
      )
    : allMenuItems;

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  const handleSelect = (item: FlatMenuItem) => {
    navigate(item.path);
    onClose();
  };

  if (!isOpen) return null;

  const { node: portalTarget, scoped } = getModalPortalTarget();

  return createPortal(
    <div
      className={cn(
        scoped ? 'absolute inset-0' : 'fixed inset-0',
        'z-50 flex items-start justify-center pt-[15vh] px-4'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-md dark:bg-black/40"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <FiSearch className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <FiX className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          ) : (
            <div className="py-2">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg',
                        index === selectedIndex
                          ? 'bg-primary-100 dark:bg-primary-900/40'
                          : 'bg-gray-100 dark:bg-gray-800'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          index === selectedIndex
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.breadcrumb.join(' > ')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">
                ↵
              </kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">
                esc
              </kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

