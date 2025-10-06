
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Rectangle, RfiData, SubmittalData, PunchData, DrawingData, PhotoData, PhotoMarkup, Pin, SafetyIssueData } from './types';
import { UploadIcon, TrashIcon, LinkIcon, ArrowUpTrayIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingOutIcon, XMarkIcon, SunIcon, MoonIcon, SafetyPinIcon, PunchPinIcon, PhotoPinIcon, InformationCircleIcon } from './components/Icons';
import Toolbar from './components/Toolbar';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';
type ActiveTool = 'select' | 'shape' | 'pen' | 'arrow' | 'text' | 'distance' | 'drawing' | 'pin';
type ActivePinType = 'photo' | 'safety' | 'punch';
type ActiveShape = 'cloud' | 'box' | 'ellipse';

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

interface HoveredItemInfo {
  type: 'rfi' | 'submittal' | 'punch' | 'drawing' | 'photo' | 'pin';
  rectId?: string;
  itemId: number | string;
  position: { top: number; left: number };
  pin?: Pin;
}

interface LinkModalConfig {
    type: 'rfi' | 'submittal' | 'punch' | 'drawing' | 'photo';
    title: string;
    items: any[];
    displayFields: { key: string; label?: string }[];
    searchFields: string[];
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

const mockSubmittals: SubmittalData[] = [
    { id: 'SUB-001', title: 'Structural Steel Shop Drawings', specSection: '05 12 00', status: 'In Review' },
    { id: 'SUB-002', title: 'Concrete Mix Design', specSection: '03 30 00', status: 'Open' },
    { id: 'SUB-003', title: 'HVAC Unit Data Sheets', specSection: '23 73 00', status: 'Closed' },
    { id: 'SUB-004', title: 'Glazing Samples', specSection: '08 80 00', status: 'In Review' },
    { id: 'SUB-005', title: 'Fireproofing Material Certificate', specSection: '07 81 00', status: 'Open' },
];
  
const mockPunches: PunchData[] = [
    { id: 'PUNCH-101', title: 'Drywall crack in Corridor A', status: 'Open', assignee: 'John Doe' },
    { id: 'PUNCH-102', title: 'Incorrect paint color in Room 203', status: 'Ready for Review', assignee: 'Jane Smith' },
    { id: 'PUNCH-103', 'title': 'Missing light fixture in Lobby', status: 'Closed', assignee: 'John Doe' },
    { id: 'PUNCH-104', title: 'Leaky faucet in Restroom 1B', status: 'Open', assignee: 'Mike Ross' },
    { id: 'PUNCH-105', title: 'Damaged floor tile near entrance', status: 'Ready for Review', assignee: 'Jane Smith' },
];

const mockDrawings: DrawingData[] = [
    { id: 'A-2.1', title: 'Architectural Floor Plan - Level 2', thumbnailUrl: 'https://i.imgur.com/gZ3J4f3.png' },
    { id: 'S-5.0', title: 'Structural Details - Column Connections', thumbnailUrl: 'https://i.imgur.com/K81f2i2.png' },
    { id: 'A-5.1', title: 'Building Section A-A', thumbnailUrl: 'https://i.imgur.com/I7eA7kR.png' },
];

const mockPhotos: PhotoData[] = [
    { id: 'PHOTO-01', title: 'Site Condition - West Wing', url: 'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?auto=compress&cs=tinysrgb&w=600', source: 'linarc' },
    { id: 'PHOTO-02', title: 'Pre-pour inspection formwork', url: 'https://images.pexels.com/photos/302804/pexels-photo-302804.jpeg?auto=compress&cs=tinysrgb&w=600', source: 'linarc' },
    { id: 'PHOTO-03', title: 'HVAC Ducting - 3rd Floor', url: 'https://images.pexels.com/photos/834892/pexels-photo-834892.jpeg?auto=compress&cs=tinysrgb&w=600', source: 'linarc' },
];

const mockSafetyIssues: SafetyIssueData[] = [
    { id: 'SAFE-001', title: 'Uncovered floor opening', description: 'Large opening in the floor on the west side of Level 2, near column B-4. Needs immediate covering.', status: 'Open', severity: 'High' },
    { id: 'SAFE-002', title: 'Missing guardrail on 2nd floor', description: 'The entire southern balcony on the second floor is missing its guardrail.', status: 'In Progress', severity: 'High' },
    { id: 'SAFE-003', title: 'Improperly stored flammable materials', description: 'Gasoline cans and other flammable materials stored next to an active welding station.', status: 'Closed', severity: 'Medium' },
];

const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>(mockPhotos);
  const [allPunches, setAllPunches] = useState<PunchData[]>(mockPunches);
  const [allSafetyIssues, setAllSafetyIssues] = useState<SafetyIssueData[]>(mockSafetyIssues);
  const [selectedRectIds, setSelectedRectIds] = useState<string[]>([]);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [hoveredRectId, setHoveredRectId] = useState<string | null>(null);
  const [linkMenuRectId, setLinkMenuRectId] = useState<string | null>(null);
  const [currentRect, setCurrentRect] = useState<Omit<Rectangle, 'id'> | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<Omit<Rectangle, 'id'> | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>({ type: 'none' });
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [activeShape, setActiveShape] = useState<ActiveShape>('box');
  const [activePinType, setActivePinType] = useState<ActivePinType>('photo');
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, translateX: 0, translateY: 0 });
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
  
  const [isRfiPanelOpen, setIsRfiPanelOpen] = useState(false);
  const [rfiTargetRectId, setRfiTargetRectId] = useState<string | null>(null);
  const [rfiTargetRfiId, setRfiTargetRfiId] = useState<number | null>(null);
  const [rfiFormData, setRfiFormData] = useState({ title: '', type: 'General Inquiry', question: '' });
  const [isRfiEditMode, setIsRfiEditMode] = useState(false);

  const [isSafetyPanelOpen, setIsSafetyPanelOpen] = useState(false);
  const [safetyTargetPinId, setSafetyTargetPinId] = useState<string | null>(null);
  const [safetyFormData, setSafetyFormData] = useState<Omit<SafetyIssueData, 'id'>>({ title: '', description: '', status: 'Open', severity: 'Medium' });

  const [isPunchPanelOpen, setIsPunchPanelOpen] = useState(false);
  const [punchTargetPinId, setPunchTargetPinId] = useState<string | null>(null);
  const [punchFormData, setPunchFormData] = useState<Omit<PunchData, 'id'>>({ title: '', status: 'Open', assignee: '' });
  const [punchPanelMode, setPunchPanelMode] = useState<'create' | 'link'>('create');
  const [punchSearchTerm, setPunchSearchTerm] = useState('');
  
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<HoveredItemInfo | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkModalConfig, setLinkModalConfig] = useState<LinkModalConfig | null>(null);
  const [linkTargetRectId, setLinkTargetRectId] = useState<string | null>(null);
  const [pinTargetCoords, setPinTargetCoords] = useState<{x: number, y: number} | null>(null);
  const [openLinkSubmenu, setOpenLinkSubmenu] = useState<string | null>(null);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [photoViewerConfig, setPhotoViewerConfig] = useState<{ rectId?: string; photoId: string, pinId?: string } | null>(null);


  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const hidePopupTimer = useRef<number | null>(null);
  const mouseDownRef = useRef<{x: number, y: number} | null>(null);


  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Reset state for new image
        setRectangles([]);
        setPins([]);
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

  const getRelativeCoords = useCallback((event: React.MouseEvent | WheelEvent | MouseEvent): { x: number; y: number } | null => {
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
  
  const getScreenPoint = useCallback((x: number, y: number): { left: number; top: number } | null => {
    if (!imageContainerRef.current) return null;
    const containerRect = imageContainerRef.current.getBoundingClientRect();

    const pixelX = (x / 100) * containerRect.width;
    const pixelY = (y / 100) * containerRect.height;
    
    return {
      left: pixelX * viewTransform.scale + viewTransform.translateX,
      top: pixelY * viewTransform.scale + viewTransform.translateY,
    };
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
    const newRect = { ...rect, id: 'id' in rect ? rect.id : '', shape: 'shape' in rect ? rect.shape : activeShape };
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
    setRfiTargetRfiId(null);
    setRfiFormData({ title: '', type: 'General Inquiry', question: '' });
    setIsRfiEditMode(false);
  }, []);
  
  const handleOpenRfiPanel = useCallback((rectId: string, rfiId: number | null) => {
    const targetRect = rectangles.find(r => r.id === rectId);
    if (!targetRect) return;
    
    if (rfiId !== null) {
        // Editing existing RFI
        const rfiToEdit = targetRect.rfi?.find(r => r.id === rfiId);
        if (rfiToEdit) {
            setRfiFormData({title: rfiToEdit.title, type: rfiToEdit.type, question: rfiToEdit.question});
            setIsRfiEditMode(true);
        } else {
            return; // RFI not found
        }
    } else {
        // Creating new RFI
        setRfiFormData({ title: '', type: 'General Inquiry', question: '' });
        setIsRfiEditMode(false);
    }
    
    setRfiTargetRectId(rectId);
    setRfiTargetRfiId(rfiId);
    setIsRfiPanelOpen(true);
    setLinkMenuRectId(null);
  }, [rectangles]);

  const handleSubmenuLink = useCallback((e: React.MouseEvent, type: string, targetId: string | null) => {
    e.stopPropagation();
    setLinkMenuRectId(null);
    if(targetId !== 'pin') {
        setLinkTargetRectId(targetId);
    } else {
        setLinkTargetRectId(null);
    }

    switch (type) {
        case 'New RFI':
            if (targetId) handleOpenRfiPanel(targetId, null);
            break;
        case 'Link RFI':
            const allRfis = rectangles.flatMap(r => r.rfi ? r.rfi.map(rfi => ({...rfi, id: rfi.id, title: `RFI-${rfi.id}: ${rfi.title}`})) : []);
            setLinkModalConfig({
                type: 'rfi',
                title: 'Link to an Existing RFI',
                items: allRfis,
                displayFields: [{ key: 'title' }],
                searchFields: ['title', 'question'],
            });
            setIsLinkModalOpen(true);
            break;
        case 'Link Submittal':
            setLinkModalConfig({
                type: 'submittal',
                title: 'Link to a Submittal',
                items: mockSubmittals,
                displayFields: [{ key: 'id' }, { key: 'title' }],
                searchFields: ['id', 'title', 'specSection'],
            });
            setIsLinkModalOpen(true);
            break;
        case 'Link Punch':
            setLinkModalConfig({
                type: 'punch',
                title: 'Link to a Punch List Item',
                items: allPunches,
                displayFields: [{ key: 'id' }, { key: 'title' }],
                searchFields: ['id', 'title', 'assignee'],
            });
            setIsLinkModalOpen(true);
            break;
        case 'Link Drawing':
            setLinkModalConfig({
                type: 'drawing',
                title: 'Link to a Drawing',
                items: mockDrawings,
                displayFields: [{ key: 'id' }, { key: 'title' }],
                searchFields: ['id', 'title'],
            });
            setIsLinkModalOpen(true);
            break;
        case 'Link Photo':
            setLinkModalConfig({
                type: 'photo',
                title: 'Link a Photo',
                items: allPhotos,
                displayFields: [{ key: 'id' }, { key: 'title' }],
                searchFields: ['id', 'title'],
            });
            setIsLinkModalOpen(true);
            break;
        default:
            alert(`Linking ${type} for rectangle ${targetId}`);
            break;
    }
  }, [rectangles, allPhotos, allPunches, handleOpenRfiPanel]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    mouseDownRef.current = { x: event.clientX, y: event.clientY };
    if (interaction.type !== 'none' || draggingPinId) return;
    
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
            setMarqueeRect({ x: coords.x, y: coords.y, width: 0, height: 0, shape: 'box' });
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
        setCurrentRect({ x: coords.x, y: coords.y, width: 0, height: 0, shape: activeShape });
      }
    }
  }, [getRelativeCoords, interaction.type, rectangles, activeTool, activeShape, selectedRectIds, viewTransform, isRfiPanelOpen, handleRfiCancel, draggingPinId]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const coords = getRelativeCoords(event);

    if (draggingPinId && coords) {
      setPins(prevPins => prevPins.map(p => 
        p.id === draggingPinId ? { ...p, x: coords.x, y: coords.y } : p
      ));
      return;
    }

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
        const baseRect = { x: interaction.startPoint.x, y: interaction.startPoint.y, width: newWidth, height: newHeight };
        if (interaction.type === 'drawing') {
          setCurrentRect({ ...baseRect, shape: activeShape });
        } else {
          setMarqueeRect({ ...baseRect, shape: 'box' });
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
  }, [getRelativeCoords, interaction, activeTool, rectangles, draggingPinId, activeShape]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const startPoint = mouseDownRef.current;
    mouseDownRef.current = null;
    const isClick = startPoint && Math.abs(event.clientX - startPoint.x) < 5 && Math.abs(event.clientY - startPoint.y) < 5;

    if (draggingPinId) {
      setDraggingPinId(null);
    }
    
    if (activeTool === 'pin' && isClick && interaction.type === 'none') {
        const coords = getRelativeCoords(event);
        if (!coords) return;
        setPinTargetCoords(coords);
        
        switch (activePinType) {
            case 'photo':
                setLinkTargetRectId(null);
                handleSubmenuLink(event, 'Link Photo', 'pin');
                break;
            case 'safety':
                setSafetyTargetPinId(null);
                setSafetyFormData({ title: '', description: '', status: 'Open', severity: 'Medium' });
                setIsSafetyPanelOpen(true);
                break;
            case 'punch':
                setPunchTargetPinId(null);
                setPunchFormData({ title: '', status: 'Open', assignee: ''});
                setPunchPanelMode('create');
                setIsPunchPanelOpen(true);
                break;
        }
        setInteraction({ type: 'none' });
        return;
    }

    if (interaction.type === 'none') return;
  
    if (interaction.type === 'drawing' && currentRect) {
      const normalized = normalizeRect(currentRect);
      if (Math.abs(normalized.width) > 1 && Math.abs(normalized.height) > 1) {
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
  }, [interaction, currentRect, marqueeRect, rectangles, activeTool, activePinType, getRelativeCoords, handleSubmenuLink, draggingPinId]);
  

  const handleMouseLeave = useCallback(() => {
    setHoveredRectId(null);
    if (interaction.type !== 'none' || draggingPinId) {
      handleMouseUp({} as React.MouseEvent<HTMLDivElement>);
    }
  }, [interaction.type, handleMouseUp, draggingPinId]);

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

  const handleSelectLinkItem = (item: any) => {
    if (linkTargetRectId) {
        setRectangles(prevRects => prevRects.map(rect => {
            if (rect.id === linkTargetRectId) {
                const newRect = { ...rect };
                switch (linkModalConfig?.type) {
                    case 'rfi':
                        if (!newRect.rfi) newRect.rfi = [];
                        if (!newRect.rfi.some(r => r.id === item.id)) {
                            const originalRfi = rectangles.flatMap(r => r.rfi || []).find(rfi => rfi.id === item.id);
                            if(originalRfi) newRect.rfi.push(originalRfi);
                        }
                        break;
                    case 'submittal':
                        if (!newRect.submittals) newRect.submittals = [];
                        if (!newRect.submittals.some(s => s.id === item.id)) newRect.submittals.push(item);
                        break;
                    case 'punch':
                        if (!newRect.punches) newRect.punches = [];
                        if (!newRect.punches.some(p => p.id === item.id)) newRect.punches.push(item);
                        break;
                    case 'drawing':
                        if (!newRect.drawings) newRect.drawings = [];
                        if (!newRect.drawings.some(d => d.id === item.id)) newRect.drawings.push(item);
                        break;
                    case 'photo':
                        if (!newRect.photos) newRect.photos = [];
                        if (!newRect.photos.some(p => p.id === item.id)) newRect.photos.push(item);
                        break;
                }
                return newRect;
            }
            return rect;
        }));
    } else if (pinTargetCoords && linkModalConfig?.type === 'photo') {
        const newPin: Pin = {
            id: `pin-${Date.now()}`,
            type: 'photo',
            x: pinTargetCoords.x,
            y: pinTargetCoords.y,
            linkedId: item.id
        };
        setPins(prev => [...prev, newPin]);
        setPinTargetCoords(null);
    }


    setIsLinkModalOpen(false);
    setLinkModalConfig(null);
    setLinkTargetRectId(null);
  };

  const handleClearRectangles = () => {
    setRectangles([]);
    setPins([]);
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
          const newRect = { ...rect };
  
          if (isRfiEditMode && rfiTargetRfiId !== null) {
            // Update existing RFI
            newRect.rfi = newRect.rfi?.map(rfi =>
              rfi.id === rfiTargetRfiId ? { ...rfi, ...rfiFormData } : rfi
            );
          } else {
            // Create new RFI and add to array
            const newRfiId = (prevRects.flatMap(r => r.rfi || []).reduce((maxId, rfi) => Math.max(maxId, rfi.id), 0)) + 1;
            const newRfiData: RfiData = {
              id: newRfiId,
              ...rfiFormData
            };
            if (!newRect.rfi) {
              newRect.rfi = [];
            }
            newRect.rfi.push(newRfiData);
          }
          return newRect;
        }
        return rect;
      })
    );
    handleRfiCancel();
  };

    const handlePinDetails = (pin: Pin) => {
        if (pin.type === 'photo') {
            setPhotoViewerConfig({ photoId: pin.linkedId, pinId: pin.id });
            setIsPhotoViewerOpen(true);
        } else if (pin.type === 'safety') {
            const issue = allSafetyIssues.find(i => i.id === pin.linkedId);
            if (issue) {
                setSafetyFormData(issue);
                setSafetyTargetPinId(pin.id);
                setIsSafetyPanelOpen(true);
            }
        } else if (pin.type === 'punch') {
            const punchItem = allPunches.find(p => p.id === pin.linkedId);
            if (punchItem) {
                setPunchFormData(punchItem);
                setPunchTargetPinId(pin.id);
                setPunchPanelMode('create');
                setIsPunchPanelOpen(true);
            }
        }
    };

    const handleDeletePin = (pinId: string) => {
        setPins(prev => prev.filter(p => p.id !== pinId));
    };

  // Generic Panel Handlers
    const handleSafetyPanelCancel = () => {
        setIsSafetyPanelOpen(false);
        setSafetyTargetPinId(null);
        setSafetyFormData({ title: '', description: '', status: 'Open', severity: 'Medium' });
        setPinTargetCoords(null);
    };

    const handlePunchPanelCancel = () => {
        setIsPunchPanelOpen(false);
        setPunchTargetPinId(null);
        setPunchFormData({ title: '', status: 'Open', assignee: '' });
        setPinTargetCoords(null);
        setPunchSearchTerm('');
    };

    const handleSafetyFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setSafetyFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePunchFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPunchFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSafetySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (safetyTargetPinId) { // Editing existing
            const issueToUpdate = allSafetyIssues.find(i => i.id === pins.find(p => p.id === safetyTargetPinId)?.linkedId);
            if(issueToUpdate) {
                const updatedIssue = {...issueToUpdate, ...safetyFormData};
                setAllSafetyIssues(prev => prev.map(i => i.id === updatedIssue.id ? updatedIssue : i));
            }
        } else if (pinTargetCoords) { // Creating new
            const newIssue: SafetyIssueData = { id: `SAFE-${Date.now()}`, ...safetyFormData };
            setAllSafetyIssues(prev => [...prev, newIssue]);
            const newPin: Pin = { id: `pin-${Date.now()}`, type: 'safety', x: pinTargetCoords.x, y: pinTargetCoords.y, linkedId: newIssue.id };
            setPins(prev => [...prev, newPin]);
        }
        handleSafetyPanelCancel();
    };

    const handlePunchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (punchTargetPinId) { // Editing existing
            const itemToUpdate = allPunches.find(p => p.id === pins.find(pin => pin.id === punchTargetPinId)?.linkedId);
            if(itemToUpdate) {
                const updatedItem = {...itemToUpdate, ...punchFormData};
                setAllPunches(prev => prev.map(p => p.id === updatedItem.id ? updatedItem : p));
            }
        } else if (pinTargetCoords) { // Creating new
            const newItem: PunchData = { id: `PUNCH-${Date.now()}`, ...punchFormData };
            setAllPunches(prev => [...prev, newItem]);
            const newPin: Pin = { id: `pin-${Date.now()}`, type: 'punch', x: pinTargetCoords.x, y: pinTargetCoords.y, linkedId: newItem.id };
            setPins(prev => [...prev, newPin]);
        }
        handlePunchPanelCancel();
    };

    const handleLinkExistingPunch = (punch: PunchData) => {
      if (pinTargetCoords) {
        const newPin: Pin = {
          id: `pin-${Date.now()}`,
          type: 'punch',
          x: pinTargetCoords.x,
          y: pinTargetCoords.y,
          linkedId: punch.id,
        };
        setPins((prev) => [...prev, newPin]);
      }
      handlePunchPanelCancel();
    };
  
  const handlePhotoUploadRequest = () => {
    photoFileInputRef.current?.click();
  };
  
  const handlePhotoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newPhoto: PhotoData = {
              id: `UPLOAD-${Date.now()}`,
              title: file.name,
              url: e.target?.result as string,
              source: 'upload',
              markups: [],
          };
          setAllPhotos(prev => [...prev, newPhoto]);

          if (linkTargetRectId) {
             setRectangles(prevRects => prevRects.map(rect => {
                if (rect.id === linkTargetRectId) {
                    const newRect = {...rect};
                    if (!newRect.photos) newRect.photos = [];
                    newRect.photos.push(newPhoto);
                    return newRect;
                }
                return rect;
             }));
          } else if (pinTargetCoords) {
             const newPin: Pin = { id: `pin-${Date.now()}`, type: 'photo', x: pinTargetCoords.x, y: pinTargetCoords.y, linkedId: newPhoto.id };
             setPins(prev => [...prev, newPin]);
          }
  
          setIsLinkModalOpen(false);
          setLinkModalConfig(null);
          setLinkTargetRectId(null);
          setPinTargetCoords(null);
        };
        reader.readAsDataURL(file);
        event.target.value = ''; // Allows re-uploading the same file
      }
  };

  const handleUpdatePhotoMarkups = (newMarkups: PhotoMarkup[]) => {
    if (!photoViewerConfig) return;
    const { photoId } = photoViewerConfig;
    setAllPhotos(prevPhotos => prevPhotos.map(photo => 
        photo.id === photoId ? { ...photo, markups: newMarkups } : photo
    ));
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
    if (interaction.type === 'panning' || draggingPinId) return 'cursor-grabbing';
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
    if (activeTool === 'pin') return 'cursor-crosshair';
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
  
  const currentPhotoForViewer = photoViewerConfig ? allPhotos.find(p => p.id === photoViewerConfig.photoId) : null;
  
  let singleSelectionScreenRect = selectedRectangle ? getScreenRect(selectedRectangle) : null;
  let multiSelectionScreenRect = lastSelectedRectangle ? getScreenRect(lastSelectedRectangle) : null;
  let marqueeScreenRect = marqueeRect ? getScreenRect(normalizeRect(marqueeRect)) : null;

  const generateCloudPath = (w: number, h: number) => {
    if (w <= 0 || h <= 0) return '';
    return `M ${w * 0.37} ${h * 0.95} 
            A ${w * 0.19} ${h * 0.19} 0 0 1 ${w * 0.21} ${h * 0.75}
            A ${w * 0.25} ${h * 0.25} 0 0 1 ${w * 0.25} ${h * 0.35}
            A ${w * 0.22} ${h * 0.22} 0 0 1 ${w * 0.5} ${h * 0.2}
            A ${w * 0.25} ${h * 0.25} 0 0 1 ${w * 0.75} ${h * 0.3}
            A ${w * 0.20} ${h * 0.20} 0 0 1 ${w * 0.79} ${h * 0.75}
            A ${w * 0.19} ${h * 0.19} 0 0 1 ${w * 0.63} ${h * 0.95} 
            Z`;
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-stretch p-4 overflow-hidden">
      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
      <input type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" ref={photoFileInputRef} />
      <main className="w-full flex-grow flex flex-col items-center bg-white dark:bg-gray-800 rounded-2xl shadow-2xl shadow-cyan-500/10 p-2">
        {!imageSrc ? (
          <div className="flex flex-col items-center justify-center h-full w-full border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
            <UploadIcon className="w-24 h-24 text-gray-400 dark:text-gray-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Upload Your Blueprint</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">Select an image file to start highlighting.</p>
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
              <div className="flex items-center gap-4">
                 <button
                    onClick={handleThemeToggle}
                    className="p-2 rounded-lg transition-colors duration-200 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'dark' ? (
                        <SunIcon className="w-5 h-5" />
                    ) : (
                        <MoonIcon className="w-5 h-5" />
                    )}
                </button>
                <button onClick={triggerFileUpload} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2">
                  <UploadIcon className="w-5 h-5" /> Change Image
                </button>
                <button onClick={handleClearRectangles} disabled={rectangles.length === 0 && pins.length === 0} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-red-300 dark:disabled:bg-red-900 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
                  <TrashIcon className="w-5 h-5" /> Clear All
                </button>
              </div>
            </div>
            <div className="relative w-full flex-grow flex gap-4">
              <div className="relative z-10">
                <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} activeShape={activeShape} setActiveShape={setActiveShape} activePinType={activePinType} setActivePinType={setActivePinType} />
              </div>
              <div
                ref={imageContainerRef}
                className={`relative w-full flex-grow overflow-hidden rounded-lg select-none bg-gray-200 dark:bg-gray-900/50 ${getCursorClass()}`}
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
                    const isSelected = selectedRectIds.includes(rect.id);
                    const strokeColor = isSelected ? '#f87171' : '#ef4444'; // red-400 : red-500
                    
                    const shapeProps = {
                      stroke: strokeColor,
                      strokeWidth: 4 / viewTransform.scale, // Make stroke width consistent when zooming
                      fill: "rgba(0,0,0,0.05)",
                      vectorEffect: "non-scaling-stroke",
                    };

                    return (
                        <div
                            key={rect.id}
                            className={`absolute`}
                            style={{
                                left: `${normalized.x}%`,
                                top: `${normalized.y}%`,
                                width: `${normalized.width}%`,
                                height: `${normalized.height}%`,
                                pointerEvents: 'none',
                            }}
                        >
                            {rect.shape === 'box' && (
                                <div
                                    className={`w-full h-full ${isSelected ? 'border-4 border-red-400' : 'border-4 border-red-500'} bg-black/5 dark:bg-white/5`}
                                />
                            )}
                            {(rect.shape === 'ellipse' || rect.shape === 'cloud') && (
                                <svg width="100%" height="100%" viewBox={`0 0 ${normalized.width} ${normalized.height}`} preserveAspectRatio="none" className="overflow-visible">
                                    {rect.shape === 'ellipse' && (
                                        <ellipse
                                            cx={normalized.width / 2} cy={normalized.height / 2}
                                            rx={normalized.width / 2} ry={normalized.height / 2}
                                            {...shapeProps}
                                        />
                                    )}
                                    {rect.shape === 'cloud' && (
                                        <path
                                            d={generateCloudPath(normalized.width, normalized.height)}
                                            {...shapeProps}
                                        />
                                    )}
                                </svg>
                            )}
                        </div>
                    );
                  })}
                </div>

                {/* Screen-space Overlays */}
                {pins.map(pin => {
                    const screenPos = getScreenPoint(pin.x, pin.y);
                    if (!screenPos) return null;
                    const PinIcon = { photo: PhotoPinIcon, safety: SafetyPinIcon, punch: PunchPinIcon }[pin.type];
                    const pinCursor = activeTool === 'select' ? (draggingPinId === pin.id ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer';

                    return (
                        <div
                            key={pin.id}
                            className={`absolute w-10 h-10 transform -translate-x-1/2 -translate-y-full ${pinCursor}`}
                            style={{ left: screenPos.left, top: screenPos.top, pointerEvents: 'auto', zIndex: 15 }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                mouseDownRef.current = { x: e.clientX, y: e.clientY };
                                if (activeTool === 'select') {
                                    setDraggingPinId(pin.id);
                                }
                            }}
                             onClick={(e) => {
                                e.stopPropagation();
                                const startPoint = mouseDownRef.current;
                                const isClick = startPoint && Math.abs(e.clientX - startPoint.x) < 5 && Math.abs(e.clientY - startPoint.y) < 5;
                                if (!isClick && activeTool === 'select') return; // It was a drag
                                
                                setSelectedRectIds([]); // Deselect rectangles
                                handlePinDetails(pin);
                            }}
                            onMouseEnter={(e) => {
                                if (activeTool === 'select') setHoveredPinId(pin.id);
                                if (draggingPinId) return; // Prevent hover card during drag
                                if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current);
                                const pinRect = e.currentTarget.getBoundingClientRect();
                                setHoveredItem({
                                    type: 'pin',
                                    pin: pin,
                                    itemId: pin.id,
                                    position: { top: pinRect.top + pinRect.height / 2, left: pinRect.right }
                                });
                            }}
                            onMouseLeave={() => {
                                if (activeTool === 'select') setHoveredPinId(null);
                                hidePopupTimer.current = window.setTimeout(() => setHoveredItem(null), 300);
                            }}
                        >
                            <PinIcon className="w-full h-full drop-shadow-lg" />
                            {hoveredPinId === pin.id && activeTool === 'select' && !draggingPinId && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeletePin(pin.id); }}
                                    title="Delete"
                                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-colors z-20"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {singleSelectionScreenRect && (
                  <>
                    {(['tl', 'tr', 'bl', 'br'] as ResizeHandle[]).map(handle => (
                      <div
                        key={handle}
                        className="absolute w-3.5 h-3.5 bg-red-400 border-2 border-white dark:border-gray-900 rounded-full"
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
                        className={`absolute flex transition-opacity transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isMenuVisible ? 'opacity-100' : 'opacity-0'}`}
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
                        <div className="flex items-center gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg text-white">
                            <button onClick={(e) => selectedRectangle && handlePublishRect(e, selectedRectangle.id)} title="Publish" className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                                <ArrowUpTrayIcon className="w-5 h-5" />
                            </button>
                            
                            <div className="relative">
                                <button onClick={(e) => selectedRectangle && handleLinkRect(e, selectedRectangle.id)} title="Link" className={`p-2 rounded-md transition-colors ${linkMenuRectId === selectedRectangle?.id ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'}`}>
                                    <LinkIcon className="w-5 h-5" />
                                </button>
                                {linkMenuRectId === selectedRectangle?.id && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max" onMouseLeave={() => setOpenLinkSubmenu(null)}>
                                    <div className="flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg text-sm">
                                        <div className="relative" onMouseEnter={() => setOpenLinkSubmenu('rfi')}>
                                            <div className="flex justify-between items-center px-3 py-1.5 text-white rounded-md hover:bg-cyan-600 transition-colors text-left cursor-default">
                                                <span>RFI</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 ml-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                            </div>
                                            {openLinkSubmenu === 'rfi' && (
                                                <div className="absolute left-full top-0 ml-1 flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg text-sm w-max">
                                                    <button onClick={(e) => selectedRectangle && handleSubmenuLink(e, 'New RFI', selectedRectangle.id)} className="px-3 py-1.5 text-white rounded-md hover:bg-cyan-600 transition-colors text-left whitespace-nowrap">New RFI</button>
                                                    <button onClick={(e) => selectedRectangle && handleSubmenuLink(e, 'Link RFI', selectedRectangle.id)} className="px-3 py-1.5 text-white rounded-md hover:bg-cyan-600 transition-colors text-left whitespace-nowrap">Link RFI</button>
                                                </div>
                                            )}
                                        </div>
                                        {['Link Submittal', 'Link Punch', 'Link Drawing', 'Link Photo'].map(type => (
                                            <button key={type} onClick={(e) => selectedRectangle && handleSubmenuLink(e, type, selectedRectangle.id)} className="px-3 py-1.5 text-white rounded-md hover:bg-cyan-600 transition-colors text-left">{type.replace('Link ','')}</button>
                                        ))}
                                    </div>
                                </div>
                                )}
                            </div>

                            <button onClick={handleDeleteSelected} title="Delete" className="p-2 rounded-md hover:bg-red-500 hover:text-white transition-colors">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                  </>
                )}
                {isMultiSelection && multiSelectionScreenRect && (
                  <div
                    className="absolute flex items-center"
                    style={{
                      left: `${multiSelectionScreenRect.left + multiSelectionScreenRect.width / 2}px`,
                      top: `${multiSelectionScreenRect.top}px`,
                      transform: 'translate(-50%, -100%) translateY(-10px)',
                      pointerEvents: 'auto', zIndex: 30
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => { e.stopPropagation() }}
                  >
                    <div className="flex gap-1 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg text-white">
                      <button onClick={handleDeleteSelected} title="Delete Selected" className="p-2 rounded-md hover:bg-red-500 hover:text-white transition-colors"><TrashIcon className="w-5 h-5" /></button>
                    </div>
                  </div>
                )}
                {currentRect && (() => {
                  const normalized = normalizeRect(currentRect);
                  const screenRect = getScreenRect(normalized);

                  if (normalized.shape === 'box') {
                    return <div className="absolute border-2 border-dashed border-red-400 bg-red-400/20 pointer-events-none" style={screenRect} />;
                  }

                  const svgProps = {
                    stroke: '#f87171', // red-400
                    strokeWidth: 2 / viewTransform.scale,
                    fill: "rgba(248, 113, 113, 0.2)", // red-400 with 20% opacity
                    strokeDasharray: `${6 / viewTransform.scale},${4 / viewTransform.scale}`,
                    vectorEffect: "non-scaling-stroke",
                  };

                  return (
                    <svg
                      className="absolute pointer-events-none overflow-visible"
                      style={{
                        left: screenRect.left,
                        top: screenRect.top,
                        width: screenRect.width,
                        height: screenRect.height,
                      }}
                    >
                      {normalized.shape === 'ellipse' && (
                        <ellipse
                          cx={screenRect.width / 2} cy={screenRect.height / 2}
                          rx={screenRect.width / 2} ry={screenRect.height / 2}
                          {...svgProps}
                        />
                      )}
                      {normalized.shape === 'cloud' && (
                        <path
                          d={generateCloudPath(screenRect.width, screenRect.height)}
                          {...svgProps}
                          transform={`translate(${screenRect.width/2 - screenRect.width/2}, ${screenRect.height/2 - screenRect.height/2})`}
                        />
                      )}
                    </svg>
                  );
                })()}

                {marqueeScreenRect && (
                  <div className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none" style={marqueeScreenRect} />
                )}

                {/* Item Tags */}
                {rectangles.map(rect => {
                    const screenRect = getScreenRect(rect);
                    if (!screenRect) return null;
                    let tagCount = 0;

                    const renderTag = (type: 'rfi' | 'submittal' | 'punch' | 'drawing' | 'photo', item: any, text: string) => {
                        const tagColorClasses = {
                            rfi: 'bg-blue-600/85 hover:bg-blue-500/85',
                            submittal: 'bg-green-600/85 hover:bg-green-500/85',
                            punch: 'bg-orange-600/85 hover:bg-orange-500/85',
                            drawing: 'bg-indigo-600/85 hover:bg-indigo-500/85',
                            photo: 'bg-yellow-600/85 hover:bg-yellow-500/85',
                        };
                        const positionIndex = tagCount;
                        tagCount++;

                        return (
                            <div
                                key={`${type}-tag-${rect.id}-${item.id}`}
                                className={`absolute text-white text-xs font-bold px-1.5 py-0.5 rounded-sm shadow-md cursor-pointer transition-colors ${tagColorClasses[type]}`}
                                style={{
                                    left: `${screenRect.left + screenRect.width + 5}px`,
                                    top: `${screenRect.top + positionIndex * 24}px`,
                                    pointerEvents: 'auto',
                                    zIndex: 25
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(type === 'rfi') handleOpenRfiPanel(rect.id, item.id);
                                    if(type === 'photo') {
                                        setPhotoViewerConfig({ rectId: rect.id, photoId: item.id });
                                        setIsPhotoViewerOpen(true);
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current);
                                    const tagRect = e.currentTarget.getBoundingClientRect();
                                    setHoveredItem({
                                        type: type,
                                        rectId: rect.id,
                                        itemId: item.id,
                                        position: { top: tagRect.top + tagRect.height / 2, left: tagRect.right }
                                    });
                                }}
                                onMouseLeave={() => {
                                    hidePopupTimer.current = window.setTimeout(() => setHoveredItem(null), 300);
                                }}
                            >
                                {text}
                            </div>
                        );
                    };

                    return (
                        <React.Fragment key={`tags-for-${rect.id}`}>
                            {rect.rfi?.map(rfi => renderTag('rfi', rfi, `RFI-${rfi.id}`))}
                            {rect.submittals?.map(sub => renderTag('submittal', sub, sub.id))}
                            {rect.punches?.map(punch => renderTag('punch', punch, punch.id))}
                            {rect.drawings?.map(drawing => renderTag('drawing', drawing, drawing.id))}
                            {rect.photos?.map(photo => renderTag('photo', photo, photo.id))}
                        </React.Fragment>
                    );
                })}
                

                {/* Zoom Controls */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg text-gray-800 dark:text-white">
                    <button onClick={() => handleZoom('in')} title="Zoom In" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><MagnifyingGlassPlusIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleZoom('out')} title="Zoom Out" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><MagnifyingGlassMinusIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleZoom('reset')} title="Reset View" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ArrowsPointingOutIcon className="w-5 h-5"/></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Item Hover Popup */}
      {hoveredItem && !draggingPinId && (() => {
        let content = null;
    
        switch (hoveredItem.type) {
            case 'pin':
                const pin = hoveredItem.pin;
                if (pin) {
                    if (pin.type === 'photo') {
                        const photo = allPhotos.find(p => p.id === pin.linkedId);
                         if (photo) content = (
                            <>
                                <h4 className="font-bold text-yellow-400 mb-2 truncate">{photo.id}: {photo.title}</h4>
                                 <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPhotoViewerConfig({ photoId: photo.id, pinId: pin.id });
                                        setIsPhotoViewerOpen(true);
                                        setHoveredItem(null); // Close the popup
                                    }}
                                    className="rounded-md mb-3 w-full h-32 block hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                    <img src={photo.url} alt={photo.title} className="w-full h-full object-cover rounded-md" />
                                </button>
                                <p className="text-sm text-gray-400">Click pin or thumbnail to view & annotate.</p>
                            </>
                        );
                    } else if (pin.type === 'safety') {
                        const issue = allSafetyIssues.find(i => i.id === pin.linkedId);
                        if (issue) content = (
                             <>
                                <h4 className="font-bold text-red-400 mb-2 truncate">{issue.id}: {issue.title}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1"><span className="font-semibold text-gray-500 dark:text-gray-400">Severity:</span> {issue.severity}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3"><span className="font-semibold text-gray-500 dark:text-gray-400">Status:</span> {issue.status}</p>
                                <p className="text-sm text-gray-400">Click pin to view details.</p>
                             </>
                        );
                    } else if (pin.type === 'punch') {
                        const punch = allPunches.find(p => p.id === pin.linkedId);
                        if (punch) content = (
                            <>
                                <h4 className="font-bold text-orange-400 mb-2 truncate">{punch.id}: {punch.title}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1"><span className="font-semibold text-gray-500 dark:text-gray-400">Assignee:</span> {punch.assignee}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3"><span className="font-semibold text-gray-500 dark:text-gray-400">Status:</span> {punch.status}</p>
                                <p className="text-sm text-gray-400">Click pin to view details.</p>
                            </>
                        );
                    }
                }
                break;
            default:
                const rect = rectangles.find(r => r.id === hoveredItem.rectId);
                if (rect) {
                    switch (hoveredItem.type) {
                        case 'rfi':
                            const rfi = rect.rfi?.find(r => r.id === hoveredItem.itemId);
                            if (rfi) content = (
                                <>
                                    <h4 className="font-bold text-cyan-400 mb-2 truncate">RFI-{rfi.id}: {rfi.title}</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1"><span className="font-semibold text-gray-500 dark:text-gray-400">Type:</span> {rfi.type}</p>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 max-h-24 overflow-y-auto">
                                        <span className="font-semibold text-gray-500 dark:text-gray-400">Question:</span>
                                        <p className="whitespace-pre-wrap break-words">{rfi.question}</p>
                                    </div>
                                    <a href="https://demo.linarc.io/projectPortal/kbUydYsp3LW2WhsQ/document/rfi/uiSFtnkKXNpn5Koz/details?tab=details" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 text-sm font-semibold">View Full RFI &rarr;</a>
                                </>
                            );
                            break;
                        case 'submittal':
                            const submittal = rect.submittals?.find(s => s.id === hoveredItem.itemId);
                            if (submittal) content = (
                                <>
                                    <h4 className="font-bold text-green-400 mb-2 truncate">{submittal.id}: {submittal.title}</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1"><span className="font-semibold text-gray-500 dark:text-gray-400">Spec Section:</span> {submittal.specSection}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3"><span className="font-semibold text-gray-500 dark:text-gray-400">Status:</span> {submittal.status}</p>
                                    <a href="https://demo.linarc.io/projectPortal/kbUydYsp3LW2WhsQ/document/submittals/package/FMVmW4xEe9bcHUTp/registries/Xh6FHaQZ9Dyv6V3i/?tab=response" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 text-sm font-semibold">View Full Submittal &rarr;</a>
                                </>
                            );
                            break;
                        case 'punch':
                            const punch = rect.punches?.find(p => p.id === hoveredItem.itemId);
                            if (punch) content = (
                                <>
                                    <h4 className="font-bold text-orange-400 mb-2 truncate">{punch.id}: {punch.title}</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1"><span className="font-semibold text-gray-500 dark:text-gray-400">Assignee:</span> {punch.assignee}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3"><span className="font-semibold text-gray-500 dark:text-gray-400">Status:</span> {punch.status}</p>
                                    <a href="https://demo.linarc.io/projectPortal/kbUydYsp3LW2WhsQ/quality/punchList/H7SakWBed794KRdU/details?tab=details" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 text-sm font-semibold">View Full Punch Item &rarr;</a>
                                </>
                            );
                            break;
                        case 'drawing':
                            const drawing = rect.drawings?.find(d => d.id === hoveredItem.itemId);
                            if (drawing) content = (
                                <>
                                    <h4 className="font-bold text-indigo-400 mb-2 truncate">{drawing.id}: {drawing.title}</h4>
                                    <img src={drawing.thumbnailUrl} alt={drawing.title} className="rounded-md mb-3 w-full object-cover" />
                                    <a href="https://demo.linarc.io/projectPortal/kbUydYsp3LW2WhsQ/document/newPlans/markup/A-3.2/AHV6vNEm20250627115709/latest" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 text-sm font-semibold">View Full Drawing &rarr;</a>
                                </>
                            );
                            break;
                        case 'photo':
                            const photo = rect.photos?.find(p => p.id === hoveredItem.itemId);
                            if (photo) content = (
                                <>
                                    <h4 className="font-bold text-yellow-400 mb-2 truncate">{photo.id}: {photo.title}</h4>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPhotoViewerConfig({ rectId: rect.id, photoId: photo.id });
                                            setIsPhotoViewerOpen(true);
                                            setHoveredItem(null); // Close the popup
                                        }}
                                        className="rounded-md mb-3 w-full h-32 block hover:opacity-80 transition-opacity cursor-pointer"
                                    >
                                        <img src={photo.url} alt={photo.title} className="w-full h-full object-cover rounded-md" />
                                    </button>
                                    <p className="text-sm text-gray-400">Click tag or thumbnail to view & annotate.</p>
                                </>
                            );
                            break;
                    }
                }
        }
    
        if (!content) return null;
    
        return (
            <div
                className="absolute bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-xl z-[60] w-72"
                style={{
                    top: `${hoveredItem.position.top}px`,
                    left: `${hoveredItem.position.left + 10}px`,
                    transform: 'translateY(-50%)'
                }}
                onMouseEnter={() => { if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current); }}
                onMouseLeave={() => { setHoveredItem(null); }}
            >
                {content}
            </div>
        );
      })()}

      <LinkModal
        isOpen={isLinkModalOpen}
        config={linkModalConfig}
        onClose={() => {
            setIsLinkModalOpen(false);
            setPinTargetCoords(null);
        }}
        onSelect={handleSelectLinkItem}
        onUploadRequest={handlePhotoUploadRequest}
      />
      
      <PhotoViewerModal
        isOpen={isPhotoViewerOpen}
        photoData={currentPhotoForViewer || null}
        onClose={() => setIsPhotoViewerOpen(false)}
        onUpdateMarkups={handleUpdatePhotoMarkups}
      />

      {/* RFI Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isRfiPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{isRfiEditMode ? 'Edit RFI' : 'Create RFI Draft'}</h2>
                  <button onClick={handleRfiCancel} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  </button>
              </div>
              <form onSubmit={handleRfiSubmit} className="flex flex-col flex-grow">
                  <div className="mb-4">
                      <label htmlFor="rfi-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">RFI Title</label>
                      <input type="text" name="title" id="rfi-title" value={rfiFormData.title} onChange={handleRfiFormChange} required className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white focus:ring-cyan-500 focus:border-cyan-500" />
                  </div>
                  <div className="mb-4">
                      <label htmlFor="rfi-type" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">RFI Type</label>
                      <select name="type" id="rfi-type" value={rfiFormData.type} onChange={handleRfiFormChange} className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white focus:ring-cyan-500 focus:border-cyan-500">
                          <option>General Inquiry</option>
                          <option>Design Clarification</option>
                          <option>Material Substitution</option>
                          <option>Field Condition</option>
                      </select>
                  </div>
                  <div className="mb-4 flex-grow flex flex-col">
                      <label htmlFor="rfi-question" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Question</label>
                      <textarea name="question" id="rfi-question" value={rfiFormData.question} onChange={handleRfiFormChange} required rows={6} className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white flex-grow resize-none focus:ring-cyan-500 focus:border-cyan-500"></textarea>
                  </div>
                  <div className="mb-4">
                      <p className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Attachments / Linked Items</p>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-md p-4 text-center text-gray-500 dark:text-gray-400">
                          <p>Attachments can be added after draft creation.</p>
                      </div>
                  </div>
                  <div className="mt-auto flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button type="button" onClick={handleRfiCancel} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors">Cancel</button>
                      <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">{isRfiEditMode ? 'Save Changes' : 'Create Draft'}</button>
                  </div>
              </form>
          </div>
      </div>
      
      {/* Safety Issue Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isSafetyPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{safetyTargetPinId ? 'Edit' : 'Create'} Safety Issue</h2>
                  <button onClick={handleSafetyPanelCancel} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" /></button>
              </div>
              <form onSubmit={handleSafetySubmit} className="flex flex-col flex-grow overflow-y-auto -mr-6 pr-6">
                  <div className="mb-4">
                      <label htmlFor="safety-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Title</label>
                      <input type="text" name="title" id="safety-title" value={safetyFormData.title} onChange={handleSafetyFormChange} required className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white" />
                  </div>
                  <div className="mb-4">
                        <label htmlFor="safety-description" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label>
                        <textarea name="description" id="safety-description" value={safetyFormData.description} onChange={handleSafetyFormChange} rows={4} className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white resize-none" />
                  </div>
                  <div className="mb-4">
                      <label htmlFor="safety-severity" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Severity</label>
                      <select name="severity" id="safety-severity" value={safetyFormData.severity} onChange={handleSafetyFormChange} className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white">
                          <option>Low</option><option>Medium</option><option>High</option>
                      </select>
                  </div>
                  <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Attachments</label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                          <div className="space-y-1 text-center">
                              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-cyan-600 dark:text-cyan-500 hover:text-cyan-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-cyan-500">
                                      <span>Upload a file</span>
                                      <input id="file-upload" name="file-upload" type="file" className="sr-only" />
                                  </label>
                                  <p className="pl-1">or drag and drop</p>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, PDF up to 10MB</p>
                          </div>
                      </div>
                  </div>
                  <div className="mt-auto flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button type="button" onClick={handleSafetyPanelCancel} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                      <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg">{safetyTargetPinId ? 'Save' : 'Create'}</button>
                  </div>
              </form>
          </div>
      </div>
      
      {/* Punch List Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isPunchPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{punchTargetPinId ? 'Edit' : 'Create'} Punch List Item</h2>
                  <button onClick={handlePunchPanelCancel} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" /></button>
              </div>
              
              {!punchTargetPinId && (
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <button onClick={() => setPunchPanelMode('create')} className={`flex-1 py-2 text-sm font-semibold transition-colors ${punchPanelMode === 'create' ? 'border-b-2 border-cyan-500 text-cyan-500 dark:text-cyan-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Create New</button>
                    <button onClick={() => setPunchPanelMode('link')} className={`flex-1 py-2 text-sm font-semibold transition-colors ${punchPanelMode === 'link' ? 'border-b-2 border-cyan-500 text-cyan-500 dark:text-cyan-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Link Existing</button>
                </div>
              )}

              {punchPanelMode === 'create' || punchTargetPinId ? (
                <form onSubmit={handlePunchSubmit} className="flex flex-col flex-grow">
                    <div className="mb-4">
                        <label htmlFor="punch-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Title</label>
                        <input type="text" name="title" id="punch-title" value={punchFormData.title} onChange={handlePunchFormChange} required className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white" />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="punch-assignee" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Assignee</label>
                        <input type="text" name="assignee" id="punch-assignee" value={punchFormData.assignee} onChange={handlePunchFormChange} required className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white" />
                    </div>
                    <div className="mt-auto flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button type="button" onClick={handlePunchPanelCancel} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg">{punchTargetPinId ? 'Save' : 'Create'}</button>
                    </div>
                </form>
              ) : (
                <div className="flex flex-col flex-grow">
                   <input 
                        type="text" 
                        placeholder="Search existing punch items..."
                        value={punchSearchTerm}
                        onChange={e => setPunchSearchTerm(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 mb-4 text-gray-900 dark:text-white focus:ring-cyan-500 focus:border-cyan-500" 
                    />
                    <ul className="overflow-y-auto -mr-6 pr-6">
                        {allPunches.filter(p => p.title.toLowerCase().includes(punchSearchTerm.toLowerCase()) || p.assignee.toLowerCase().includes(punchSearchTerm.toLowerCase())).map(punch => (
                            <li key={punch.id}>
                                <button onClick={() => handleLinkExistingPunch(punch)} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{punch.id}: {punch.title}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Assignee: {punch.assignee}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
              )}
          </div>
      </div>
    </div>
  );
};

interface LinkModalProps {
    isOpen: boolean;
    config: LinkModalConfig | null;
    onClose: () => void;
    onSelect: (item: any) => void;
    onUploadRequest: () => void;
}

const LinkModal: React.FC<LinkModalProps> = ({ isOpen, config, onClose, onSelect, onUploadRequest }) => {
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    if (!isOpen || !config) return null;

    const filteredItems = config.items.filter(item => 
        config.searchFields.some(field => 
            item[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col" 
                onClick={e => e.stopPropagation()}
                style={{maxHeight: '80vh'}}
            >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{config.title}</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 mt-4 text-gray-900 dark:text-white focus:ring-cyan-500 focus:border-cyan-500" 
                    />
                </div>
                <ul className="overflow-y-auto p-4">
                    {filteredItems.length > 0 ? filteredItems.map(item => (
                        <li key={item.id}>
                            <button 
                                onClick={() => onSelect(item)}
                                className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {config.displayFields.map(field => (
                                    <span key={field.key} className="font-semibold text-gray-800 dark:text-gray-200 mr-4">{item[field.key]}</span>
                                ))}
                            </button>
                        </li>
                    )) : (
                        <li className="p-4 text-center text-gray-500 dark:text-gray-400">No items found.</li>
                    )}
                </ul>
                {config.type === 'photo' && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
                        <button 
                            onClick={onUploadRequest}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 mx-auto"
                        >
                            <UploadIcon className="w-5 h-5" />
                            Upload from Computer
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface PhotoViewerModalProps {
    isOpen: boolean;
    photoData: PhotoData | null;
    onClose: () => void;
    onUpdateMarkups: (newMarkups: PhotoMarkup[]) => void;
}

const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({ isOpen, photoData, onClose, onUpdateMarkups }) => {
    const [markups, setMarkups] = useState<PhotoMarkup[]>([]);
    const [currentMarkup, setCurrentMarkup] = useState<Omit<PhotoMarkup, 'id'> | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const photoContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (photoData) {
            setMarkups(photoData.markups || []);
        }
    }, [photoData]);

    if (!isOpen || !photoData) return null;
    
    const getRelativeCoords = (event: React.MouseEvent): { x: number; y: number } | null => {
        if (!photoContainerRef.current) return null;
        const rect = photoContainerRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        return { x, y };
    };

    const normalizeMarkup = (markup: Omit<PhotoMarkup, 'id'>): Omit<PhotoMarkup, 'id'> => {
        const newMarkup = { ...markup };
        if (newMarkup.width < 0) {
            newMarkup.x = newMarkup.x + newMarkup.width;
            newMarkup.width = Math.abs(newMarkup.width);
        }
        if (newMarkup.height < 0) {
            newMarkup.y = newMarkup.y + newMarkup.height;
            newMarkup.height = Math.abs(newMarkup.height);
        }
        return newMarkup;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const coords = getRelativeCoords(e);
        if (!coords) return;
        setIsDrawing(true);
        setStartPoint(coords);
        setCurrentMarkup({ x: coords.x, y: coords.y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !startPoint) return;
        const coords = getRelativeCoords(e);
        if (!coords) return;
        setCurrentMarkup({
            x: startPoint.x,
            y: startPoint.y,
            width: coords.x - startPoint.x,
            height: coords.y - startPoint.y,
        });
    };

    const handleMouseUp = () => {
        if (!currentMarkup || !isDrawing) return;
        const normalized = normalizeMarkup(currentMarkup);
        if (normalized.width > 1 && normalized.height > 1) {
            const newMarkup = { ...normalized, id: Date.now().toString() };
            const newMarkups = [...markups, newMarkup];
            setMarkups(newMarkups);
            onUpdateMarkups(newMarkups);
        }
        setIsDrawing(false);
        setCurrentMarkup(null);
        setStartPoint(null);
    };
    
    const handleDeleteMarkup = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newMarkups = markups.filter(m => m.id !== id);
        setMarkups(newMarkups);
        onUpdateMarkups(newMarkups);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl flex flex-col relative" 
                onClick={e => e.stopPropagation()}
                style={{height: '90vh'}}
            >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{photoData.title}</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>
                <div className="flex-grow p-4 overflow-hidden flex items-center justify-center">
                    <div
                        ref={photoContainerRef}
                        className="relative w-full h-full cursor-crosshair"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                        <img src={photoData.url} alt={photoData.title} className="w-full h-full object-contain pointer-events-none select-none" />
                        
                        {markups.map(markup => (
                             <div 
                                key={markup.id} 
                                className="absolute border-2 border-red-500 bg-red-500/20 group"
                                style={{
                                    left: `${markup.x}%`,
                                    top: `${markup.y}%`,
                                    width: `${markup.width}%`,
                                    height: `${markup.height}%`,
                                }}
                             >
                                <button 
                                    onClick={(e) => handleDeleteMarkup(e, markup.id)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                             </div>
                        ))}

                        {currentMarkup && (
                            <div 
                                className="absolute border-2 border-dashed border-red-400 bg-red-400/20 pointer-events-none"
                                style={{
                                    left: `${normalizeMarkup(currentMarkup).x}%`,
                                    top: `${normalizeMarkup(currentMarkup).y}%`,
                                    width: `${normalizeMarkup(currentMarkup).width}%`,
                                    height: `${normalizeMarkup(currentMarkup).height}%`,
                                }}
                             />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default App;