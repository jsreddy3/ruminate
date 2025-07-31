import React, { useEffect, useState } from 'react';

const FontTester: React.FC = () => {
  const [fontStatus, setFontStatus] = useState('Loading...');
  
  useEffect(() => {
    const checkFont = async () => {
      try {
        // Check if font is loaded
        await document.fonts.ready;
        
        // Test if Iowan Old Style is available
        const testElement = document.createElement('div');
        testElement.style.fontFamily = 'Iowan Old Style, serif';
        testElement.style.position = 'absolute';
        testElement.style.left = '-9999px';
        testElement.textContent = 'Test';
        document.body.appendChild(testElement);
        
        const computedFont = window.getComputedStyle(testElement).fontFamily;
        document.body.removeChild(testElement);
        
        setFontStatus(`Computed: ${computedFont}`);
        
      } catch (error) {
        setFontStatus(`Error: ${error}`);
      }
    };
    
    checkFont();
  }, []);
  
  return (
    <div className="fixed top-4 right-4 z-50 bg-white border-2 border-red-500 p-4 rounded shadow-lg max-w-sm">
      <h3 className="text-lg font-bold mb-4 text-red-600">Font Debug</h3>
      
      <div className="space-y-3 text-sm">
        <div className="bg-yellow-100 p-2 rounded">
          <strong>Instructions:</strong><br/>
          1. Open browser dev tools (F12)<br/>
          2. Go to Network tab<br/>
          3. Filter by "Font" or search "woff"<br/>
          4. Refresh page<br/>
          5. Check if Iowan fonts load
        </div>
        
        <div>
          <strong>Current (font-serif class):</strong>
          <p className="font-serif text-lg">The quick brown fox jumps Gy</p>
        </div>
        
        <div>
          <strong>Force Iowan Old Style:</strong>
          <p style={{ fontFamily: '"Iowan Old Style", serif' }} className="text-lg">The quick brown fox jumps Gy</p>
        </div>
        
        <div>
          <strong>Georgia comparison:</strong>
          <p style={{ fontFamily: 'Georgia, serif' }} className="text-lg">The quick brown fox jumps Gy</p>
        </div>
        
        <div className="bg-gray-100 p-2 rounded text-xs">
          <strong>Font Detection:</strong><br/>
          {fontStatus}
        </div>
        
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-500 text-white px-3 py-1 rounded text-xs"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

export default FontTester;