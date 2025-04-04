import { useState, useEffect, useRef } from "react";
import { AudioManager } from "./components/AudioManager";
import Transcript from "./components/Transcript";
import { useTranscriber } from "./hooks/useTranscriber";

function App() {
    const transcriber = useTranscriber();
    const [loadingInitiated, setLoadingInitiated] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [modelLoaded, setModelLoaded] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Ensure all timers are cleared when component unmounts or when we leave the page
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);
    
    // Automatically load the model on page load
    useEffect(() => {
        // Only trigger loading once
        if (loadingInitiated) return;
        
        setLoadingInitiated(true);
        setLoadingMessage("Laddar AI-modell...");
        
        try {
            // Create a small audio buffer to trigger model loading
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const buffer = audioContext.createBuffer(1, 100, 16000);
            
            // Trigger the model loading
            transcriber.start(buffer);
        } catch (error) {
            console.error("Error loading model:", error);
            setLoadingMessage("Fel vid laddning av modell");
        }
    }, [loadingInitiated, transcriber]);
    
    // Track when model is fully loaded to show success message and auto-hide it
    useEffect(() => {
        // Check if the model is ready based on the isModelReady flag
        if (loadingInitiated && transcriber.isModelReady && !modelLoaded) {
            console.log("Model is ready, showing success message");
            
            // Model has finished loading and this is the first time we're seeing it loaded
            setLoadingMessage("AI-modell laddad och redo för användning");
            setModelLoaded(true);
            
            console.log("Setting success message timer");
            
            // Important: Clear any existing timer first
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            
            // Clear the message after 5 seconds
            timerRef.current = setTimeout(() => {
                console.log("Clearing success message");
                setLoadingMessage("");
            }, 5000);
        }
        
        // Clean up timer on unmount
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [loadingInitiated, transcriber.isModelReady, modelLoaded]);
    
    // Automatically hide success message after it appears
    useEffect(() => {
        // When we see the success message, set a timer to clear it
        if (loadingMessage && loadingMessage.includes("redo för användning")) {
            console.log("Success message detected, setting auto-hide timer");
            
            // Clear any existing timer
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            
            // Set new timer to clear the message
            timerRef.current = setTimeout(() => {
                console.log("Auto-hiding success message after timeout");
                setLoadingMessage("");
            }, 5000);
            
            // Clean up on unmount or when message changes
            return () => {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
            };
        }
    }, [loadingMessage]);
    
    // Failsafe: Clear loading message if it's shown for too long (60 seconds max)
    useEffect(() => {
        if (loadingMessage && loadingMessage.includes("filer")) {
            const failsafeTimer = setTimeout(() => {
                console.log("Failsafe: Clearing loading message after timeout");
                if (transcriber.isModelReady) {
                    setLoadingMessage("AI-modell laddad och redo för användning");
                    
                    // Then clear after 5 seconds
                    setTimeout(() => {
                        setLoadingMessage("");
                    }, 5000);
                } else {
                    setLoadingMessage("");
                }
            }, 60000); // 60 seconds timeout
            
            return () => clearTimeout(failsafeTimer);
        }
    }, [loadingMessage, transcriber.isModelReady]);
    
    // Update loading message based on current state
    useEffect(() => {
        if (!loadingInitiated) return;
        
        if (transcriber.isModelLoading) {
            // Model is currently loading
            setLoadingMessage("Laddar AI-modell...");
        } else if (transcriber.progressItems.length > 0) {
            // Model is downloading files
            setLoadingMessage("Laddar AI-modell filer...");
        }
    }, [loadingInitiated, transcriber.isModelLoading, transcriber.progressItems.length]);

    return (
        <div className='flex flex-col justify-center items-center min-h-screen'>
            <div className='container flex flex-col justify-center items-center'>
                <div className='flex items-center'>
                    <h1 className='text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl text-center mt-11'>
                    KB-Whisper
                </h1>
                </div>
                <h2 className='mb-5 px-4 text-center text-1xl font-semibold tracking-tight text-slate-900 sm:text-2xl'>
                    Transkribera svenskt ljud direkt i din webbläsare
                </h2>
                
                {/* Loading status */}
                <div className={`mb-4 p-3 rounded-md w-full max-w-md text-center transition-opacity duration-700 ease-in-out ${
                    loadingMessage 
                        ? "opacity-100" 
                        : "opacity-0 h-0 p-0 m-0 overflow-hidden"
                } ${
                    loadingMessage?.includes("redo") 
                        ? "bg-green-100 text-green-700" 
                        : loadingMessage?.includes("Fel") 
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                }`}>
                    {loadingMessage && (
                        <>
                            <div className="font-medium">{loadingMessage}</div>
                            
                            {/* Show progress items if any */}
                            {transcriber.progressItems.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-xs font-medium mb-1">Filer som laddas:</div>
                                    <ul className="text-xs space-y-1">
                                        {transcriber.progressItems.map((item, index) => (
                                            <li key={index} className="flex justify-between">
                                                <span>{item.name || item.file.split('/').pop()}</span>
                                                <span className="font-medium">{Math.max(1, Math.round(item.progress * 100))}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                <AudioManager transcriber={transcriber} />
                <Transcript transcribedData={transcriber.output} />
            </div>

            <footer className='text-center mt-4'>
                <b>OBS: Ljudet transkriberas helt lokalt. För att göra det laddar webbsidan ner en AI-modell.</b>
                
            </footer>
        </div>
    );
}

export default App;
