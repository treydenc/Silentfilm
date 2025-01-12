// app/frame/[frameId]/page.jsx
import Timeline from '@/components/Timeline';
import FrameEditorWrapper from '@/components/FrameEditorWrapper';

export default function FrameEditor({ params }) {
  const frameId = params.frameId;  // Remove the await
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* <Timeline currentScene={frameId} /> */}
      <div className="">
        <FrameEditorWrapper frameId={frameId} />
      </div>
    </div>
  );
}