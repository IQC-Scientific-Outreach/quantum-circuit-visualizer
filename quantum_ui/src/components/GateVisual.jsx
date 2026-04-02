/**
 * Renders the visual inside a gate cell.
 * CNOT gets a custom SVG; all other gates render their label.
 */
const GateVisual = ({ name }) => {
    if (name === 'CNOT') {
      return (
        <svg className="w-8 h-12" viewBox="0 0 24 32" fill="none" stroke="currentColor">
          <circle cx="12" cy="6" r="3" fill="currentColor" stroke="none" />
          <line x1="12" y1="6" x2="12" y2="21" strokeWidth="1.5" />
          <circle cx="12" cy="26" r="5" strokeWidth="1.5" />
          <path d="M12 21v10M7 26h10" strokeWidth="1.5" />
        </svg>
      );
    }
    return <span>{name}</span>;
  };
  
  export default GateVisual;