import Modal from '@/components/ui/Modal';
import { FIELD_TYPES, FIELD_TYPE_ORDER, SurveyFieldType } from '../formEngine';
import { FIELD_ICONS } from '../builderOps';

const GROUPS: { title: string; categories: string[] }[] = [
  { title: 'Answers', categories: ['input'] },
  { title: 'Choices', categories: ['choice'] },
  { title: 'Uploads, tables and totals', categories: ['upload', 'structured'] },
  { title: 'Layout', categories: ['layout'] },
];

interface AddFieldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (type: SurveyFieldType) => void;
}

/** The question type picker, grouped the way an admin thinks about a form. */
export default function AddFieldDialog({ isOpen, onClose, onPick }: AddFieldDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a question" description="Choose what kind of answer you need." size="lg">
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FIELD_TYPE_ORDER.filter((type) => group.categories.includes(FIELD_TYPES[type].category)).map((type) => {
                const Icon = FIELD_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onPick(type)}
                    className="flex min-h-[52px] items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-subtle text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{FIELD_TYPES[type].label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{FIELD_TYPES[type].description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
