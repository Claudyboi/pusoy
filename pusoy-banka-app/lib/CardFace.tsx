export function FaceIcon({ rank, colorClass }: { rank: number; colorClass: string }) {
  const stroke = "currentColor";
  if (rank === 13) {
    // King: crown
    return (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${colorClass}`} fill="none" stroke={stroke} strokeWidth="1.5">
        <path d="M3 18h18l-1.5-9-4 3.5L12 6l-3.5 6.5-4-3.5L3 18z" fill="currentColor" fillOpacity="0.15" />
        <path d="M3 18h18l-1.5-9-4 3.5L12 6l-3.5 6.5-4-3.5L3 18z" />
        <circle cx="12" cy="4.5" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (rank === 12) {
    // Queen: fleur-de-lis-ish
    return (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${colorClass}`} fill="none" stroke={stroke} strokeWidth="1.5">
        <path
          d="M12 3c1.5 2 2.5 4 1 6.5 2-1 3.5-1 4.5 0-1 1.5-2.5 2-4 1.5 1 1.5 1 3 .5 4.5h-6c-.5-1.5-.5-3 .5-4.5-1.5.5-3 0-4-1.5 1-1 2.5-1 4.5 0-1.5-2.5-.5-4.5 1-6.5z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path d="M12 3c1.5 2 2.5 4 1 6.5 2-1 3.5-1 4.5 0-1 1.5-2.5 2-4 1.5 1 1.5 1 3 .5 4.5h-6c-.5-1.5-.5-3 .5-4.5-1.5.5-3 0-4-1.5 1-1 2.5-1 4.5 0-1.5-2.5-.5-4.5 1-6.5z" />
        <line x1="9" y1="18" x2="15" y2="18" />
      </svg>
    );
  }
  if (rank === 11) {
    // Jack: sword
    return (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${colorClass}`} fill="none" stroke={stroke} strokeWidth="1.5">
        <line x1="12" y1="3" x2="12" y2="16" />
        <path d="M12 3l2 2-2 2-2-2 2-2z" fill="currentColor" fillOpacity="0.3" />
        <line x1="7" y1="15" x2="17" y2="15" />
        <line x1="12" y1="16" x2="12" y2="21" />
      </svg>
    );
  }
  return null;
}
