// src/components/interactive/rabbithole/components/RabbitholeHeader.tsx
interface RabbitholeHeaderProps {
  onClose: () => void;
}

export default function RabbitholeHeader({ onClose }: RabbitholeHeaderProps) {
  return (
    <div className="p-4 flex items-center justify-between bg-indigo-600 text-white">
      <h2 className="font-semibold">🐇 Rabbithole</h2>
      <button 
        onClick={onClose} 
        className="p-1 rounded-full hover:bg-indigo-500 text-white transition-colors duration-200"
        aria-label="Close panel"
      >
        ✕
      </button>
    </div>
  );
}