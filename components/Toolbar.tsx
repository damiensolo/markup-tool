import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointerIcon, PenIcon, BoxIcon, ArrowIcon, TextIcon, DistanceIcon, DrawingIcon, IssueIcon,
  CloudIcon, EllipseIcon,
} from './Icons';

type ActiveTool = 'select' | 'shape' | 'pen' | 'arrow' | 'text' | 'distance' | 'drawing' | 'issue';
type ActiveShape = 'cloud' | 'box' | 'ellipse';

interface ToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  activeShape: ActiveShape;
  setActiveShape: (shape: ActiveShape) => void;
}

const ToolButton = ({
  label,
  icon,
  isActive,
  onClick,
  hasSubmenu = false,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  hasSubmenu?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full p-2 rounded-lg transition-colors duration-200 ${
      isActive ? 'bg-cyan-600' : 'hover:bg-gray-600'
    }`}
    title={label}
  >
    <div className="w-6 h-6">{icon}</div>
    <span className="text-xs mt-1">{label}</span>
  </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setActiveTool, activeShape, setActiveShape }) => {
  const [isShapeMenuOpen, setShapeMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);

  const handleToolClick = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (tool === 'shape') {
      setShapeMenuOpen(true);
    } else {
      setShapeMenuOpen(false);
    }
  };

  const handleShapeClick = (shape: ActiveShape) => {
    setActiveShape(shape);
    setActiveTool('shape');
    setShapeMenuOpen(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node)) {
        setShapeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const tools = [
    { id: 'select', label: 'Select', icon: <MousePointerIcon /> },
    { id: 'pen', label: 'Pen', icon: <PenIcon /> },
    { id: 'shape', label: 'Box', icon: <BoxIcon />, hasSubmenu: true },
    { id: 'arrow', label: 'Arrow', icon: <ArrowIcon /> },
    { id: 'text', label: 'Text', icon: <TextIcon /> },
    { id: 'distance', label: 'Distance', icon: <DistanceIcon /> },
    { id: 'drawing', label: 'Drawing', icon: <DrawingIcon /> },
    { id: 'issue', label: 'Issue', icon: <IssueIcon /> },
  ];

  const shapeTools = [
      { id: 'cloud', label: 'Cloud', icon: <CloudIcon className="w-6 h-6" /> },
      { id: 'box', label: 'Box', icon: <BoxIcon className="w-6 h-6" /> },
      { id: 'ellipse', label: 'Ellipse', icon: <EllipseIcon className="w-6 h-6" /> },
  ];

  return (
    <div className="relative">
      <div className="flex flex-col gap-1 bg-gray-700 p-2 rounded-xl shadow-lg">
        {tools.map((tool, index) => (
            <React.Fragment key={tool.id}>
                <ToolButton
                    label={tool.label}
                    icon={tool.icon}
                    isActive={activeTool === tool.id}
                    onClick={() => handleToolClick(tool.id as ActiveTool)}
                    hasSubmenu={tool.hasSubmenu}
                />
                {(index === 0 || index === 2 || index === 7) && <hr className="border-gray-500 my-1" />}
            </React.Fragment>
        ))}
      </div>

      {isShapeMenuOpen && (
        <div
            ref={shapeMenuRef}
            className="absolute left-full top-1/3 transform -translate-y-1/3 ml-2 flex gap-1 bg-gray-700 p-2 rounded-xl shadow-lg"
        >
            {shapeTools.map(shape => (
                 <button
                    key={shape.id}
                    onClick={() => handleShapeClick(shape.id as ActiveShape)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 ${
                        activeShape === shape.id && activeTool === 'shape' ? 'bg-cyan-600' : 'hover:bg-gray-600'
                    }`}
                    title={shape.label}
                >
                    {shape.icon}
                    <span className="text-xs mt-1">{shape.label}</span>
                </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default Toolbar;