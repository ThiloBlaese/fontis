import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/storage';

export const useSidebarState = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = safeStorage.getItem('fontis_isSidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = safeStorage.getItem('fontis_sidebarWidth');
    return saved ? parseInt(saved, 10) : 280;
  });

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => {
    const saved = safeStorage.getItem('fontis_isRightSidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = safeStorage.getItem('fontis_rightSidebarWidth');
    return saved ? parseInt(saved, 10) : 300;
  });

  useEffect(() => {
    safeStorage.setItem('fontis_isSidebarOpen', isSidebarOpen);
  }, [isSidebarOpen]);

  useEffect(() => {
    safeStorage.setItem('fontis_isRightSidebarOpen', isRightSidebarOpen);
  }, [isRightSidebarOpen]);

  const startSidebarResize = (e) => {
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = startWidth;
    const onMouseMove = (moveEvent) => {
      currentWidth = Math.max(200, Math.min(600, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(currentWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      safeStorage.setItem('fontis_sidebarWidth', currentWidth);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startRightSidebarResize = (e) => {
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;
    let currentWidth = startWidth;
    const onMouseMove = (moveEvent) => {
      currentWidth = Math.max(250, Math.min(800, startWidth - (moveEvent.clientX - startX)));
      setRightSidebarWidth(currentWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      safeStorage.setItem('fontis_rightSidebarWidth', currentWidth);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return {
    isSidebarOpen, setIsSidebarOpen,
    sidebarWidth, startSidebarResize,
    isRightSidebarOpen, setIsRightSidebarOpen,
    rightSidebarWidth, startRightSidebarResize
  };
};
