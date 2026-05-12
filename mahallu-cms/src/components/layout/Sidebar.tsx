import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { menuItems, MenuItem } from '@/constants/menuItems';
import { FiChevronRight, FiSearch } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { useLayoutStore } from '@/store/layoutStore';

interface SubMenuPanelProps {
  item: MenuItem | null;
  onClose: () => void;
  open: boolean;
}

function SubMenuPanel({ item, onClose, open }: SubMenuPanelProps) {
  const location = useLocation();
  const { isSuperAdmin, user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  if (!item || !item.children) return null;

  const userRole = user?.role || (isSuperAdmin ? 'super_admin' : null);

  const isAccessible = (menuItem: MenuItem) => {
    if (menuItem.superAdminOnly && !isSuperAdmin) return false;
    if (menuItem.allowedRoles && userRole) {
      return menuItem.allowedRoles.includes(userRole as 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member');
    }
    return true;
  };

  // Filter items based on search query
  const filterItems = (items: MenuItem[]): MenuItem[] => {
    if (!searchQuery.trim()) return items;
    
    return items.filter(child => {
      const matchesSearch = child.label.toLowerCase().includes(searchQuery.toLowerCase());
      const hasMatchingChildren = child.children?.some(subChild => 
        subChild.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return matchesSearch || hasMatchingChildren;
    });
  };

  // Group children by category or render flat
  const renderSubMenu = (items: MenuItem[]) => {
    const filteredItems = filterItems(items.filter(isAccessible));
    
    return filteredItems.map((child, index) => {
      const Icon = child.icon as React.ComponentType<{ className?: string }>;
      const isActive = child.path === location.pathname;

      if (child.children && child.children.length > 0) {
        // This is a section header with children
        const visibleChildren = child.children.filter(isAccessible);
        if (visibleChildren.length === 0) return null;

        return (
          <div key={child.id} className={cn('mb-6', index > 0 && 'mt-4')}>
            <h3 className="px-4 mb-2 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
              {child.label}
            </h3>
            <div className="space-y-0.5">
              {visibleChildren.map((subChild) => {
                // Check if this subChild itself is accessible
                if (!isAccessible(subChild)) return null;
                
                const SubIcon = subChild.icon as React.ComponentType<{ className?: string }>;
                const isSubActive = subChild.path === location.pathname;

                return (
                  <Link
                    key={subChild.id}
                    to={subChild.path || '#'}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-sm transition-colors group',
                      isSubActive
                        ? 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/30'
                    )}
                  >
                    <SubIcon className={cn('h-5 w-5', isSubActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400')} />
                    <span>{subChild.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      }

      // Regular menu item
      return (
        <Link
          key={child.id}
          to={child.path || '#'}
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-4 py-3 text-sm transition-colors group',
            isActive
              ? 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/30'
          )}
        >
          <Icon className={cn('h-5 w-5', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400')} />
          <span>{child.label}</span>
        </Link>
      );
    });
  };

  return (
    <div
      className={cn(
        'fixed left-24 top-0 z-40 h-screen w-48 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
        'transition-transform transition-opacity duration-200 ease-out will-change-transform',
        open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
      )}
    >
      <div className="flex h-full flex-col ">
        {/* Search Bar */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Section Header */}
        <div className="flex-shrink-0 px-4 py-2  border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {item.label}
          </h2>
        </div>

        {/* Submenu Items */}
        
        <nav className="flex-1 overflow-y-auto py-3">
          {renderSubMenu(item.children)}
        </nav>
      </div>
    </div>
  );
}

interface MenuItemComponentProps {
  item: MenuItem;
  isSelected: boolean;
  isAnySubmenuOpen: boolean;
  onClick: () => void;
  onDirectNavigate: () => void;
}

function MenuItemComponent({ item, isSelected, isAnySubmenuOpen, onClick, onDirectNavigate }: MenuItemComponentProps) {
  const location = useLocation();
  const { isSuperAdmin, user } = useAuthStore();
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const hasChildren = item.children && item.children.length > 0;

  const userRole = user?.role || (isSuperAdmin ? 'super_admin' : null);

  const isAccessible = () => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.allowedRoles && userRole) {
      return item.allowedRoles.includes(userRole as 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member');
    }
    return true;
  };

  if (!isAccessible()) return null;

  // Check if current path matches this item or its children
  const isActive = item.path === location.pathname || 
    (hasChildren && item.children?.some(child => 
      child.path === location.pathname || 
      child.children?.some(subChild => subChild.path === location.pathname)
    ));

  // When a submenu parent is open, only highlight that parent — suppress
  // route-based highlighting on all other items so two items don't appear
  // green at the same time.
  const shouldHighlight = isSelected || (isActive && !isAnySubmenuOpen);

  if (hasChildren) {
    return (
      <li>
        <button
          onClick={onClick}
          className={cn(
            'group w-full flex flex-col items-center justify-center py-3.5 px-2 text-xs transition-all duration-200 border-0 outline-none focus:outline-none',
            shouldHighlight
              ? 'text-primary-700 dark:text-primary-400'
              : 'text-gray-900 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          <Icon className={cn(
            'h-6 w-6 mb-1.5 transition-colors',
            shouldHighlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'
          )} />
          <span className="text-center leading-tight">{item.label}</span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={item.path || '#'}
        onClick={onDirectNavigate}
        className={cn(
          'group flex flex-col items-center justify-center py-3.5 px-2 text-xs transition-all duration-200 border-0 outline-none focus:outline-none',
          shouldHighlight
            ? 'text-primary-700 dark:text-primary-400'
            : 'text-gray-900 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
        )}
      >
        <Icon className={cn(
          'h-6 w-6 mb-1.5 transition-colors',
          shouldHighlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'
        )} />
        <span className="text-center leading-tight">{item.label}</span>
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [renderedMenuItem, setRenderedMenuItem] = useState<MenuItem | null>(null);
  const [isSubmenuPanelOpen, setIsSubmenuPanelOpen] = useState(false);
  const location = useLocation();
  const setSubmenuOpen = useLayoutStore((s) => s.setSubmenuOpen);
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);

  // Close submenu panel on route change — route-based highlighting
  // is already handled by `isActive` in MenuItemComponent
  useEffect(() => {
    setSelectedMenuItem(null);
  }, [location.pathname]);

  const handleMenuClick = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      setSelectedMenuItem(selectedMenuItem?.id === item.id ? null : item);
    }
  };

  const handleCloseSubMenu = () => {
    setSelectedMenuItem(null);
  };

  useEffect(() => {
    if (selectedMenuItem) {
      setRenderedMenuItem(selectedMenuItem);
      setIsSubmenuPanelOpen(true);
    } else {
      // Animate out, then unmount
      setIsSubmenuPanelOpen(false);
      const t = window.setTimeout(() => {
        setRenderedMenuItem(null);
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [selectedMenuItem]);

  useEffect(() => {
    // Keep content shifted while panel is animating out
    setSubmenuOpen(Boolean(renderedMenuItem));
  }, [renderedMenuItem, setSubmenuOpen]);

  return (
    <>
      {/* Main Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen w-24 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 transition-transform duration-200 ease-out",
        "md:translate-x-0",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-gray-200 dark:border-gray-800 px-2 flex-shrink-0">
            <img 
              src={LOGO_PATH} 
              alt={BRAND_NAME}
              className="h-10 w-10 object-contain"
            />
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto py-2 px-1">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <MenuItemComponent 
                  key={item.id} 
                  item={item} 
                  isSelected={selectedMenuItem?.id === item.id}
                  isAnySubmenuOpen={selectedMenuItem !== null}
                  onClick={() => handleMenuClick(item)}
                  onDirectNavigate={handleCloseSubMenu}
                />
              ))}
            </ul>
          </nav>

          {/* Status Indicator */}
          <div className="border-t border-gray-200 p-3 dark:border-gray-800 flex justify-center flex-shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm"></span>
          </div>
        </div>
      </aside>

      {/* Submenu Panel */}
      {renderedMenuItem && (
        <SubMenuPanel item={renderedMenuItem} onClose={handleCloseSubMenu} open={isSubmenuPanelOpen} />
      )}
    </>
  );
}

