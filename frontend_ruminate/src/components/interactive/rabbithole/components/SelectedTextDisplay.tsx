// src/components/interactive/rabbithole/components/SelectedTextDisplay.tsx
interface SelectedTextDisplayProps {
  text: string;
}

export default function SelectedTextDisplay({ text }: SelectedTextDisplayProps) {
  return (
    <div className="p-4 bg-indigo-50 border-b border-indigo-100">
      <h3 className="text-sm font-medium text-indigo-800 mb-2">Going deeper into:</h3>
      <div className="p-3 bg-white rounded-lg border border-indigo-200 text-sm">
        {text}
      </div>
    </div>
  );
}