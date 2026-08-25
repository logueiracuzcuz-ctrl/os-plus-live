import { useEffect, useState } from 'react';
import type { Participant } from '../../types';
import { VideoPlaceholder } from './VideoPlaceholder';
import { RemoteVideo } from './RemoteVideo';

interface RemoteStreamGridProps {
  participants: Participant[];
  streams: ReadonlyMap<string, MediaStream>;
}

/** Responsive grid for the streams currently available from room participants. */
export function RemoteStreamGrid({ participants, streams }: RemoteStreamGridProps): React.JSX.Element {
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const sharedParticipants = participants.filter((participant) => streams.has(participant.id));
  const focusIsAvailable = focusedParticipantId !== null
    && sharedParticipants.some((participant) => participant.id === focusedParticipantId);

  useEffect(() => {
    if (focusedParticipantId && !focusIsAvailable) {
      setFocusedParticipantId(null);
    }
  }, [focusedParticipantId, focusIsAvailable]);

  if (sharedParticipants.length === 0) {
    return <VideoPlaceholder />;
  }

  const visibleParticipants = focusedParticipantId && focusIsAvailable
    ? sharedParticipants.filter((participant) => participant.id === focusedParticipantId)
    : sharedParticipants;

  return (
    <section
      className={`remote-stream-grid remote-stream-grid--count-${Math.min(sharedParticipants.length, 8)}${focusedParticipantId ? ' remote-stream-grid--focused' : ''}`}
      aria-label="Telas compartilhadas"
    >
      {visibleParticipants.map((participant) => {
        const stream = streams.get(participant.id);
        if (!stream) return null;
        return (
          <RemoteVideo
            key={participant.id}
            participantId={participant.id}
            participantName={participant.displayName}
            stream={stream}
            isFocused={focusedParticipantId === participant.id}
            onToggleFocus={(participantId) => {
              setFocusedParticipantId((currentId) => currentId === participantId ? null : participantId);
            }}
          />
        );
      })}
    </section>
  );
}
