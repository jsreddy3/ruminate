import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChatBubbleLeftEllipsisIcon,
  BookOpenIcon,
  PencilSquareIcon,
  SparklesIcon,
  // Alternative icons
  ChatBubbleOvalLeftEllipsisIcon,
  DocumentTextIcon,
  PencilIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  StarIcon,
  HandRaisedIcon,
  QuestionMarkCircleIcon,
  TagIcon
} from '@heroicons/react/24/solid';
import { MessageSquare, Book, PenTool, Lightbulb, Palette } from 'lucide-react';

// Additional icon options
const ICON_OPTIONS = {
  conversations: [
    { icon: <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />, name: 'Chat Bubble (current)' },
    { icon: <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />, name: 'Oval Chat' },
    { icon: <HandRaisedIcon className="w-4 h-4" />, name: 'Hand Raised' },
    { icon: <QuestionMarkCircleIcon className="w-4 h-4" />, name: 'Question Circle' },
    { icon: <MessageSquare className="w-4 h-4" />, name: 'Message Square (Lucide)' },
    { icon: <div style={{ fontSize: '14px', fontFamily: 'serif' }}>◊</div>, name: 'Diamond Symbol' },
  ],
  definitions: [
    { icon: <BookOpenIcon className="w-4 h-4" />, name: 'Book Open (current)' },
    { icon: <MagnifyingGlassIcon className="w-4 h-4" />, name: 'Magnifying Glass' },
    { icon: <DocumentTextIcon className="w-4 h-4" />, name: 'Document Text' },
    { icon: <BookmarkIcon className="w-4 h-4" />, name: 'Bookmark' },
    { icon: <Book className="w-4 h-4" />, name: 'Book (Lucide)' },
    { icon: <div style={{ fontSize: '14px', fontFamily: 'serif' }}>◈</div>, name: 'Diamond Dot' },
  ],
  annotations: [
    { icon: <PencilSquareIcon className="w-4 h-4" />, name: 'Pencil Square (current)' },
    { icon: <PencilIcon className="w-4 h-4" />, name: 'Pencil' },
    { icon: <TagIcon className="w-4 h-4" />, name: 'Tag' },
    { icon: <PenTool className="w-4 h-4" />, name: 'Pen Tool (Lucide)' },
    { icon: <div style={{ fontSize: '14px', fontFamily: 'serif' }}>✱</div>, name: 'Star Symbol' },
    { icon: <div style={{ fontSize: '14px', fontFamily: 'serif' }}>※</div>, name: 'Reference Mark' },
  ],
  generatedNotes: [
    { icon: <SparklesIcon className="w-4 h-4" />, name: 'Sparkles (current)' },
    { icon: <StarIcon className="w-4 h-4" />, name: 'Star' },
    { icon: <LightBulbIcon className="w-4 h-4" />, name: 'Light Bulb' },
    { icon: <Lightbulb className="w-4 h-4" />, name: 'Lightbulb (Lucide)' },
    { icon: <div style={{ fontSize: '14px', fontFamily: 'serif' }}>✦</div>, name: 'Four-Point Star' },
    { icon: <div style={{ fontSize: '14px', fontFamily: 'serif' }}>❋</div>, name: 'Rotated Fleuron' },
  ]
};

