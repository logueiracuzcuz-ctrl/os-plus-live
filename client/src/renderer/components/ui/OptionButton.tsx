import type { ReactNode } from 'react';

interface OptionButtonProps {
children: ReactNode;
selected?: boolean;
onClick?: () => void;
disabled?: boolean;
}

export function OptionButton({
  children,
  selected = false,
  onClick,
  disabled = false,
}: OptionButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`option-button ${selected ? 'option-button--selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="option-button__content">{children}</span>
      {selected && (
        <span className="option-button__indicator" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
