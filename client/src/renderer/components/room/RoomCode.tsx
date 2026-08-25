import { CopyButton } from '../ui';

interface RoomCodeProps {
  code: string;
  size?: 'md' | 'lg';
}

/** Displays a room code with formatted dashes and a copy button. */
export function RoomCode({ code, size = 'md' }: RoomCodeProps): React.JSX.Element {
  const formatted = code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;

  return (
    <div className={`room-code room-code--${size}`}>
      <code className="room-code__value" aria-label={`Código da sala: ${code}`}>
        {formatted}
      </code>
      <CopyButton text={code} successMessage="Código copiado!" />
    </div>
  );
}
