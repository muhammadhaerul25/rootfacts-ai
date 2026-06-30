import { logError, isWebGPUSupported } from '../core/utils.js';

// Tone persona prompt prefixes for dynamic persona feature
const TONE_PROMPTS = {
	normal: 'Write a short, informative fun fact about',
	funny: 'Write a short, funny and humorous fun fact about',
	professional: 'Write a short, formal and scientifically accurate fun fact about',
	casual: 'Write a short, friendly and casual fun fact about'
};

class FunFactService {
	constructor() {
		this.generator = null;
		this.isModelLoaded = false;
		this.isGenerating = false;
		this.config = null;
		this.currentBackend = null;
	}

	/**
	 * Load the Transformers.js text-generation model.
	 * Uses WebGPU if available, falls back to WASM.
	 */
	async loadModel() {
		try {
			const { pipeline, env } = await import(
				'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2/dist/transformers.min.js'
			);

			// Configure cache
			env.allowLocalModels = false;

			// Adaptive backend: check for WebGPU support
			let device = 'wasm';
			if (isWebGPUSupported()) {
				try {
					const adapter = await navigator.gpu.requestAdapter();
					if (adapter) {
						device = 'webgpu';
						this.currentBackend = 'webgpu';
						console.log('✅ Transformers.js using WebGPU device');
					}
				} catch {
					console.warn('⚠️ WebGPU not available for Transformers.js, using WASM');
					device = 'wasm';
					this.currentBackend = 'wasm';
				}
			} else {
				this.currentBackend = 'wasm';
				console.log('✅ Transformers.js using WASM device');
			}

			// Use a small but capable model with q4 quantization for performance
			this.generator = await pipeline(
				'text-generation',
				'Xenova/Qwen1.5-0.5B-Chat',
				{
					dtype: 'q4',
					device: device === 'webgpu' ? 'webgpu' : 'wasm'
				}
			);

			this.isModelLoaded = true;
			console.log('✅ Transformers.js model loaded');
		} catch (error) {
			logError('Error loading Transformers.js model', error);
			throw new Error(`Failed to load FunFact model: ${error.message}`);
		}
	}

	/**
	 * Generate a fun fact about a vegetable using the selected tone/persona.
	 * Validates input and sanitizes against prompt injection.
	 * @param {string} vegetable
	 * @param {'normal'|'funny'|'professional'|'casual'} tone
	 * @returns {Promise<string>}
	 */
	async generateFunFact(vegetable, tone = 'normal') {
		if (!this.isModelLoaded || this.isGenerating) {
			throw new Error('Model belum siap atau sedang menghasilkan fakta');
		}

		if (!vegetable || typeof vegetable !== 'string') {
			throw new Error('Nama sayuran yang valid diperlukan');
		}

		// Input validation: max 50 chars, only allow alphanumeric, spaces, and hyphens
		const sanitized = vegetable
			.trim()
			.slice(0, 50)
			.replace(/[^a-zA-Z0-9\s-]/g, '');

		if (!sanitized) {
			throw new Error('Nama sayuran tidak valid setelah sanitasi');
		}

		// Build dynamic prompt based on selected tone (Dynamic Persona feature)
		const tonePrefix = TONE_PROMPTS[tone] || TONE_PROMPTS.normal;
		const prompt = `${tonePrefix} ${sanitized}. Keep it under 3 sentences.`;

		this.isGenerating = true;

		try {
			const output = await this.generator(prompt, {
				max_new_tokens: 120,
				temperature: 0.8,
				top_p: 0.9,
				do_sample: true,
				repetition_penalty: 1.1
			});

			// Extract generated text and strip the original prompt
			const generatedText = output[0]?.generated_text || '';
			const funFact = generatedText
				.replace(prompt, '')
				.trim()
				.replace(/^\s*[-:]\s*/, '');

			return funFact || `${sanitized} is a nutritious vegetable with many health benefits!`;
		} catch (error) {
			logError('Error generating fun fact', error);
			throw new Error(`Failed to generate fun fact: ${error.message}`);
		} finally {
			this.isGenerating = false;
		}
	}

	/**
	 * Returns true if the model is loaded and not currently generating.
	 */
	isReady() {
		return this.isModelLoaded && !this.isGenerating;
	}
}

export default FunFactService;
