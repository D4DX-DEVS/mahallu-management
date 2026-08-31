import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { getModalPortalTarget } from '@/utils/modalPortal';
import Button from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  overlay?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  overlay = true,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const { node: portalTarget, scoped } = getModalPortalTarget();

  return createPortal(
    <div
      className={cn(
        scoped ? 'absolute inset-0' : 'fixed inset-0',
        'z-50 flex items-center justify-center p-4',
        overlay && 'bg-black/20 backdrop-blur-md dark:bg-black/40'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full bg-white rounded-lg shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10',
          sizeClasses[size],
          'max-h-[90vh] flex flex-col'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700"
            >
              <FiX className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
}

