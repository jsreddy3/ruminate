import React from 'react';

interface PDFLoadingUIProps {
  percentages: number;
  pdfLoadingState: 'idle' | 'loading' | 'loaded' | 'error' | 'stuck';
  pdfFile: string;
  onForceRefresh: () => void;
}

export function PDFLoadingUI({ 
  percentages, 
  pdfLoadingState, 
  pdfFile,
  onForceRefresh 
}: PDFLoadingUIProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
      <div className="bg-gradient-to-br from-surface-paper to-library-cream-100 rounded-journal shadow-shelf p-10 max-w-md w-full mx-6 border border-library-sage-200 backdrop-blur-paper">
        {percentages === 0 || pdfLoadingState === 'stuck' ? (
          <div className="text-center">
            {pdfLoadingState === 'stuck' ? (
              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-mahogany-100 to-library-mahogany-200 rounded-full flex items-center justify-center border border-library-mahogany-300 shadow-paper">
                  <svg className="w-8 h-8 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-semibold text-reading-primary mb-3">Manuscript Loading Delayed</h3>
                  <p className="text-reading-secondary text-sm mb-6 leading-relaxed">The manuscript is taking longer than expected to prepare. This may occur with particularly large or complex documents.</p>
                </div>
                <button 
                  onClick={onForceRefresh}
                  className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-library-mahogany-500 to-library-mahogany-600 text-library-cream-50 font-serif font-medium rounded-book hover:from-library-mahogany-600 hover:to-library-mahogany-700 focus:outline-none focus:ring-2 focus:ring-library-gold-400 focus:ring-offset-2 transition-all duration-300 shadow-book hover:shadow-shelf"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reload Manuscript
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-gold-100 to-library-gold-200 rounded-full flex items-center justify-center border border-library-gold-300 shadow-paper">
                  <svg className="w-8 h-8 text-library-mahogany-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-semibold text-reading-primary mb-2">Preparing Manuscript</h3>
                  <p className="text-reading-secondary text-sm leading-relaxed">
                    {pdfFile.startsWith('data:application/pdf;base64,') 
                      ? `Processing ${((pdfFile.length * 0.75) / (1024 * 1024)).toFixed(1)}MB manuscript for scholarly review...`
                      : 'Retrieving manuscript from the library...'
                    }
                  </p>
                </div>
                <div className="w-full bg-library-sage-200 rounded-full h-2 shadow-inner">
                  <div className="bg-gradient-to-r from-library-gold-400 to-library-mahogany-400 h-2 rounded-full animate-pulse shadow-sm" style={{ width: '35%' }}></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-forest-100 to-library-forest-200 rounded-full flex items-center justify-center border border-library-forest-300 shadow-paper">
              <svg className="w-8 h-8 text-library-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-reading-primary mb-2">Rendering Pages</h3>
              <p className="text-reading-secondary text-sm mb-6 leading-relaxed">Carefully preparing each page for scholarly examination...</p>
            </div>
            <div className="space-y-3">
              <div className="w-full bg-library-sage-200 rounded-full h-3 shadow-inner">
                <div
                  className="h-3 bg-gradient-to-r from-library-gold-400 via-library-mahogany-400 to-library-forest-500 rounded-full transition-all duration-700 ease-out shadow-sm"
                  style={{ width: `${Math.round(percentages)}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="text-sm font-serif font-medium text-reading-primary">
                  {Math.round(percentages)}% Complete
                </div>
                <div className="w-1 h-1 bg-library-gold-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}