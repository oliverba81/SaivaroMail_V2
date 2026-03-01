'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { LayoutPreferences } from './useEmailState';

const DEBOUNCE_MS = 400;
const DEFAULT_LIST_WIDTH = 50;
const DEFAULT_TIMELINE_HEIGHT = 300;
const DEFAULT_IS_TIMELINE_COLLAPSED = false;

export function useEmailResize(
  initialLayout?: LayoutPreferences | undefined,
  onLayoutChange?: (prefs: Partial<LayoutPreferences>) => void
) {
  const [listWidth, setListWidth] = useState(() =>
    initialLayout?.listWidth != null ? initialLayout.listWidth : DEFAULT_LIST_WIDTH
  );
  const [timelineHeight, setTimelineHeight] = useState(() =>
    initialLayout?.timelineHeight != null ? initialLayout.timelineHeight : DEFAULT_TIMELINE_HEIGHT
  );
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(() =>
    initialLayout?.isTimelineCollapsed ?? DEFAULT_IS_TIMELINE_COLLAPSED
  );
  const [isResizing, setIsResizing] = useState<'horizontal' | 'vertical' | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; listWidth: number; timelineHeight: number } | null>(null);
  const hasAppliedInitialLayout = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ listWidth, timelineHeight, isTimelineCollapsed });
  latestRef.current = { listWidth, timelineHeight, isTimelineCollapsed };

  // Nur beim ersten Wechsel von undefined zu definiert: initialLayout anwenden
  useEffect(() => {
    if (initialLayout == null || hasAppliedInitialLayout.current) return;
    hasAppliedInitialLayout.current = true;
    setListWidth(initialLayout.listWidth != null ? initialLayout.listWidth : DEFAULT_LIST_WIDTH);
    setTimelineHeight(initialLayout.timelineHeight != null ? initialLayout.timelineHeight : DEFAULT_TIMELINE_HEIGHT);
    setIsTimelineCollapsed(initialLayout.isTimelineCollapsed ?? DEFAULT_IS_TIMELINE_COLLAPSED);
  }, [initialLayout]);

  const scheduleOnLayoutChange = useCallback(() => {
    if (!onLayoutChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const { listWidth: lw, timelineHeight: th, isTimelineCollapsed: itc } = latestRef.current;
      onLayoutChange({ listWidth: lw, timelineHeight: th, isTimelineCollapsed: itc });
    }, DEBOUNCE_MS);
  }, [onLayoutChange]);

  const handleHorizontalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('horizontal');
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      listWidth,
      timelineHeight,
    };
  }, [listWidth, timelineHeight]);

  const handleVerticalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('vertical');
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      listWidth,
      timelineHeight,
    };
  }, [listWidth, timelineHeight]);

  const handleResizeMove = useCallback((e: MouseEvent, containerElement?: HTMLElement) => {
    if (!resizeStartRef.current) return;

    if (isResizing === 'horizontal') {
      const container = containerElement || document.querySelector('.main-content') as HTMLElement;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newListWidth = Math.max(20, Math.min(80, resizeStartRef.current.listWidth + deltaPercent));
      setListWidth(newListWidth);
    } else if (isResizing === 'vertical') {
      const deltaY = e.clientY - resizeStartRef.current.y;
      const newTimelineHeight = Math.max(0, Math.min(600, resizeStartRef.current.timelineHeight - deltaY));
      setTimelineHeight(newTimelineHeight);
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null);
    resizeStartRef.current = null;
    scheduleOnLayoutChange();
  }, [scheduleOnLayoutChange]);

  const handleResizeLeave = useCallback(() => {
    setIsResizing(null);
    resizeStartRef.current = null;
  }, []);

  const toggleTimeline = useCallback(() => {
    setIsTimelineCollapsed(prev => {
      const next = !prev;
      if (onLayoutChange) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          onLayoutChange({ listWidth, timelineHeight, isTimelineCollapsed: next });
        }, DEBOUNCE_MS);
      }
      return next;
    });
  }, [onLayoutChange, listWidth, timelineHeight]);

  return {
    listWidth,
    timelineHeight,
    isTimelineCollapsed,
    isResizing,
    resizeStartRef,
    handleHorizontalResizeStart,
    handleVerticalResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handleResizeLeave,
    toggleTimeline,
  };
}
