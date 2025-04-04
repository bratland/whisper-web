import { useRef, useEffect, useState } from "react";
import { TranscriberData } from "../hooks/useTranscriber";
import { formatAudioTimestamp } from "../utils/AudioUtils";
import Constants from "../utils/Constants";
import UrlConfigModal from "./modal/UrlConfigModal";

interface Props {
    transcribedData: TranscriberData | undefined;
}

export default function Transcript({ transcribedData }: Props) {
    const divRef = useRef<HTMLDivElement>(null);
    const [showUrlConfig, setShowUrlConfig] = useState(false);
    const [exportUrl, setExportUrl] = useState(Constants.EXPORT_URL);
    const [exportStatus, setExportStatus] = useState<{ success?: boolean; message: string } | null>(null);

    const saveBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportTXT = () => {
        let chunks = transcribedData?.chunks ?? [];
        let text = chunks
            .map((chunk) => chunk.text)
            .join("")
            .trim();

        const blob = new Blob([text], { type: "text/plain" });
        saveBlob(blob, "transcript.txt");
    };

    const exportJSON = () => {
        let jsonData = JSON.stringify(transcribedData?.chunks ?? [], null, 2);

        // post-process the JSON to make it more readable
        const regex = /(    "timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm;
        jsonData = jsonData.replace(regex, "$1[$2 $3]");

        const blob = new Blob([jsonData], { type: "application/json" });
        saveBlob(blob, "transcript.json");
    };

    const exportToDW = async () => {
        try {
            if (!transcribedData || !transcribedData.chunks) {
                setExportStatus({ success: false, message: "Ingen transkription tillgänglig" });
                return;
            }

            // Clear any previous status messages
            setExportStatus(null);
            
            // Show loading status
            setExportStatus({ message: "Skickar data..." });
            
            // Prepare the data to be sent
            const chunks = transcribedData.chunks;
            const text = chunks
                .map((chunk) => chunk.text)
                .join("")
                .trim();
                
            // Get the export URL from state
            const url = exportUrl;
            
            // Send the data
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    chunks: transcribedData.chunks,
                    timestamp: new Date().toISOString()
                }),
            });
            
            if (response.ok) {
                setExportStatus({ success: true, message: "Data skickades framgångsrikt" });
                
                // Clear the success message after 5 seconds
                setTimeout(() => {
                    setExportStatus(null);
                }, 5000);
            } else {
                throw new Error(`Server svarade med status: ${response.status}`);
            }
        } catch (error) {
            console.error("Export error:", error);
            setExportStatus({ 
                success: false, 
                message: `Fel vid export: ${error instanceof Error ? error.message : 'Okänt fel'}` 
            });
        }
    };

    const openUrlConfig = () => {
        setShowUrlConfig(true);
    };

    const handleUrlSave = (url: string) => {
        setExportUrl(url);
    };

    // Scroll to the bottom when the component updates
    useEffect(() => {
        if (divRef.current) {
            const diff = Math.abs(
                divRef.current.offsetHeight +
                    divRef.current.scrollTop -
                    divRef.current.scrollHeight,
            );

            if (diff <= 64) {
                // We're close enough to the bottom, so scroll to the bottom
                divRef.current.scrollTop = divRef.current.scrollHeight;
            }
        }
    });

    return (
        <div
            ref={divRef}
            className='w-full flex flex-col my-2 p-4 max-h-[20rem] overflow-y-auto'
        >
            {transcribedData?.chunks &&
                transcribedData.chunks.map((chunk, i) => (
                    <div
                        key={`${i}-${chunk.text}`}
                        className='w-full flex flex-row mb-2 bg-white rounded-lg p-4 shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
                    >
                        <div className='mr-5'>
                            {formatAudioTimestamp(chunk.timestamp[0])}
                        </div>
                        {chunk.text}
                    </div>
                ))}
                
            {/* Export status message */}
            {exportStatus && (
                <div className={`w-full my-2 p-3 rounded-md text-center ${
                    exportStatus.success === undefined ? 'bg-blue-100 text-blue-700' :
                    exportStatus.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                    {exportStatus.message}
                </div>
            )}
            
            {transcribedData && !transcribedData.isBusy && (
                <div className='w-full text-center'>
                    <div className="flex flex-wrap justify-center mb-2">
                        <button
                            onClick={exportToDW}
                            className='text-white bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center'
                        >
                            Exportera till DW databas
                        </button>
                        <button
                            onClick={openUrlConfig}
                            className='text-white bg-gray-500 hover:bg-gray-600 focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 mb-2 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800 inline-flex items-center'
                        >
                            Konfigurera URL
                        </button>
                    </div>
                    <div>
                        <button
                            onClick={exportTXT}
                            className='text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 inline-flex items-center'
                        >
                            Exportera till textfil
                        </button>
                        <button
                            onClick={exportJSON}
                            className='text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 inline-flex items-center'
                        >
                            Exportera till JSON
                        </button>
                    </div>
                </div>
            )}
            
            {/* URL Configuration Modal */}
            <UrlConfigModal 
                show={showUrlConfig}
                onClose={() => setShowUrlConfig(false)}
                onSave={handleUrlSave}
            />
        </div>
    );
}
