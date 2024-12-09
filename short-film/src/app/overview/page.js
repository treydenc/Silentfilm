'use client';
// app/overview/page.jsx
import Link from 'next/link';
import { motion } from 'framer-motion';

const sceneTypes = [
  { id: 'opening', label: 'Opening Scene', description: 'Set up your story' },
  { id: 'but1', label: 'But', description: 'First turning point' },
  { id: 'therefore1', label: 'Therefore', description: 'First consequence' },
  { id: 'but2', label: 'But', description: 'Second turning point' },
  { id: 'therefore2', label: 'Therefore', description: 'Second consequence' },
  { id: 'but3', label: 'But', description: 'Final challenge' },
  { id: 'therefore3', label: 'Therefore', description: 'Resolution' },
  { id: 'end', label: 'End Moment', description: 'Story climax' },
  { id: 'final', label: 'Final Shot', description: 'Closing image' }
];

export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Garamond' }}>
          Story Overview
        </h1>
        <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
          Build your story scene by scene
        </p>
      </header>

      {/* Grid of Scenes */}
      <div className="grid grid-cols-3 gap-6">
        {sceneTypes.map((scene, index) => (
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/frame/${scene.id}`}>
              <div className="bg-white rounded-lg shadow-sm p-6 h-64 flex flex-col cursor-pointer hover:shadow-md transition-shadow">
                {/* Scene Thumbnail or Placeholder */}
                <div className="flex-1 bg-gray-100 rounded-md mb-4 flex items-center justify-center">
                  <span className="text-gray-400">Scene Content</span>
                </div>
                
                {/* Scene Info */}
                <div>
                  <h3 className="font-semibold mb-1" style={{ fontFamily: 'Caslon' }}>
                    {scene.label}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {scene.description}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <Link 
          href="/"
          className="text-gray-600 hover:text-gray-900 transition-colors"
          style={{ fontFamily: 'Future' }}
        >
          ← Back to Home
        </Link>
        <Link 
          href="/frame/opening"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          style={{ fontFamily: 'Future' }}
        >
          Start Creating →
        </Link>
      </div>
    </div>
  );
}