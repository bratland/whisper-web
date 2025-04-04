/* eslint-disable camelcase */
import { pipeline, env } from "@huggingface/transformers";

// Disable local models
env.allowLocalModels = false;

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
    static task = null;
    static model = null;
    static dtype = null;
    static gpu = null;
    static instance = null;

    constructor(tokenizer, model, dtype, gpu) {
        this.tokenizer = tokenizer;
        this.model = model;
        this.dtype = dtype;
        this.gpu = gpu;
    }

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                dtype: this.dtype,
                device: this.gpu ? "webgpu" : "wasm",
                progress_callback,

                // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
                revision: this.model.includes("/whisper-medium") ? "no_attentions" : "main"
            });
        }

        return this.instance;
    }
}

self.addEventListener("message", async (event) => {
    const message = event.data;

    try {
        // Check if this is a tiny audio buffer (for preloading)
        if (message.audio && message.audio.length < 500) {
            console.log("Small audio buffer detected - preloading model");
            
            // Get the pipeline factory
            const p = AutomaticSpeechRecognitionPipelineFactory;
            
            // Setup model parameters
            let modelName = message.model;
            if (!modelName.startsWith("distil-whisper/") && !message.multilingual) {
                modelName += ".en";
            }
            
            p.model = modelName;
            p.dtype = message.dtype;
            p.gpu = message.gpu;
            
            // Send initiate message
            self.postMessage({
                status: "initiate",
                task: "automatic-speech-recognition",
                file: `${modelName}`,
                name: "Whisper model",
                progress: 0.01,
                loaded: 1,
                total: 100
            });
            
            // Setup progress tracking
            const startTime = Date.now();
            let progressTimer = setInterval(() => {
                const progress = Math.min(0.95, (Date.now() - startTime) / 30000);
                self.postMessage({
                    status: "progress",
                    file: `${modelName}`,
                    name: "Whisper model",
                    progress: progress,
                    loaded: Math.floor(progress * 100),
                    total: 100
                });
            }, 1000);
            
            try {
                // Load the model
                await p.getInstance((data) => {
                    // Forward progress data
                    self.postMessage(data);
                });
                
                // Clear progress timer
                clearInterval(progressTimer);
                
                // Send 100% progress message
                self.postMessage({
                    status: "progress",
                    file: `${modelName}`,
                    name: "Whisper model",
                    progress: 1.0,
                    loaded: 100,
                    total: 100
                });
                
                // Send done message to clear the progress item
                self.postMessage({
                    status: "done",
                    file: `${modelName}`,
                    name: "Whisper model"
                });
                
                // Send ready message
                self.postMessage({
                    status: "ready",
                    task: "automatic-speech-recognition"
                });
                
                // Send empty result
                self.postMessage({
                    status: "complete",
                    task: "automatic-speech-recognition",
                    data: {
                        text: "",
                        chunks: []
                    }
                });
                
                return;
            } catch (error) {
                // Clear progress timer
                clearInterval(progressTimer);
                
                // Send error
                console.error("Error loading model:", error);
                self.postMessage({
                    status: "error",
                    task: "automatic-speech-recognition",
                    data: {
                        message: error.message || "Failed to load model",
                        autoload: true
                    }
                });
                
                return;
            }
        }
    
        // Normal transcription for regular audio
        let transcript = await transcribe(
            message.audio,
            message.model,
            message.multilingual,
            message.dtype,
            message.gpu,
            message.subtask,
            message.language,
        );
        
        if (transcript === null) return;
    
        // Send the result back to the main thread
        self.postMessage({
            status: "complete",
            task: "automatic-speech-recognition",
            data: transcript,
        });
    } catch (error) {
        console.error("Worker error:", error);
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: {
                message: error.message || "Failed to process audio",
            }
        });
    }
});

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
    static task = "automatic-speech-recognition";
    static model = null;
    static dtype = null;
    static gpu = null;
}

const transcribe = async (
    audio,
    model,
    multilingual,
    dtype,
    gpu,
    subtask,
    language,
) => {

    const isDistilWhisper = model.startsWith("distil-whisper/");

    let modelName = model;
    if (!isDistilWhisper && !multilingual) {
        modelName += ".en"
    }

    const p = AutomaticSpeechRecognitionPipelineFactory;
    if (p.model !== modelName || p.dtype !== dtype || p.gpu !== gpu) {
        // Invalidate model if different
        p.model = modelName;
        p.dtype = dtype;
        p.gpu = gpu;

        if (p.instance !== null) {
            (await p.getInstance()).dispose();
            p.instance = null;
        }
    }

    // Load transcriber model
    let transcriber = await p.getInstance((data) => {
        self.postMessage(data);
    });

    const time_precision =
        transcriber.processor.feature_extractor.config.chunk_length /
        transcriber.model.config.max_source_positions;

    // Storage for chunks to be processed. Initialise with an empty chunk.
    let chunks_to_process = [
        {
            tokens: [],
            finalised: false,
        },
    ];

    // TODO: Storage for fully-processed and merged chunks
    // let decoded_chunks = [];

    function chunk_callback(chunk) {
        let last = chunks_to_process[chunks_to_process.length - 1];

        // Overwrite last chunk with new info
        Object.assign(last, chunk);
        last.finalised = true;

        // Create an empty chunk after, if it not the last chunk
        if (!chunk.is_last) {
            chunks_to_process.push({
                tokens: [],
                finalised: false,
            });
        }
    }

    // Inject custom callback function to handle merging of chunks
    function callback_function(item) {
        let last = chunks_to_process[chunks_to_process.length - 1];

        // Update tokens of last chunk
        last.tokens = [...item[0].output_token_ids];

        // Merge text chunks
        // TODO optimise so we don't have to decode all chunks every time
        let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
            time_precision: time_precision,
            return_timestamps: true,
            force_full_sequences: false,
        });

        self.postMessage({
            status: "update",
            task: "automatic-speech-recognition",
            data: data,
        });
    }

    // Actually run transcription
    let output = await transcriber(audio, {
        // Greedy
        top_k: 0,
        do_sample: false,

        // Sliding window
        chunk_length_s: isDistilWhisper ? 20 : 30,
        stride_length_s: isDistilWhisper ? 3 : 5,

        // Language and task
        language: language,
        task: subtask,

        // Return timestamps
        return_timestamps: true,
        force_full_sequences: false,

        // Callback functions
        callback_function: callback_function, // after each generation step
        chunk_callback: chunk_callback, // after each chunk is processed
    }).catch((error) => {
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: error,
        });
        return null;
    });

    return output;
};
