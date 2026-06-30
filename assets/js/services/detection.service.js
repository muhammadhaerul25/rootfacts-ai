import { logError, validateModelMetadata, isWebGPUSupported } from '../core/utils.js';

class DetectionService {
	constructor() {
		this.model = null;
		this.labels = [];
		this.config = null;
		this.currentBackend = null;
	}

	/**
	 * Load TensorFlow.js model with Adaptive Backend strategy.
	 * Checks navigator.gpu → WebGPU, falls back to WebGL.
	 */
	async loadModel() {
		try {
			// Adaptive Backend: prefer WebGPU, fall back to WebGL
			if (isWebGPUSupported()) {
				try {
					await tf.setBackend('webgpu');
					await tf.ready();
					this.currentBackend = 'webgpu';
					console.log('✅ TensorFlow.js using WebGPU backend');
				} catch {
					console.warn('⚠️ WebGPU init failed, falling back to WebGL');
					await tf.setBackend('webgl');
					await tf.ready();
					this.currentBackend = 'webgl';
				}
			} else {
				await tf.setBackend('webgl');
				await tf.ready();
				this.currentBackend = 'webgl';
				console.log('✅ TensorFlow.js using WebGL backend');
			}

			// Load model metadata for labels
			const metaResponse = await fetch('./model/metadata.json');
			const metadata = await metaResponse.json();

			if (!validateModelMetadata(metadata)) {
				throw new Error('Invalid model metadata: missing labels array');
			}

			this.labels = metadata.labels;

			// Load the actual TF.js layers model
			this.model = await tf.loadLayersModel('./model/model.json');

			console.log(`✅ Model loaded. Backend: ${this.currentBackend}. Labels: ${this.labels.join(', ')}`);
		} catch (error) {
			logError('Failed to load model', error);
			throw new Error(`Failed to load model: ${error.message}`);
		}
	}

	/**
	 * Run prediction on a video/image element.
	 * Uses tf.tidy() to prevent memory leaks.
	 * @param {HTMLVideoElement|HTMLImageElement} imageElement
	 * @returns {{ className: string, confidence: number, isValid: boolean } | null}
	 */
	async predict(imageElement) {
		if (!this.isLoaded() || !imageElement) return null;

		let predictions = null;
		try {
			predictions = tf.tidy(() => {
				// Preprocess: resize and normalize image to [0,1]
				const imgTensor = tf.browser.fromPixels(imageElement)
					.resizeBilinear([224, 224])
					.toFloat()
					.div(tf.scalar(255))
					.expandDims(0);

				const output = this.model.predict(imgTensor);
				// Return as plain array to avoid tensor leak outside tidy
				return output.dataSync();
			});

			if (!predictions || predictions.length === 0) return null;

			// Find highest confidence label
			let maxIndex = 0;
			let maxScore = predictions[0];
			for (let i = 1; i < predictions.length; i++) {
				if (predictions[i] > maxScore) {
					maxScore = predictions[i];
					maxIndex = i;
				}
			}

			const confidence = Math.round(maxScore * 100);
			const className = this.labels[maxIndex] || 'Unknown';

			return {
				className,
				confidence,
				isValid: true
			};
		} catch (error) {
			logError('Prediction error', error);
			throw new Error(`Prediksi gagal: ${error.message}`);
		} finally {
			// No explicit disposal needed because tf.tidy() handles tensor lifecycle
			predictions = null;
		}
	}

	/**
	 * Returns true if model is loaded and ready.
	 */
	isLoaded() {
		return this.model !== null && this.labels.length > 0;
	}
}

export default DetectionService;