// Count badge variations
const COUNT_STYLES = [
  {
    name: 'Current (Mahogany Circle)',
    style: {
      position: 'absolute' as const,
      top: '-4px',
      right: '-4px',
      background: 'linear-gradient(135deg, #8b4513 0%, #6b3410 100%)',
      color: 'white',
      borderRadius: '50%',
      width: '14px',
      height: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '8px',
      fontWeight: 'bold',
      border: '1.5px solid rgba(254, 252, 247, 0.9)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      zIndex: 1
    }
  },
  {
    name: 'Gold Elegant',
    style: {
      position: 'absolute' as const,
      top: '-6px',
      right: '-6px',
      background: 'linear-gradient(135deg, #f9cf5f 0%, #e6b84f 100%)',
      color: '#2c3830',
      borderRadius: '50%',
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '9px',
      fontWeight: '600',
      border: '2px solid rgba(254, 252, 247, 0.95)',
      boxShadow: '0 2px 4px rgba(249, 207, 95, 0.3)',
      zIndex: 1,
      fontFamily: 'serif'
    }
  },
  {
    name: 'Parchment Badge',
    style: {
      position: 'absolute' as const,
      top: '-8px',
      right: '-8px',
      background: '#fef9ed',
      color: '#af5f37',
      borderRadius: '4px',
      minWidth: '18px',
      height: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '9px',
      fontWeight: 'bold',
      border: '1px solid #af5f37',
      boxShadow: '0 1px 2px rgba(175, 95, 55, 0.2)',
      zIndex: 1,
      padding: '0 4px'
    }
  },
  {
    name: 'Forest Minimal',
    style: {
      position: 'absolute' as const,
      top: '-5px',
      right: '-5px',
      background: '#5a735f',
      color: 'white',
      borderRadius: '8px',
      minWidth: '14px',
      height: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '8px',
      fontWeight: '500',
      border: 'none',
      boxShadow: '0 1px 3px rgba(90, 115, 95, 0.4)',
      zIndex: 1
    }
  },
  {
    name: 'Typography Style',
    style: {
      position: 'absolute' as const,
      top: '-3px',
      right: '-3px',
      background: 'none',
      color: '#af5f37',
      borderRadius: '0',
      minWidth: 'auto',
      height: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: 'bold',
      border: 'none',
      boxShadow: 'none',
      zIndex: 1,
      fontFamily: 'serif',
      textShadow: '0 1px 1px rgba(175, 95, 55, 0.3)'
    }
  }
];

const IconTestDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof ICON_OPTIONS>('conversations');

  const TestBadge: React.FC<{ icon: React.ReactNode; countStyle: any; count: number }> = ({ icon, countStyle, count }) => (
    <div 
      style={{
        width: '20px',
        height: '20px',
        background: 'linear-gradient(135deg, #af5f37 0%, #8b4513 100%)',
        borderRadius: '50%',
        border: '1.5px solid rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        margin: '8px'
      }}
    >
      {icon}
      {count > 0 && (
        <div style={countStyle}>
          {count > 99 ? '99+' : count}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Floating test button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-library-mahogany-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-library-mahogany-600 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="flex items-center gap-2">
          Test Icons <Palette className="w-4 h-4" />
        </span>
      </motion.button>

      {/* Dialog */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface-paper rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif text-reading-primary">Icon & Count Style Testing</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-reading-muted hover:text-reading-primary text-xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Category Selection */}
              <div className="mb-6">
                <div className="flex gap-2 mb-4">
                  {Object.keys(ICON_OPTIONS).map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category as keyof typeof ICON_OPTIONS)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedCategory === category
                          ? 'bg-library-mahogany-500 text-white'
                          : 'bg-surface-vellum text-reading-secondary hover:bg-library-cream-200'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Options */}
              <div className="mb-8">
                <h3 className="text-lg font-serif text-reading-primary mb-4">Icon Options</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ICON_OPTIONS[selectedCategory].map((option, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-library-sage-200 rounded-lg bg-surface-parchment">
                      <TestBadge icon={option.icon} countStyle={COUNT_STYLES[0].style} count={5} />
                      <span className="text-sm text-reading-secondary">{option.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Count Style Options */}
              <div>
                <h3 className="text-lg font-serif text-reading-primary mb-4">Count Badge Styles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {COUNT_STYLES.map((countStyle, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-library-sage-200 rounded-lg bg-surface-parchment">
                      <TestBadge 
                        icon={<BookOpenIcon className="w-4 h-4" />} 
                        countStyle={countStyle.style} 
                        count={12} 
                      />
                      <div>
                        <div className="text-sm font-medium text-reading-primary">{countStyle.name}</div>
                        <div className="text-xs text-reading-muted">Count: 12</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Examples */}
              <div className="mt-8 p-4 bg-surface-vellum rounded-lg">
                <h3 className="text-lg font-serif text-reading-primary mb-4">Live Examples with Different Counts</h3>
                <div className="flex gap-6 flex-wrap">
                  {[1, 5, 12, 99, 150].map(count => (
                    <div key={count} className="text-center">
                      <TestBadge 
                        icon={<SparklesIcon className="w-4 h-4" />} 
                        countStyle={COUNT_STYLES[1].style} 
                        count={count} 
                      />
                      <div className="text-xs text-reading-muted mt-1">Count: {count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default IconTestDialog;