import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';

interface FormModalRouteProps {
  children: ReactNode;
}

/**
 * Gives every create/edit route the same modal treatment without coupling form
 * implementations to routing. Forms with five or fewer controls stay in one
 * column; larger forms get a two-column workspace on wider screens.
 */
export default function FormModalRoute({ children }: FormModalRouteProps) {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<'single' | 'double'>('single');

  useLayoutEffect(() => {
    const controls = contentRef.current?.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    setLayout((controls?.length ?? 0) > 5 ? 'double' : 'single');
  }, []);

  return (
    <Modal
      isOpen
      onClose={() => navigate(-1)}
      size="xl"
      showCloseButton
      disableBackdropClose
    >
      <div ref={contentRef} className={`form-modal-content form-modal-${layout}`}>
        {children}
      </div>
    </Modal>
  );
}
