import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointerIcon, PenIcon, BoxIcon, ArrowIcon, TextIcon, DistanceIcon, DrawingIcon,
  CloudIcon, EllipseIcon, PhotoPinIcon, SafetyPinIcon, PunchPinIcon
} from './Icons';

type ActiveTool = 'select' | 'shape' | 'pen' | 'arrow' | 'text' | 'distance' | 'drawing' | 'pin';
type ActiveShape = 'cloud' | 'box' | 'ellipse';
type ActivePinType = 'photo' | 'safety' | 'punch';

interface ToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  activeShape: ActiveShape;
  setActiveShape: (shape: ActiveShape) => void;
  activePinType: ActivePinType;
  setActivePinType: (pinType: ActivePinType) => void;
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
      isActive ? 'bg-cyan-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
    }`}
    title={label}
  >
    <div className="w-6 h-6">{icon}</div>
    <span className="text-xs mt-1">{label}</span>
  </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setActiveTool, activeShape, setActiveShape, activePinType, setActivePinType }) => {
  const [isShapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [isPinMenuOpen, setPinMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const pinMenuRef = useRef<HTMLDivElement>(null);

  const handleToolClick = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (tool === 'shape') setShapeMenuOpen(true);
    else setShapeMenuOpen(false);
    
    if (tool === 'pin') setPinMenuOpen(true);
    else setPinMenuOpen(false);
  };
  
  const handleShapeClick = (shape: ActiveShape) => {
    setActiveShape(shape);
    setActiveTool('shape');
    setShapeMenuOpen(false);
  };
  
  const handlePinClick = (pinType: ActivePinType) => {
      setActivePinType(pinType);
      setActiveTool('pin');
      setPinMenuOpen(false);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node)) {
        setShapeMenuOpen(false);
      }
      if (pinMenuRef.current && !pinMenuRef.current.contains(event.target as Node)) {
        setPinMenuOpen(false);
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
    { id: 'shape', label: 'Box', icon: <BoxIcon /> },
    { id: 'arrow', label: 'Arrow', icon: <ArrowIcon /> },
    { id: 'text', label: 'Text', icon: <TextIcon /> },
    { id: 'distance', label: 'Distance', icon: <DistanceIcon /> },
    { id: 'drawing', label: 'Drawing', icon: <DrawingIcon /> },
  ];

  const shapeTools = [
      { id: 'cloud', label: 'Cloud', icon: <CloudIcon className="w-6 h-6" /> },
      { id: 'box', label: 'Box', icon: <BoxIcon className="w-6 h-6" /> },
      { id: 'ellipse', label: 'Ellipse', icon: <EllipseIcon className="w-6 h-6" /> },
  ];

  const pinTools: { id: ActivePinType; label: string; icon: React.ReactNode }[] = [
    { id: 'photo', label: 'Photo', icon: <PhotoPinIcon className="w-6 h-6" /> },
    { id: 'safety', label: 'Safety', icon: <SafetyPinIcon className="w-6 h-6" /> },
    { id: 'punch', label: 'Punch', icon: <PunchPinIcon className="w-6 h-6" /> },
  ];

  const getActivePinTool = () => {
    return pinTools.find(p => p.id === activePinType) || pinTools[0];
  }

  return (
    <div className="relative">
      <div className="flex flex-col gap-1 bg-gray-100 dark:bg-gray-700 p-2 rounded-xl shadow-lg">
        {tools.map((tool, index) => (
            <React.Fragment key={tool.id}>
                <ToolButton
                    label={tool.label}
                    icon={tool.icon}
                    isActive={activeTool === tool.id}
                    onClick={() => handleToolClick(tool.id as ActiveTool)}
                />
                {(index === 0 || index === 2 || index === 6) && <hr className="border-gray-300 dark:border-gray-500 my-1" />}
            </React.Fragment>
        ))}
        {/* Pin Tool Flyout */}
        <div ref={pinMenuRef} className="relative">
             <button
                onClick={() => {
                    setActiveTool('pin');
                    setPinMenuOpen(prev => !prev);
                }}
                className={`relative flex flex-col items-center justify-center w-full p-2 rounded-lg transition-colors duration-200 overflow-hidden ${
                    activeTool === 'pin' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={getActivePinTool().label}
            >
                <div className="w-6 h-6">{getActivePinTool().icon}</div>
                <span className="text-xs mt-1">{getActivePinTool().label}</span>
                <svg
                  viewBox="0 0 8 8"
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 fill-current opacity-60"
                >
                  <path d="M8 8L0 8L8 0Z" />
                </svg>
            </button>
            {isPinMenuOpen && (
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 flex gap-1 bg-gray-100 dark:bg-gray-700 p-2 rounded-xl shadow-lg">
                    {pinTools.map(pin => (
                        <button
                            key={pin.id}
                            onClick={() => handlePinClick(pin.id)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 ${
                                activePinType === pin.id && activeTool === 'pin' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={pin.label}
                        >
                            {pin.icon}
                            <span className="text-xs mt-1">{pin.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
        <hr className="border-gray-300 dark:border-gray-500 my-1" />

      </div>

      {isShapeMenuOpen && (
        <div
            ref={shapeMenuRef}
            className="absolute left-full top-1/3 transform -translate-y-1/3 ml-2 flex gap-1 bg-gray-100 dark:bg-gray-700 p-2 rounded-xl shadow-lg"
        >
            {shapeTools.map(shape => (
                 <button
                    key={shape.id}
                    onClick={() => handleShapeClick(shape.id as ActiveShape)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 ${
                        activeShape === shape.id && activeTool === 'shape' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
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
