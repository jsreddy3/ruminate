interface PictureBlockProps {
  images: { [key: string]: string };
}

export default function PictureBlock({ images }: PictureBlockProps) {
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
