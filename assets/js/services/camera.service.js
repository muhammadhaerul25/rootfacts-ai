import {
	getCameraErrorMessage,
	logError
} from '../core/utils.js';

class CameraService {
	constructor() {
		this.stream = null;
		this.video = null;
		this.canvas = null;
		this.config = null;
		this.currentFPS = 30;

		this.initializeElements();
		this.init();
	}

	/**
	 * Initialize DOM elements needed for camera operations.
	 */
	initializeElements() {
		this.video = document.getElementById('videoElement');
		this.canvas = document.getElementById('canvasElement');
		this.cameraSelect = document.getElementById('camera-select');
	}

	async init() {
		await this.loadCameras();
	}

	/**
	 * Enumerate available media devices and populate camera selector.
	 */
	async loadCameras() {
		try {
			// Request media permission first so device labels are exposed
			const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
			tempStream.getTracks().forEach(track => track.stop());

			const devices = await navigator.mediaDevices.enumerateDevices();
			const videoDevices = devices.filter(d => d.kind === 'videoinput');

			if (this.cameraSelect && videoDevices.length > 0) {
				// Preserve existing options (Belakang / Depan) as facingMode choices
				// Keep them unless we have actual device labels
				if (videoDevices.some(d => d.label)) {
					this.cameraSelect.innerHTML = '';
					videoDevices.forEach((device, idx) => {
						const option = document.createElement('option');
						option.value = device.deviceId;
						option.textContent = device.label || `Kamera ${idx + 1}`;
						this.cameraSelect.appendChild(option);
					});
				}
			}
		} catch (error) {
			logError('Gagal memuat kamera', error);
			throw new Error(`Akses kamera gagal: ${error.message}`);
		}
	}

	/**
	 * Start camera stream based on the selected camera option.
	 */
	async startCamera() {
		try {
			const selectedValue = this.cameraSelect?.value ?? 'default';

			let constraints;
			// If value is a device ID (not our preset values), use it directly
			if (selectedValue !== 'default' && selectedValue !== 'front' && selectedValue.length > 10) {
				constraints = {
					video: {
						deviceId: { exact: selectedValue },
						width: { ideal: 640 },
						height: { ideal: 480 }
					}
				};
			} else {
				// Use facingMode: 'user' for front camera, 'environment' for rear
				const facingMode = selectedValue === 'front' ? 'user' : 'environment';
				constraints = {
					video: {
						facingMode,
						width: { ideal: 640 },
						height: { ideal: 480 }
					}
				};
			}

			this.stream = await navigator.mediaDevices.getUserMedia(constraints);

			if (this.video) {
				this.video.srcObject = this.stream;
				await new Promise((resolve, reject) => {
					this.video.onloadedmetadata = resolve;
					this.video.onerror = reject;
				});
				await this.video.play();
			}

			// Sync canvas dimensions with video
			if (this.canvas && this.video) {
				this.canvas.width = this.video.videoWidth || 640;
				this.canvas.height = this.video.videoHeight || 480;
			}
		} catch (error) {
			logError('Gagal memulai kamera', error);
			const errorMessage = getCameraErrorMessage(error);
			throw new Error(errorMessage);
		}
	}

	/**
	 * Stop all active camera tracks and release resources.
	 */
	stopCamera() {
		if (this.stream) {
			this.stream.getTracks().forEach(track => track.stop());
			this.stream = null;
		}
		if (this.video) {
			this.video.srcObject = null;
		}
	}

	/**
	 * Update the target FPS for detection loop throttling.
	 * @param {number} fps
	 */
	setFPS(fps) {
		this.currentFPS = fps;
	}

	/**
	 * Returns the interval in ms between frames at the current FPS setting.
	 */
	getFrameInterval() {
		return 1000 / this.currentFPS;
	}

	/**
	 * Returns true if the camera stream is active.
	 */
	isActive() {
		return this.stream !== null && this.stream.active;
	}

	/**
	 * Returns true if the video element is ready to be used for predictions.
	 */
	isReady() {
		return (
			this.video !== null &&
			this.video.readyState >= 2 && // HAVE_CURRENT_DATA
			this.isActive()
		);
	}
}

export default CameraService;
