'use client';
// app/components/Timeline.jsx
import { motion } from 'framer-motion';

export default function Timeline({ currentScene }) {
  const scenes = [
    'opening', 'but1', 'therefore1', 'but2', 'therefore2', 
    'but3', 'therefore3', 'end', 'final'
  ];

  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-white shadow-sm z-50">
      <div className="container mx-auto px-4 h-full flex items-center">
        <div className="relative w-full h-1 bg-gray-200 rounded">
          {/* Timeline Track */}
          <div 
            className="absolute h-1 bg-blue-600 rounded"
            style={{
              width: `${(scenes.indexOf(currentScene) + 1) * (100 / scenes.length)}%`
            }}
          />

          {/* Scene Markers */}
          {scenes.map((scene, index) => (
            <motion.div
              key={scene}
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full 
                         ${scene === currentScene ? 'bg-blue-600' : 'bg-gray-400'}`}
              style={{ left: `${(index * 100) / (scenes.length - 1)}%` }}
              whileHover={{ scale: 1.2 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}