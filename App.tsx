import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Rectangle, RfiData } from './types';
import { UploadIcon, TrashIcon, LinkIcon, ArrowUpTrayIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingOutIcon, XMarkIcon } from './components/Icons';
import Toolbar from './components/Toolbar';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';
type ActiveTool = 'select' | 'shape' | 'pen' | 'arrow' | 'text' | 'distance' | 'drawing' | 'issue';

interface ViewTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface InteractionState {
  type: 'none' | 'drawing' | 'moving' | 'resizing' | 'marquee' | 'panning';
  startPoint?: { x: number; y: number }; // In percentage for drawing/move/resize, in client pixels for panning
  initialRects?: Rectangle[];
  handle?: ResizeHandle;
  initialTransform?: ViewTransform;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [selectedRectIds, setSelectedRectIds] = useState<string[]>([]);
  const [hoveredRectId, setHoveredRectId] = useState<string | null>(null);
  const [linkMenuRectId, setLinkMenuRectId] = useState<string | null>(null);
  const [currentRect, setCurrentRect] = useState<Omit<Rectangle, 'id'> | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<Omit<Rectangle, 'id'> | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>({ type: 'none' });
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [activeShape, setActiveShape] = useState<'cloud' | 'box' | 'ellipse'>('box');
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, translateX: 0, translateY: 0 });
  const [isRfiPanelOpen, setIsRfiPanelOpen] = useState(false);
  const [rfiTargetRectId, setRfiTargetRectId] = useState<string | null>(null);
  const [rfiFormData, setRfiFormData] = useState({ title: '', type: 'General Inquiry', question: '' });
  const [isRfiEditMode, setIsRfiEditMode] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Reset state for new image
        setRectangles([]);
        setSelectedRectIds([]);
        setHoveredRectId(null);
        setLinkMenuRectId(null);
        setInteraction({ type: 'none' });
        setViewTransform({ scale: 1, translateX: 0, translateY: 0 });
        setCurrentRect(null);
        setMarqueeRect(null);
        setImageSrc(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      // Allows re-uploading the same file
      event.target.value = '';
    }
  };

  const getRelativeCoords = useCallback((event: React.MouseEvent | WheelEvent): { x: number; y: number } | null => {
    if (!imageContainerRef.current) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const imageX = (mouseX - viewTransform.translateX) / viewTransform.scale;
    const imageY = (mouseY - viewTransform.translateY) / viewTransform.scale;

    const x = (imageX / rect.width) * 100;
    const y = (imageY / rect.height) * 100;

    return { x, y };
  }, [viewTransform]);

  const getScreenRect = useCallback((rect: Omit<Rectangle, 'id'> | Rectangle): { left: number; top: number; width: number; height: number; } => {
    if (!imageContainerRef.current) return { left: 0, top: 0, width: 0, height: 0 };
    const containerRect = imageContainerRef.current.getBoundingClientRect();

    const pixelX = (rect.x / 100) * containerRect.width;
    const pixelY = (rect.y / 100) * containerRect.height;
    const pixelWidth = (rect.width / 100) * containerRect.width;
    const pixelHeight = (rect.height / 100) * containerRect.height;

    return {
      left: pixelX * viewTransform.scale + viewTransform.translateX,
      top: pixelY * viewTransform.scale + viewTransform.translateY,
      width: pixelWidth * viewTransform.scale,
      height: pixelHeight * viewTransform.scale,
    };
  }, [viewTransform]);

  const normalizeRect = (rect: Omit<Rectangle, 'id'> | Rectangle): Rectangle => {
    const newRect = { ...rect, id: 'id' in rect ? rect.id : '' };
    if (newRect.width < 0) {
      newRect.x = newRect.x + newRect.width;
      newRect.width = Math.abs(newRect.width);
    }
    if (newRect.height < 0) {
      newRect.y = newRect.y + newRect.height;
      newRect.height = Math.abs(newRect.height);
    }
    return newRect;
  };

  const handleResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>, rectId: string, handle: ResizeHandle) => {
    event.stopPropagation();
    const startPoint = getRelativeCoords(event);
    const rectToResize = rectangles.find(r => r.id === rectId);
    if (!startPoint || !rectToResize) return;

    setLinkMenuRectId(null);
    setInteraction({ type: 'resizing', startPoint, initialRects: [rectToResize], handle });
  }, [getRelativeCoords, rectangles]);

  const handleRfiCancel = useCallback(() => {
    setIsRfiPanelOpen(false);
    setRfiTargetRectId(null);
    setRfiFormData({ title: '', type: 'General Inquiry', question: '' });
    setIsRfiEditMode(false);
  }, []);
  
  const handleOpenRfiPanel = useCallback((rectId: string) => {
    const targetRect = rectangles.find(r => r.id === rectId);
    if (!targetRect) return;
    
    if (targetRect.rfi) {
        // Editing existing RFI
        setRfiFormData({title: targetRect.rfi.title, type: targetRect.rfi.type, question: targetRect.rfi.question});
        setIsRfiEditMode(true);
    } else {
        // Creating new RFI
        setRfiFormData({ title: '', type: 'General Inquiry', question: '' });
        setIsRfiEditMode(false);
    }
    
    setRfiTargetRectId(rectId);
    setIsRfiPanelOpen(true);
    setLinkMenuRectId(null);
  }, [rectangles]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (interaction.type !== 'none') return;
    
    if (event.button === 1) { 
        event.preventDefault();
        setInteraction({
            type: 'panning',
            startPoint: { x: event.clientX, y: event.clientY },
            initialTransform: viewTransform
        });
        return;
    }
    
    const coords = getRelativeCoords(event);
    if (!coords) return;

    const clickedRect = [...rectangles].reverse().find(rect => {
      const normalized = normalizeRect(rect);
      return coords.x >= normalized.x && coords.x <= normalized.x + normalized.width &&
             coords.y >= normalized.y && coords.y <= normalized.y + normalized.height;
    });

    if (activeTool === 'select') {
      setLinkMenuRectId(null);
      if (clickedRect) {
        const isSelected = selectedRectIds.includes(clickedRect.id);
        let newSelectedIds: string[];
        if (event.shiftKey) {
          newSelectedIds = isSelected ? selectedRectIds.filter(id => id !== clickedRect.id) : [...selectedRectIds, clickedRect.id];
        } else {
          newSelectedIds = isSelected ? selectedRectIds : [clickedRect.id];
        }
        setSelectedRectIds(newSelectedIds);
        const rectsToMove = rectangles.filter(r => newSelectedIds.includes(r.id));
        setInteraction({ type: 'moving', startPoint: coords, initialRects: rectsToMove });
      } else {
        if (viewTransform.scale > 1) {
            setInteraction({
                type: 'panning',
                startPoint: { x: event.clientX, y: event.clientY },
                initialTransform: viewTransform
            });
        } else {
            setSelectedRectIds([]);
            setInteraction({ type: 'marquee', startPoint: coords });
            setMarqueeRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
        }
      }
    } else if (activeTool === 'shape') {
      if (clickedRect) {
        setSelectedRectIds([clickedRect.id]);
        setLinkMenuRectId(null);
        setInteraction({ type: 'moving', startPoint: coords, initialRects: [clickedRect] });
      } else {
        if (isRfiPanelOpen) {
          handleRfiCancel();
        }
        setLinkMenuRectId(null);
        setSelectedRectIds([]);
        setInteraction({ type: 'drawing', startPoint: coords });
        setCurrentRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
      }
    }
  }, [getRelativeCoords, interaction.type, rectangles, activeTool, selectedRectIds, viewTransform, isRfiPanelOpen, handleRfiCancel]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const coords = getRelativeCoords(event);
    if (!coords && interaction.type !== 'panning') return;

    if (interaction.type === 'none' && (activeTool === 'select' || activeTool === 'shape') && coords) {
      const rectUnderMouse = [...rectangles].reverse().find(rect => {
        const normalized = normalizeRect(rect);
        return coords.x >= normalized.x && coords.x <= normalized.x + normalized.width &&
               coords.y >= normalized.y && coords.y <= normalized.y + normalized.height
      });
      setHoveredRectId(rectUnderMouse ? rectUnderMouse.id : null);
    }
    
    if (interaction.type === 'panning') {
        if (!interaction.startPoint || !interaction.initialTransform) return;
        const dx = event.clientX - interaction.startPoint.x;
        const dy = event.clientY - interaction.startPoint.y;
        setViewTransform({
            scale: interaction.initialTransform.scale,
            translateX: interaction.initialTransform.translateX + dx,
            translateY: interaction.initialTransform.translateY + dy,
        });
        return;
    }

    if (interaction.type === 'none' || !interaction.startPoint || !coords) return;
    
    const dx = coords.x - interaction.startPoint.x;
    const dy = coords.y - interaction.startPoint.y;

    switch (interaction.type) {
      case 'drawing':
      case 'marquee': {
        const newWidth = coords.x - interaction.startPoint.x;
        const newHeight = coords.y - interaction.startPoint.y;
        const rectToUpdate = { x: interaction.startPoint.x, y: interaction.startPoint.y, width: newWidth, height: newHeight };
        if (interaction.type === 'drawing') {
          setCurrentRect(rectToUpdate);
        } else {
          setMarqueeRect(rectToUpdate);
        }
        break;
      }
      case 'moving': {
        if (!interaction.initialRects) return;
        setRectangles(rects => rects.map(r => {
          const initial = interaction.initialRects?.find(ir => ir.id === r.id);
          if (initial) {
            return { ...r, x: initial.x + dx, y: initial.y + dy };
          }
          return r;
        }));
        break;
      }
      case 'resizing': {
        if (!interaction.initialRects || !interaction.handle) return;
        const initialRect = interaction.initialRects[0];
        const { x, y, width, height } = initialRect;
        let newRect = { ...initialRect };

        if (interaction.handle.includes('l')) {
          newRect.x = x + dx;
          newRect.width = width - dx;
        }
        if (interaction.handle.includes('r')) {
          newRect.width = width + dx;
        }
        if (interaction.handle.includes('t')) {
          newRect.y = y + dy;
          newRect.height = height - dy;
        }
        if (interaction.handle.includes('b')) {
          newRect.height = height + dy;
        }

        setRectangles(rects => rects.map(r => r.id === newRect.id ? newRect : r));
        break;
      }
    }
  }, [getRelativeCoords, interaction, activeTool, rectangles]);

  const handleMouseUp = useCallback(() => {
    if (interaction.type === 'none') return;
  
    if (interaction.type === 'drawing' && currentRect) {
      const normalized = normalizeRect(currentRect);
      if (normalized.width > 1 && normalized.height > 1) {
        const newRect = { ...normalized, id: Date.now().toString() };
        setRectangles(prev => [...prev, newRect]);
        setSelectedRectIds([newRect.id]);
      }
    } else if (interaction.type === 'marquee' && marqueeRect) {
      const normalizedMarquee = normalizeRect(marqueeRect);
      const selected = rectangles.filter(rect => {
        const normalizedRect = normalizeRect(rect);
        return normalizedRect.x < normalizedMarquee.x + normalizedMarquee.width &&
               normalizedRect.x + normalizedRect.width > normalizedMarquee.x &&
               normalizedRect.y < normalizedMarquee.y + normalizedMarquee.height &&
               normalizedRect.y + normalizedRect.height > normalizedMarquee.y;
      });
      setSelectedRectIds(selected.map(r => r.id));
    } else if (interaction.type === 'resizing' && interaction.initialRects) {
      const rectToNormalize = rectangles.find(r => r.id === interaction.initialRects?.[0].id);
      if (rectToNormalize) {
        const normalized = normalizeRect(rectToNormalize);
        setRectangles(rects => rects.map(r => (r.id === normalized.id ? normalized : r)));
      }
    }
  
    setInteraction({ type: 'none' });
    setCurrentRect(null);
    setMarqueeRect(null);
  }, [interaction, currentRect, marqueeRect, rectangles]);
  

  const handleMouseLeave = useCallback(() => {
    setHoveredRectId(null);
    if (interaction.type !== 'none') {
      handleMouseUp();
    }
  }, [interaction.type, handleMouseUp]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!imageContainerRef.current) return;

    const { scale, translateX, translateY } = viewTransform;
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    const imageX = (mouseX - translateX) / scale;
    const imageY = (mouseY - translateY) / scale;

    const delta = e.deltaY * -0.005;
    const newScale = Math.max(MIN_ZOOM, Math.min(scale + delta, MAX_ZOOM));
    
    const newTranslateX = mouseX - imageX * newScale;
    const newTranslateY = mouseY - imageY * newScale;

    setViewTransform({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
  }, [viewTransform]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!imageContainerRef.current) return;
    if (direction === 'reset') {
        setViewTransform({ scale: 1, translateX: 0, translateY: 0 });
        return;
    }

    const { scale, translateX, translateY } = viewTransform;
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    const imageX = (centerX - translateX) / scale;
    const imageY = (centerY - translateY) / scale;
    
    const newScale = direction === 'in' 
        ? Math.min(scale * 1.2, MAX_ZOOM) 
        : Math.max(scale / 1.2, MIN_ZOOM);

    const newTranslateX = centerX - imageX * newScale;
    const newTranslateY = centerY - imageY * newScale;
    
    setViewTransform({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
  };

  const handlePublishRect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    alert(`Publishing rectangle ${id}`);
    setLinkMenuRectId(null);
  };

  const handleLinkRect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLinkMenuRectId(prevId => (prevId === id ? null : id));
  };

  const handleDeleteSelected = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRectangles(rects => rects.filter(r => !selectedRectIds.includes(r.id)));
    setSelectedRectIds([]);
    setLinkMenuRectId(null);
  };

  const handleSubmenuLink = (e: React.MouseEvent, type: string, id: string) => {
    e.stopPropagation();
    if (type === 'RFI') {
      handleOpenRfiPanel(id);
    } else {
      alert(`Linking ${type} for rectangle ${id}`);
      setLinkMenuRectId(null);
    }
  };

  const handleClearRectangles = () => {
    setRectangles([]);
    setSelectedRectIds([]);
    setLinkMenuRectId(null);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRfiFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRfiFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRfiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfiTargetRectId) return;
  
    setRectangles(prevRects =>
      prevRects.map(rect => {
        if (rect.id === rfiTargetRectId) {
          const rfiData = isRfiEditMode
            ? { ...rect.rfi!, ...rfiFormData } // Update existing RFI
            : { // Create new RFI
                id: prevRects.reduce((maxId, r) => r.rfi ? Math.max(maxId, r.rfi.id) : maxId, 0) + 1,
                ...rfiFormData
              };
          return { ...rect, rfi: rfiData as RfiData };
        }
        return rect;
      })
    );
    handleRfiCancel();
  };
  
  useEffect(() => {
    // Hide menu first to allow animation to replay on selection change
    setIsMenuVisible(false);
  
    if (selectedRectIds.length === 1) {
      // Use a short timeout to allow React to apply the 'hidden' state before showing it again
      const timer = setTimeout(() => {
        setIsMenuVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [selectedRectIds]);

  const getCursorClass = () => {
    if (interaction.type === 'panning') return 'cursor-grabbing';
    switch (interaction.type) {
      case 'moving': return 'cursor-grabbing';
      case 'resizing':
        if (interaction.handle === 'tl' || interaction.handle === 'br') return 'cursor-nwse-resize';
        if (interaction.handle === 'tr' || interaction.handle === 'bl') return 'cursor-nesw-resize';
        break;
      case 'drawing':
      case 'marquee':
        return 'cursor-crosshair';
    }
    if (activeTool === 'shape') {
      if (hoveredRectId) return 'cursor-move';
      return 'cursor-crosshair';
    }
    if (activeTool === 'select') {
        if (hoveredRectId) return 'cursor-move';
        if (viewTransform.scale > 1) return 'cursor-grab';
    }
    return 'cursor-default';
  };

  const isSingleSelection = selectedRectIds.length === 1;
  const isMultiSelection = selectedRectIds.length > 1;
  const selectedRectangle = isSingleSelection ? rectangles.find(r => r.id === selectedRectIds[0]) : null;
  const lastSelectedRectangle = isMultiSelection ? rectangles.find(r => r.id === selectedRectIds[selectedRectIds.length - 1]) : null;
  
  let singleSelectionScreenRect = selectedRectangle ? getScreenRect(selectedRectangle) : null;
  let multiSelectionScreenRect = lastSelectedRectangle ? getScreenRect(lastSelectedRectangle) : null;
  let currentRectScreenRect = currentRect ? getScreenRect(currentRect) : null;
  let marqueeScreenRect = marqueeRect ? getScreenRect(normalizeRect(marqueeRect)) : null;

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col items-stretch p-4 overflow-hidden">
      <main className="w-full flex-grow flex flex-col items-center bg-gray-800 rounded-2xl shadow-2xl shadow-cyan-500/10 p-2">
        {!imageSrc ? (
          <div className="flex flex-col items-center justify-center h-full w-full border-4 border-dashed border-gray-600 rounded-xl p-8 text-center">
            <UploadIcon className="w-24 h-24 text-gray-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Upload Your Blueprint</h2>
            <p className="text-gray-400 mb-6 max-w-md">Select an image file to start highlighting.</p>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
            <button
              onClick={triggerFileUpload}
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center gap-2"
            >
              <UploadIcon className="w-5 h-5" /> Choose Image
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <div className="flex justify-end items-center mb-2 flex-wrap gap-2">
              <div className="flex gap-4">
                <button onClick={triggerFileUpload} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2">
                  <UploadIcon className="w-5 h-5" /> Change Image
                </button>
                <button onClick={handleClearRectangles} disabled={rectangles.length === 0} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-red-900 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
                  <TrashIcon className="w-5 h-5" /> Clear All
                </button>
              </div>
            </div>
            <div className="relative w-full flex-grow flex gap-4">
              <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} activeShape={activeShape} setActiveShape={setActiveShape} />
              <div
                ref={imageContainerRef}
                className={`relative w-full flex-grow overflow-hidden rounded-lg select-none bg-gray-900/50 ${getCursorClass()}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
              >
                {/* Transformed Content */}
                <div
                    className="absolute top-0 left-0 w-full h-full"
                    style={{
                        transform: `translate(${viewTransform.translateX}px, ${viewTransform.translateY}px) scale(${viewTransform.scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                  <img src={imageSrc} alt="Blueprint" className="w-full h-full object-contain pointer-events-none" />
                  {rectangles.map((rect) => {
                    const normalized = normalizeRect(rect);
                    return (
                      <div
                        key={rect.id}
                        className={`absolute ${selectedRectIds.includes(rect.id) ? 'border-4 border-red-400' : 'border-4 border-red-500'} bg-white/5`}
                        style={{
                          left: `${normalized.x}%`,
                          top: `${normalized.y}%`,
                          width: `${normalized.width}%`,
                          height: `${normalized.height}%`,
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Screen-space Overlays */}
                {singleSelectionScreenRect && (
                  <>
                    {(['tl', 'tr', 'bl', 'br'] as ResizeHandle[]).map(handle => (
                      <div
                        key={handle}
                        className="absolute w-3.5 h-3.5 bg-red-400 border-2 border-gray-900 rounded-full"
                        style={{
                          top: handle.includes('t') ? singleSelectionScreenRect.top - 8 : singleSelectionScreenRect.top + singleSelectionScreenRect.height - 8,
                          left: handle.includes('l') ? singleSelectionScreenRect.left - 8 : singleSelectionScreenRect.left + singleSelectionScreenRect.width - 8,
                          cursor: (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize',
                          pointerEvents: 'auto',
                          zIndex: 20
                        }}
                        onMouseDown={(e) => selectedRectangle && handleResizeStart(e, selectedRectangle.id, handle)}
                      />
                    ))}
                    <div
                      className={`absolute flex flex-col items-center gap-1.5 transition-opacity transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isMenuVisible ? 'opacity-100' : 'opacity-0'}`}
                      style={{
                        left: `${singleSelectionScreenRect.left + singleSelectionScreenRect.width / 2}px`,
                        top: `${singleSelectionScreenRect.top}px`,
                        transform: `translate(-50%, -100%) translateY(-10px) scale(${isMenuVisible ? 1 : 0.9})`,
                        transformOrigin: 'bottom center',
                        pointerEvents: isMenuVisible ? 'auto' : 'none',
                        zIndex: 30
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => { e.stopPropagation() }}
                    >
                      <div className="flex gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg">
                        <button onClick={(e) => selectedRectangle && handlePublishRect(e, selectedRectangle.id)} title="Publish" className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                          <ArrowUpTrayIcon className="w-5 h-5 text-white" />
                        </button>
                        <button onClick={(e) => selectedRectangle && handleLinkRect(e, selectedRectangle.id)} title="Link" className={`p-2 rounded-md transition-colors ${linkMenuRectId === selectedRectangle?.id ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                          <LinkIcon className="w-5 h-5 text-white" />
                        </button>
                        <button onClick={handleDeleteSelected} title="Delete" className="p-2 rounded-md hover:bg-red-500 transition-colors">
                          <TrashIcon className="w-5 h-5 text-white" />
                        </button>
                      </div>
                      {linkMenuRectId === selectedRectangle?.id && (
                        <div className="flex gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg text-sm">
                          {(['RFI', 'Submittal', 'Punch', 'Photo']).map(type => (
                            <button key={type} onClick={(e) => selectedRectangle && handleSubmenuLink(e, type, selectedRectangle.id)} className="px-3 py-1.5 text-white rounded-md hover:bg-cyan-600 transition-colors">{type}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {isMultiSelection && multiSelectionScreenRect && (
                  <div
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${multiSelectionScreenRect.left + multiSelectionScreenRect.width / 2}px`,
                      top: `${multiSelectionScreenRect.top}px`,
                      transform: 'translate(-50%, -100%) translateY(-10px)',
                      pointerEvents: 'auto', zIndex: 30
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => { e.stopPropagation() }}
                  >
                    <div className="flex gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg">
                      <button onClick={handleDeleteSelected} title="Delete Selected" className="p-2 rounded-md hover:bg-red-500 transition-colors"><TrashIcon className="w-5 h-5 text-white" /></button>
                    </div>
                  </div>
                )}
                {currentRectScreenRect && (
                  <div className="absolute border-2 border-dashed border-red-400 bg-red-400/20 pointer-events-none" style={currentRectScreenRect} />
                )}
                {marqueeScreenRect && (
                  <div className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none" style={marqueeScreenRect} />
                )}

                {/* RFI Labels */}
                {rectangles.map(rect => {
                    if (!rect.rfi) return null;
                    const screenRect = getScreenRect(rect);
                    if (!screenRect) return null;
                    return (
                        <div
                            key={`rfi-label-${rect.id}`}
                            className="absolute bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-sm shadow-md cursor-pointer hover:bg-blue-500 transition-colors"
                            style={{
                                left: `${screenRect.left + screenRect.width}px`,
                                top: `${screenRect.top}px`,
                                transform: 'translate(-50%, -50%)',
                                pointerEvents: 'auto',
                                zIndex: 25
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRfiPanel(rect.id);
                            }}
                        >
                            RFI-{rect.rfi.id}
                        </div>
                    );
                })}

                {/* Zoom Controls */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg">
                    <button onClick={() => handleZoom('in')} title="Zoom In" className="p-2 rounded-md hover:bg-gray-700 transition-colors"><MagnifyingGlassPlusIcon className="w-5 h-5 text-white"/></button>
                    <button onClick={() => handleZoom('out')} title="Zoom Out" className="p-2 rounded-md hover:bg-gray-700 transition-colors"><MagnifyingGlassMinusIcon className="w-5 h-5 text-white"/></button>
                    <button onClick={() => handleZoom('reset')} title="Reset View" className="p-2 rounded-md hover:bg-gray-700 transition-colors"><ArrowsPointingOutIcon className="w-5 h-5 text-white"/></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* RFI Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isRfiPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">{isRfiEditMode ? 'Edit RFI' : 'Create RFI Draft'}</h2>
                  <button onClick={handleRfiCancel} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                      <XMarkIcon className="w-6 h-6 text-gray-400" />
                  </button>
              </div>
              <form onSubmit={handleRfiSubmit} className="flex flex-col flex-grow">
                  <div className="mb-4">
                      <label htmlFor="rfi-title" className="block text-sm font-medium text-gray-300 mb-1">RFI Title</label>
                      <input type="text" name="title" id="rfi-title" value={rfiFormData.title} onChange={handleRfiFormChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                  </div>
                  <div className="mb-4">
                      <label htmlFor="rfi-type" className="block text-sm font-medium text-gray-300 mb-1">RFI Type</label>
                      <select name="type" id="rfi-type" value={rfiFormData.type} onChange={handleRfiFormChange} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                          <option>General Inquiry</option>
                          <option>Design Clarification</option>
                          <option>Material Substitution</option>
                          <option>Field Condition</option>
                      </select>
                  </div>
                  <div className="mb-4 flex-grow flex flex-col">
                      <label htmlFor="rfi-question" className="block text-sm font-medium text-gray-300 mb-1">Question</label>
                      <textarea name="question" id="rfi-question" value={rfiFormData.question} onChange={handleRfiFormChange} required rows={6} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white flex-grow resize-none focus:ring-cyan-500 focus:border-cyan-500"></textarea>
                  </div>
                  <div className="mb-4">
                      <p className="block text-sm font-medium text-gray-300 mb-1">Attachments / Linked Items</p>
                      <div className="w-full bg-gray-700 border border-dashed border-gray-600 rounded-md p-4 text-center text-gray-400">
                          <p>Attachments can be added after draft creation.</p>
                      </div>
                  </div>
                  <div className="mt-auto flex justify-end gap-4 pt-4 border-t border-gray-700">
                      <button type="button" onClick={handleRfiCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Cancel</button>
                      <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">{isRfiEditMode ? 'Save Changes' : 'Create Draft'}</button>
                  </div>
              </form>
          </div>
      </div>
    </div>
  );
};

export default App;