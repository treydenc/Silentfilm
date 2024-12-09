'use client';
// app/page.js
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl w-full space-y-12 text-center"
      >
        {/* Title */}
        <motion.h1 
          className="text-6xl font-bold text-gray-900"
          style={{ fontFamily: 'Garamond' }}
        >
          Short Story Builder
        </motion.h1>

        {/* About Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg p-8 shadow-sm"
        >
          <h2 className="text-2xl font-semibold mb-4" style={{ fontFamily: 'Caslon' }}>About</h2>
          <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
            Welcome to Short Story Builder, a creative tool that helps you
            visualize and construct your story frame by frame. Build your
            narrative with our intuitive interface and bring your ideas to life.
          </p>
        </motion.div>

        {/* Begin Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Link 
            href="/overview"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg 
                     font-medium hover:bg-blue-700 transition-colors duration-200"
            style={{ fontFamily: 'Future' }}
          >
            Begin
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}