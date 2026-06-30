import UIHandler from '../ui/ui.handler.js';
import { APP_CONFIG } from './config.js';
import { logError, isValidDetection, createDelay } from './utils.js';
import CameraService from '../services/camera.service.js';
import DetectionService from '../services/detection.service.js';
import FunFactService from '../services/facts.service.js';

class RootFactsApp {
	constructor() {
		this.detector = null;
		this.camera = null;
		this.funFactGenerator = null;
		this.ui = new UIHandler();
		this.isRunning = false;
		this.currentLoopId = null;
		this.config = APP_CONFIG;
		this.currentFunFact = '';
		this.selectedTone = 'normal';
		this.lastFrameTime = 0;

		this.ui.disableButton();
		this.bindEvents();
		this.init();
		this.registerServiceWorker();
	}

	/**
	 * Bind all UI event callbacks for camera, FPS, tone, and copy.
	 */
	bindEvents() {
		this.ui.bindEvents({
			onToggleCamera: () => this.toggleCamera(),
			onCameraChange: () => this.onCameraChange(),
			onFPSChange: (fps) => this.onFPSChange(fps),
			onCopy: () => this.copyFunFact(),
			onToneChange: (tone) => this.onToneChange(tone)
		});
	}

	/**
	 * Initialize all services: camera, TF.js model, and Transformers.js model.
	 * Shows loading status in header with progress indication.
	 */
	async init() {
		try {
			// Step 1: Initialize camera service
			this.ui.updateHeaderStatus('Menunggu Model... 0%', false);
			this.camera = new CameraService();

			// Step 2: Load detection model (TensorFlow.js)
			this.ui.updateHeaderStatus('Memuat model... 30%', false);
			this.detector = new DetectionService();
			await this.detector.loadModel();

			// Step 3: Load fun fact generator (Transformers.js)
			this.ui.updateHeaderStatus('Memuat AI... 70%', false);
			this.funFactGenerator = new FunFactService();
			await this.funFactGenerator.loadModel();

			// All ready
			this.ui.updateHeaderStatus('Siap', false);
			this.ui.enableButton();

			console.log('✅ RootFacts App initialized successfully');
		} catch (error) {
			logError('Gagal menginisialisasi aplikasi', error);
			this.ui.updateHeaderStatus('Error', false);
			this.ui.showError(`Gagal menginisialisasi: ${error.message}`);
			this.ui.disableButton();
		}
	}

	/**
	 * Register Service Worker for offline capability.
	 */
	registerServiceWorker() {
		if ('serviceWorker' in navigator) {
			window.addEventListener('load', async() => {
				try {
					const registration = await navigator.serviceWorker.register('./sw.js');
					console.log('✅ Service Worker registered:', registration.scope);
				} catch (error) {
					logError('Service Worker registration failed', error);
				}
			});
		}
	}

	/**
	 * Copy the current fun fact text to clipboard.
	 */
	async copyFunFact() {
		const text = this.ui.getFunFactText();
		if (!text || text === 'Fakta menarik akan muncul di sini...') return;

		try {
			await navigator.clipboard.writeText(text);
			this.ui.setCopyButtonCopied();
			setTimeout(() => this.ui.resetCopyButton(), 2000);
		} catch (error) {
			logError('Gagal menyalin ke clipboard', error);
		}
	}

	/**
	 * Toggle the camera and detection loop on/off.
	 */
	toggleCamera() {
		if (this.isRunning) {
			this.stopCamera();
		} else {
			this.startCamera();
		}
	}

	/**
	 * Start the camera stream and detection loop.
	 */
	async startCamera() {
		try {
			this.ui.updateHeaderStatus('Memulai kamera...', false);
			await this.camera.startCamera();
			this.isRunning = true;
			this.ui.updateCameraUI(true);
			this.ui.switchToState('idle');
			this.startDetection();
		} catch (error) {
			logError('Gagal memulai kamera', error);
			this.ui.showError(error.message);
			this.isRunning = false;
		}
	}

	/**
	 * Stop the camera stream and detection loop.
	 */
	stopCamera() {
		this.stopDetection();
		this.camera.stopCamera();
		this.isRunning = false;
		this.ui.updateCameraUI(false);
		this.ui.switchToState('idle');
	}

	/**
	 * Start the detection loop.
	 */
	startDetection() {
		const loopId = Date.now();
		this.currentLoopId = loopId;
		this.detectLoop(loopId);
	}

	/**
	 * Stop the detection loop.
	 */
	stopDetection() {
		this.currentLoopId = null;
	}

	/**
	 * Main detection loop, throttled by FPS setting.
	 * @param {number} loopId
	 */
	async detectLoop(loopId) {
		if (this.currentLoopId !== loopId || !this.isRunning) return;

		const now = Date.now();
		const elapsed = now - this.lastFrameTime;
		const frameInterval = this.camera.getFrameInterval();

		if (elapsed >= frameInterval && this.camera.isReady() && this.detector.isLoaded()) {
			this.lastFrameTime = now;

			try {
				const result = await this.detector.predict(this.camera.video);

				if (isValidDetection(result) && this.currentLoopId === loopId) {
					this.ui.showResults(result, null);
					await this.generateAndShowResults(result);
					// Pause loop while fun fact is generated
					return;
				}
			} catch (error) {
				logError('Error dalam loop deteksi', error);
			}
		}

		// Continue loop on next frame
		if (this.currentLoopId === loopId) {
			requestAnimationFrame(() => this.detectLoop(loopId));
		}
	}

	/**
	 * Generate fun fact for a detected vegetable and display it.
	 * @param {{ className: string, confidence: number }} detectionResult
	 */
	async generateAndShowResults(detectionResult) {
		try {
			this.ui.updateFunFactState('loading');
			await createDelay(this.config.funFactGenerationDelay);

			if (!this.funFactGenerator.isReady()) {
				throw new Error('Fun fact generator belum siap');
			}

			const funFact = await this.funFactGenerator.generateFunFact(
				detectionResult.className,
				this.selectedTone
			);

			this.currentFunFact = funFact;
			this.ui.updateFunFactState('success', { funFact });
		} catch (error) {
			logError('Gagal menampilkan hasil', error);
			this.ui.updateFunFactState('error');
		} finally {
			// Resume detection loop after fun fact is shown
			if (this.isRunning) {
				await createDelay(this.config.analyzingDelay);
				this.startDetection();
			}
		}
	}

	/**
	 * Handle camera change event — restart camera if running.
	 */
	async onCameraChange() {
		if (this.isRunning) {
			this.stopDetection();
			this.camera.stopCamera();
			await this.camera.startCamera();
			this.startDetection();
		}
	}

	/**
	 * Handle FPS slider change.
	 * @param {number} fps
	 */
	onFPSChange(fps) {
		this.camera.setFPS(fps);
	}

	/**
	 * Handle tone/persona dropdown change.
	 * @param {string} tone
	 */
	onToneChange(tone) {
		this.selectedTone = tone;
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const app = new RootFactsApp();

	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
});

export default RootFactsApp;
