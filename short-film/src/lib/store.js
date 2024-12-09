'use client';
// app/lib/store.js
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const useFrameStore = create(
  persist(
    (set, get) => ({
      frames: {},
      
      // Add or update a frame
      updateFrame: (frameId, frameData) => set((state) => ({
        frames: {
          ...state.frames,
          [frameId]: {
            ...state.frames[frameId],
            ...frameData,
            lastUpdated: new Date().toISOString()
          }
        }
      })),
      
      // Get a specific frame
      getFrame: (frameId) => {
        const state = get();
        return state.frames[frameId] || null;
      },
      
      // Get all frames
      getAllFrames: () => {
        const state = get();
        return state.frames;
      },
      
      // Delete a frame
      deleteFrame: (frameId) => set((state) => {
        const newFrames = { ...state.frames };
        delete newFrames[frameId];
        return { frames: newFrames };
      }),
    }),
    {
      name: 'short-film-frames',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // Add this to prevent hydration issues
    }
  )
);

export default useFrameStore;