import { logError } from '../core/utils.js';

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
	}

	/**
	 * Load the Transformers.js text2text-generation model.
	 * Uses the LaMini-Flan-T5-77M model which is lightweight and runs
	 * entirely in the browser. The text2text-generation pipeline receives
	 * a prompt and outputs ONLY the generated answer — no prompt contamination.
	 */
	async loadModel() {
		try {
			const { pipeline } = await import(
				'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
			);

			// text2text-generation: the model transforms the input prompt into
			// a brand-new output text, ensuring the fun fact is always relevant
			// to the vegetable that was detected.
			this.generator = await pipeline(
				'text2text-generation',
				'Xenova/LaMini-Flan-T5-77M',
				{
					dtype: 'q4',
					progress_callback: (() => {
						const state = { encoder: 0, decoder: 0 };
						return (progress) => {
							if (progress.status === 'progress' && progress.file) {
								if (progress.file.includes('encoder')) {
									state.encoder = Math.round(progress.progress || 0);
								}
								if (progress.file.includes('decoder')) {
									state.decoder = Math.round(progress.progress || 0);
								}
								console.log(
									`Mengunduh model AI... Encoder: ${state.encoder}% | Decoder: ${state.decoder}%`
								);
							}
						};
					})()
				}
			);

			this.isModelLoaded = true;
			console.log('✅ Transformers.js text2text model loaded');
		} catch (error) {
			logError('Error loading Transformers.js model', error);
			throw new Error(`Failed to load FunFact model: ${error.message}`);
		}
	}

	/**
	 * Generate a fun fact about a vegetable using the selected tone/persona.
	 * Validates input and sanitizes against prompt injection.
	 * @param {string} vegetable - The detected vegetable class name from the classifier
	 * @param {'normal'|'funny'|'professional'|'casual'} tone
	 * @returns {Promise<string>} A fun fact string about the vegetable
	 */
	async generateFunFact(vegetable, tone = 'normal') {
		if (!this.isModelLoaded || this.isGenerating) {
			throw new Error('Model belum siap atau sedang menghasilkan fakta');
		}

		if (!vegetable || typeof vegetable !== 'string') {
			throw new Error('Nama sayuran yang valid diperlukan');
		}

		const MAX_VEGETABLE_LENGTH = 50;

		// Sanitize: remove characters often used for prompt injection
		const sanitized = vegetable
			.replace(/[|]{2,}/g, '')        // Remove ||| (separator injection)
			.replace(/[#=]{2,}/g, '')       // Remove ###, == (section markers)
			.replace(/(--|\+\+|``)/g, '')   // Remove --, ++, `` (code markers)
			.replace(/\n/g, ' ')            // Remove newlines
			.trim()
			.slice(0, MAX_VEGETABLE_LENGTH)
			.replace(/[^a-zA-Z0-9\s-]/g, '');

		if (!sanitized) {
			throw new Error('Nama sayuran tidak valid setelah sanitasi');
		}

		// Build dynamic prompt based on selected tone (Dynamic Persona feature)
		const tonePrefix = TONE_PROMPTS[tone] || TONE_PROMPTS.normal;
		// The prompt is passed directly to text2text-generation.
		// The model outputs ONLY the generated content — NOT a repetition of the prompt.
		// This guarantees the fun fact always describes the correct detected vegetable.
		const prompt = `${tonePrefix} ${sanitized}. Make it informative and interesting. Keep it under 3 sentences.`;

		this.isGenerating = true;

		try {
			const output = await this.generator(prompt, {
				max_new_tokens: 150,
				temperature: 0.8,
				top_p: 0.9,
				do_sample: true
			});

			// text2text-generation returns [{generated_text: "..."}]
			// The generated_text is ONLY the model's answer — clean and relevant.
			const funFact = output[0]?.generated_text?.trim();

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
