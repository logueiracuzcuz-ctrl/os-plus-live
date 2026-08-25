import { User, Crown } from 'lucide-react';
import type { Participant } from '../../types';

interface ParticipantListProps {
  participants: Participant[];
  currentUserId: string;
  selectedParticipantId?: string | null;
  onSelect?: (participantId: string) => void;
}

export function ParticipantList({
  participants,
  currentUserId,
  selectedParticipantId = null,
  onSelect,
}: ParticipantListProps): React.JSX.Element {
  return (
    <div className="participant-list" role="list" aria-label="Participantes">
      {participants.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`participant-list__item${selectedParticipantId === p.id ? ' participant-list__item--selected' : ''}`}
          role="listitem"
          aria-pressed={selectedParticipantId === p.id}
          aria-label={`${p.displayName}${p.isHost ? ' — Host' : ''}${p.id === currentUserId ? ' — Você' : ''}`}
          onClick={() => onSelect?.(p.id)}
        >
          <span className="participant-list__avatar">
            {p.isHost ? <Crown size={16} /> : <User size={16} />}
          </span>
          <div className="participant-list__info">
            <span className="participant-list__name">
              {p.id === currentUserId ? `${p.displayName} — Você` : p.displayName}
            </span>
            {p.isHost && <span className="participant-list__badge">Host</span>}
          </div>
          {p.isSharing && <span className="participant-list__sharing" aria-label="Compartilhando tela" />}
        </button>
      ))}
    </div>
  );
}
