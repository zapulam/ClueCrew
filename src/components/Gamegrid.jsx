import React from "react";

export function GameGrid({ words, revealed, roles, onReveal, codemasterMode }) {
  const handleCardClick = (index) => {
    if (typeof onReveal === 'function') {
      onReveal(index);
    }
  };

  const getCardStyle = (role, isRevealed) => {
    // Base button style - minHeight and fontSize overridden by className for responsive
    let buttonStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      padding: '12px',
      width: '100%',
      transition: 'background-color 0.2s ease, border-color 0.2s ease',
      cursor: 'pointer',
      border: '2px solid',
    };

    // In codemaster mode, show all colors
    if (codemasterMode) {
      switch (role) {
        case "green":
          return { ...buttonStyle, backgroundColor: '#22c55e', color: 'white', borderColor: '#16a34a' };
        case "blue":
          return { ...buttonStyle, backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb' };
        case "neutral":
          return { ...buttonStyle, backgroundColor: '#9ca3af', color: 'white', borderColor: '#6b7280' };
        case "assassin":
          return { ...buttonStyle, backgroundColor: '#000000', color: 'white', borderColor: '#374151' };
        default:
          return { ...buttonStyle, backgroundColor: '#fef3c7', color: '#1f2937', borderColor: '#fde68a' };
      }
    }
    
    // Not revealed - show yellow (base + hover via className for stability)
    if (!isRevealed) {
      return { 
        ...buttonStyle, 
        color: '#1f2937', 
        borderColor: '#fde68a',
      };
    }
    
    // Revealed - show team color
    switch (role) {
      case "green":
        return { ...buttonStyle, backgroundColor: '#22c55e', color: 'white', borderColor: '#16a34a' };
      case "blue":
        return { ...buttonStyle, backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb' };
      case "neutral":
        return { ...buttonStyle, backgroundColor: '#9ca3af', color: 'white', borderColor: '#6b7280' };
      case "assassin":
        return { ...buttonStyle, backgroundColor: '#000000', color: 'white', borderColor: '#374151' };
      default:
        return { ...buttonStyle, backgroundColor: '#fef3c7', color: '#1f2937', borderColor: '#fde68a' };
    }
  };

  if (!words || words.length === 0) {
    return <div>No words to display</div>;
  }

  return (
    <div className="grid grid-cols-5 gap-2 md:gap-4 w-full mx-auto p-2 md:p-4">
      {words.map((word, idx) => {
        const isRevealed = revealed[idx];
        const cardRole = roles[idx];
        
        return (
          <button
            key={idx}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCardClick(idx);
            }}
            style={getCardStyle(cardRole, isRevealed)}
            className={`min-h-[10vh] md:min-h-[14vh] text-xs md:text-base font-medium md:font-bold tracking-tight md:tracking-normal ${!isRevealed && !codemasterMode ? 'bg-[#fef3c7] hover:bg-[#fde68a]' : ''}`}
          >
            <span className="text-center" style={{ lineHeight: '1.2' }}>
              {word}
            </span>
          </button>
        );
      })}
    </div>
  );
}