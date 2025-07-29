interface PictureBlockProps {
  images: { [key: string]: string };
}

export default function PictureBlock({ images }: PictureBlockProps) {
  if (!images || Object.keys(images).length === 0) {
    return (
      <div className="p-4 border-b border-neutral-200 bg-white">
        <div className="text-center text-gray-500 italic">
          📷 Picture block detected but no image data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      {Object.entries(images).map(([key, base64Data]) => (
        <div key={key} className="flex justify-center">
          <img 
            src={`data:image/jpeg;base64,${base64Data}`}
            alt="PDF content"
            className="max-w-full h-auto rounded-lg shadow-sm"
          />
        </div>
      ))}
    </div>
  );
}
