// lottie-manager.js
class LottieAnimationManager {
    constructor() {
        this.animations = new Map();
        this.lottieLoaded = false;
        this.initializationPromise = null;
    }

    async initialize() {
        if (this.lottieLoaded) return;
        
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = new Promise(async (resolve, reject) => {
            try {
                // Simplified Lottie initialization
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('lottie.min.js');
                script.onload = () => {
                    this.lottieLoaded = true;
                    resolve();
                };
                script.onerror = (error) => {
                    console.error('Failed to load Lottie:', error);
                    reject(error);
                };
                document.head.appendChild(script);
            } catch (error) {
                console.error('Lottie initialization failed:', error);
                this.lottieLoaded = false;
                this.initializationPromise = null;
                reject(error);
            }
        });

        return this.initializationPromise;
    }

    async createAnimation(containerId, type) {
        try {
            await this.initialize();
            
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container ${containerId} not found`);
            }

            // Set container styles
            Object.assign(container.style, {
                width: '100px',
                height: '100px',
                margin: '0 auto'
            });

            // Direct path to the animation file
            const animationPath = chrome.runtime.getURL(`${type}.json`);
            
            // Create animation instance
            const animation = lottie.loadAnimation({
                container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: animationPath
            });

            // Store animation instance
            this.animations.set(containerId, animation);

            // Add event listeners
            animation.addEventListener('DOMLoaded', () => {
                console.log(`Animation ${type} DOM loaded`);
            });

            animation.addEventListener('data_ready', () => {
                console.log(`Animation ${type} data ready`);
            });

            animation.addEventListener('error', (error) => {
                console.error(`Animation ${type} error:`, error);
                this.showFallbackSpinner(container);
            });

            return animation;

        } catch (error) {
            console.error('Animation creation failed:', error);
            const container = document.getElementById(containerId);
            if (container) {
                this.showFallbackSpinner(container);
            }
            throw error;
        }
    }

    showFallbackSpinner(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="timio-spinner-fallback"></div>
        `;
    }

    destroyAnimation(containerId) {
        const animation = this.animations.get(containerId);
        if (animation) {
            animation.destroy();
            this.animations.delete(containerId);
        }
    }

    destroyAllAnimations() {
        this.animations.forEach(animation => animation.destroy());
        this.animations.clear();
    }
}

// Create singleton instance
const animationManager = new LottieAnimationManager();

// Make functions available globally
window.setupAnimation = async function(containerId, animationType) {
    console.log(`Setting up ${animationType} animation in ${containerId}`);
    
    try {
        return await animationManager.createAnimation(containerId, animationType);
    } catch (error) {
        console.error('Animation setup failed:', error);
        throw error;
    }
};

window.cleanupAnimations = function() {
    animationManager.destroyAllAnimations();
};