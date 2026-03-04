        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const canvasWrapper = document.getElementById('canvasWrapper');
        
        let activeLayer = 1;
        let uiScale = 1;
        let canvasZoom = 1;
        let currentTab = 'basic';
        let threshold = 30;
        
        // Сохраняем оригинальное изображение для восстановления
        let originalImages = {1: null, 2: null, 3: null};
        
        let layers = {
            1: { 
                image: null, x: 200, y: 150, scale: 1, rotation: 0, opacity: 1, blendMode: 'source-over', flipX: false, flipY: false,
                brightness: 0, contrast: 0, saturation: 0, temperature: 0, hue: 0,
                blur: 0, sharpness: 0, vignette: 0, hdr: 0, grain: 0
            },
            2: { 
                image: null, x: 400, y: 250, scale: 1, rotation: 0, opacity: 1, blendMode: 'source-over', flipX: false, flipY: false,
                brightness: 0, contrast: 0, saturation: 0, temperature: 0, hue: 0,
                blur: 0, sharpness: 0, vignette: 0, hdr: 0, grain: 0
            },
            3: { 
                image: null, x: 600, y: 350, scale: 1, rotation: 0, opacity: 1, blendMode: 'source-over', flipX: false, flipY: false,
                brightness: 0, contrast: 0, saturation: 0, temperature: 0, hue: 0,
                blur: 0, sharpness: 0, vignette: 0, hdr: 0, grain: 0
            }
        };

        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;

        const blendModeNames = {
            'source-over': 'Обычный',
            'multiply': 'Умножение',
            'screen': 'Экран',
            'overlay': 'Наложение',
            'darken': 'Темнее',
            'lighten': 'Светлее',
            'color-dodge': 'Dodge',
            'hard-light': 'Свет'
        };

        // ===== УДАЛЕНИЕ ФОНА =====
        
        function removeBackground(method) {
            const layer = layers[activeLayer];
            if (!layer.image) {
                showHint('Загрузите изображение!');
                return;
            }

            showHint('Обработка...');
            
            // Сохраняем оригинал если ещё не сохранен
            if (!originalImages[activeLayer]) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = layer.image.width;
                tempCanvas.height = layer.image.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(layer.image, 0, 0);
                originalImages[activeLayer] = tempCanvas;
            }
            
            const srcCanvas = originalImages[activeLayer];
            const dstCanvas = document.createElement('canvas');
            dstCanvas.width = srcCanvas.width;
            dstCanvas.height = srcCanvas.height;
            const dstCtx = dstCanvas.getContext('2d');
            
            dstCtx.drawImage(srcCanvas, 0, 0);
            const imageData = dstCtx.getImageData(0, 0, dstCanvas.width, dstCanvas.height);
            const data = imageData.data;
            
            let targetColor = {r: 255, g: 255, b: 255}; // По умолчанию белый
            
            switch(method) {
                case 'white':
                    targetColor = {r: 255, g: 255, b: 255};
                    break;
                case 'black':
                    targetColor = {r: 0, g: 0, b: 0};
                    break;
                case 'green':
                    targetColor = {r: 0, g: 255, b: 0};
                    break;
                case 'blue':
                    targetColor = {r: 0, g: 0, b: 255};
                    break;
                case 'auto':
                    // Берем цвет из углов изображения
                    targetColor = getCornerColor(data, dstCanvas.width, dstCanvas.height);
                    break;
            }
            
            // Удаляем фон
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const diff = Math.sqrt(
                    Math.pow(r - targetColor.r, 2) +
                    Math.pow(g - targetColor.g, 2) +
                    Math.pow(b - targetColor.b, 2)
                );
                
                // Если цвет близок к целевому, делаем прозрачным
                if (diff < threshold * 4) {
                    data[i + 3] = 0; // Прозрачность
                } else if (diff < threshold * 6) {
                    // Плавный переход
                    data[i + 3] = Math.floor((diff - threshold * 4) / (threshold * 2) * 255);
                }
            }
            
            dstCtx.putImageData(imageData, 0, 0);
            layer.image = dstCanvas;
            
            render();
            showHint('Фон удалён!');
        }

        function getCornerColor(data, width, height) {
            // Берем средний цвет из углов
            const samples = [];
            const sampleSize = 5;
            
            // Левый верхний угол
            for (let y = 0; y < sampleSize; y++) {
                for (let x = 0; x < sampleSize; x++) {
                    const i = (y * width + x) * 4;
                    samples.push({r: data[i], g: data[i+1], b: data[i+2]});
                }
            }
            
            // Правый верхний угол
            for (let y = 0; y < sampleSize; y++) {
                for (let x = width - sampleSize; x < width; x++) {
                    const i = (y * width + x) * 4;
                    samples.push({r: data[i], g: data[i+1], b: data[i+2]});
                }
            }
            
            // Средний цвет
            const avg = {r: 0, g: 0, b: 0};
            samples.forEach(s => {
                avg.r += s.r;
                avg.g += s.g;
                avg.b += s.b;
            });
            avg.r = Math.floor(avg.r / samples.length);
            avg.g = Math.floor(avg.g / samples.length);
            avg.b = Math.floor(avg.b / samples.length);
            
            return avg;
        }

        function restoreBackground() {
            const layer = layers[activeLayer];
            if (!originalImages[activeLayer]) {
                showHint('Нечего восстанавливать');
                return;
            }
            
            layer.image = originalImages[activeLayer];
            render();
            showHint('Фон восстановлен');
        }

        function expandTransparency() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = layer.image.width;
            canvas.height = layer.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(layer.image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const newData = new Uint8ClampedArray(data);
            
            // Расширяем прозрачные области
            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const i = (y * canvas.width + x) * 4;
                    
                    if (data[i + 3] < 128) {
                        // Если пиксель прозрачный, проверяем соседей
                        const neighbors = [
                            data[((y-1) * canvas.width + x) * 4 + 3],
                            data[((y+1) * canvas.width + x) * 4 + 3],
                            data[(y * canvas.width + (x-1)) * 4 + 3],
                            data[(y * canvas.width + (x+1)) * 4 + 3]
                        ];
                        
                        const hasOpaque = neighbors.some(a => a > 128);
                        if (hasOpaque) {
                            newData[i + 3] = Math.max(0, data[i + 3] - 50);
                        }
                    }
                }
            }
            
            for (let i = 0; i < data.length; i++) {
                data[i] = newData[i];
            }
            
            ctx.putImageData(imageData, 0, 0);
            layer.image = canvas;
            render();
            showHint('Прозрачность расширена');
        }

        function shrinkTransparency() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = layer.image.width;
            canvas.height = layer.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(layer.image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const newData = new Uint8ClampedArray(data);
            
            // Сжимаем непрозрачные области
            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const i = (y * canvas.width + x) * 4;
                    
                    if (data[i + 3] > 128) {
                        const neighbors = [
                            data[((y-1) * canvas.width + x) * 4 + 3],
                            data[((y+1) * canvas.width + x) * 4 + 3],
                            data[(y * canvas.width + (x-1)) * 4 + 3],
                            data[(y * canvas.width + (x+1)) * 4 + 3]
                        ];
                        
                        const hasTransparent = neighbors.some(a => a < 128);
                        if (hasTransparent) {
                            newData[i + 3] = Math.max(0, data[i + 3] - 100);
                        }
                    }
                }
            }
            
            for (let i = 0; i < data.length; i++) {
                data[i] = newData[i];
            }
            
            ctx.putImageData(imageData, 0, 0);
            layer.image = canvas;
            render();
            showHint('Прозрачность сжата');
        }

        function smoothEdges() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = layer.image.width;
            canvas.height = layer.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(layer.image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const newData = new Uint8ClampedArray(data);
            
            // Сглаживаем края через усреднение
            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const i = (y * canvas.width + x) * 4;
                    
                    const alphaSum = data[i + 3] +
                        data[((y-1) * canvas.width + x) * 4 + 3] +
                        data[((y+1) * canvas.width + x) * 4 + 3] +
                        data[(y * canvas.width + (x-1)) * 4 + 3] +
                        data[(y * canvas.width + (x+1)) * 4 + 3];
                    
                    newData[i + 3] = Math.floor(alphaSum / 5);
                }
            }
            
            for (let i = 0; i < data.length; i += 4) {
                data[i + 3] = newData[i + 3];
            }
            
            ctx.putImageData(imageData, 0, 0);
            layer.image = canvas;
            render();
            showHint('Края сглажены');
        }

        function invertTransparency() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = layer.image.width;
            canvas.height = layer.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(layer.image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Инвертируем прозрачность
            for (let i = 0; i < data.length; i += 4) {
                data[i + 3] = 255 - data[i + 3];
            }
            
            ctx.putImageData(imageData, 0, 0);
            layer.image = canvas;
            render();
            showHint('Прозрачность инвертирована');
        }

        // Обновление порога
        function initSlider(sliderId, callback) {
            const slider = document.getElementById(sliderId);
            let isDraggingSlider = false;

            slider.addEventListener('mousedown', (e) => {
                const rect = slider.getBoundingClientRect();
                const clickPos = (e.clientX - rect.left) / rect.width;
                const sliderValue = (slider.value - slider.min) / (slider.max - slider.min);
                
                if (Math.abs(clickPos - sliderValue) < 0.05) {
                    isDraggingSlider = true;
                } else {
                    e.preventDefault();
                }
            });

            slider.addEventListener('touchstart', () => {
                isDraggingSlider = true;
            });

            slider.addEventListener('input', (e) => {
                if (isDraggingSlider) {
                    callback(e);
                }
            });

            slider.addEventListener('change', (e) => {
                if (isDraggingSlider) {
                    callback(e);
                }
            });

            slider.addEventListener('mouseup', () => {
                isDraggingSlider = false;
            });

            slider.addEventListener('touchend', () => {
                isDraggingSlider = false;
            });

            document.addEventListener('mouseup', () => {
                isDraggingSlider = false;
            });
        }

        initSlider('threshold', function() {
            threshold = parseFloat(document.getElementById('threshold').value);
            document.getElementById('thresholdVal').textContent = threshold;
        });

        // ===== ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ (копируем из предыдущей версии) =====
        
        function switchTab(tabName) {
            currentTab = tabName;
            
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');
        }

        function applyFiltersToImage(layer) {
            if (!layer.image) return layer.image;
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = layer.image.width;
            tempCanvas.height = layer.image.height;
            
            tempCtx.drawImage(layer.image, 0, 0);
            
            let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            let data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                
                if (layer.brightness !== 0) {
                    const bright = layer.brightness * 2.55;
                    r += bright;
                    g += bright;
                    b += bright;
                }
                
                if (layer.contrast !== 0) {
                    const factor = (259 * (layer.contrast + 255)) / (255 * (259 - layer.contrast));
                    r = factor * (r - 128) + 128;
                    g = factor * (g - 128) + 128;
                    b = factor * (b - 128) + 128;
                }
                
                if (layer.saturation !== 0) {
                    const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                    const satFactor = 1 + (layer.saturation / 100);
                    r = gray + (r - gray) * satFactor;
                    g = gray + (g - gray) * satFactor;
                    b = gray + (b - gray) * satFactor;
                }
                
                if (layer.temperature !== 0) {
                    const temp = layer.temperature / 100;
                    r += temp * 50;
                    b -= temp * 50;
                }
                
                if (layer.hue !== 0) {
                    const hsl = rgbToHsl(r, g, b);
                    hsl[0] = (hsl[0] + layer.hue / 360) % 1;
                    if (hsl[0] < 0) hsl[0] += 1;
                    const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
                    r = rgb[0];
                    g = rgb[1];
                    b = rgb[2];
                }
                
                if (layer.hdr > 0) {
                    const hdrFactor = layer.hdr / 100;
                    const avg = (r + g + b) / 3;
                    if (avg > 128) {
                        r = r + (255 - r) * hdrFactor * 0.3;
                        g = g + (255 - g) * hdrFactor * 0.3;
                        b = b + (255 - b) * hdrFactor * 0.3;
                    } else {
                        r = r * (1 - hdrFactor * 0.3);
                        g = g * (1 - hdrFactor * 0.3);
                        b = b * (1 - hdrFactor * 0.3);
                    }
                }
                
                data[i] = Math.max(0, Math.min(255, r));
                data[i + 1] = Math.max(0, Math.min(255, g));
                data[i + 2] = Math.max(0, Math.min(255, b));
            }
            
            if (layer.sharpness > 0) {
                const sharpData = new Uint8ClampedArray(data);
                const w = tempCanvas.width;
                const h = tempCanvas.height;
                const amount = layer.sharpness / 100;
                
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const i = (y * w + x) * 4;
                        
                        for (let c = 0; c < 3; c++) {
                            const center = sharpData[i + c];
                            const top = sharpData[((y-1) * w + x) * 4 + c];
                            const bottom = sharpData[((y+1) * w + x) * 4 + c];
                            const left = sharpData[(y * w + (x-1)) * 4 + c];
                            const right = sharpData[(y * w + (x+1)) * 4 + c];
                            
                            const blur = (top + bottom + left + right) / 4;
                            const sharp = center + (center - blur) * amount * 2;
                            data[i + c] = Math.max(0, Math.min(255, sharp));
                        }
                    }
                }
            }
            
            if (layer.grain > 0) {
                const grainAmount = layer.grain / 100;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * grainAmount * 50;
                    data[i] += noise;
                    data[i + 1] += noise;
                    data[i + 2] += noise;
                }
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            return tempCanvas;
        }

        function rgbToHsl(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }
            return [h, s, l];
        }

        function hslToRgb(h, s, l) {
            let r, g, b;

            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }

            return [r * 255, g * 255, b * 255];
        }

        function applyPreset(preset) {
            const layer = layers[activeLayer];
            
            switch(preset) {
                case 'none':
                    layer.brightness = 0;
                    layer.contrast = 0;
                    layer.saturation = 0;
                    layer.temperature = 0;
                    layer.hue = 0;
                    break;
                case 'bw':
                    layer.saturation = -100;
                    layer.contrast = 20;
                    break;
                case 'sepia':
                    layer.saturation = -50;
                    layer.temperature = 40;
                    layer.contrast = 10;
                    break;
                case 'warm':
                    layer.temperature = 30;
                    layer.brightness = 10;
                    break;
                case 'cold':
                    layer.temperature = -30;
                    layer.contrast = 10;
                    break;
                case 'vintage':
                    layer.saturation = -30;
                    layer.temperature = 20;
                    layer.contrast = -10;
                    layer.brightness = -5;
                    break;
            }
            
            updateControls();
            render();
            showHint(`Пресет: ${preset}`);
        }

        function applyEffect(effect) {
            const layer = layers[activeLayer];
            
            switch(effect) {
                case 'none':
                    layer.blur = 0;
                    layer.sharpness = 0;
                    layer.vignette = 0;
                    layer.hdr = 0;
                    layer.grain = 0;
                    break;
                case 'soft':
                    layer.blur = 1;
                    layer.vignette = 20;
                    layer.brightness = 5;
                    break;
                case 'dramatic':
                    layer.contrast = 40;
                    layer.saturation = 20;
                    layer.vignette = 50;
                    layer.hdr = 60;
                    break;
                case 'dreamy':
                    layer.blur = 2;
                    layer.brightness = 15;
                    layer.saturation = -20;
                    layer.vignette = 30;
                    break;
                case 'gritty':
                    layer.grain = 40;
                    layer.contrast = 30;
                    layer.saturation = -20;
                    layer.sharpness = 30;
                    break;
                case 'cinema':
                    layer.vignette = 40;
                    layer.contrast = 20;
                    layer.saturation = 10;
                    layer.hdr = 30;
                    break;
            }
            
            updateControls();
            render();
            showHint(`Эффект: ${effect}`);
        }

        function zoomCanvasBy(delta) {
            canvasZoom = Math.max(0.25, Math.min(3, canvasZoom + delta));
            applyCanvasZoom();
        }

        function resetCanvasZoom() {
            canvasZoom = 1;
            applyCanvasZoom();
        }

        function applyCanvasZoom() {
            document.documentElement.style.setProperty('--canvas-zoom', canvasZoom);
            const percentage = Math.round(canvasZoom * 100);
            document.getElementById('canvasZoomIndicator').textContent = `Canvas: ${percentage}%`;
            document.getElementById('bottomCanvasZoom').textContent = `${percentage}%`;
        }

        canvasWrapper.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                zoomCanvasBy(delta);
            }
        }, { passive: false });

        let canvasPinchDistance = 0;
        let isCanvasPinching = false;

        canvasWrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                isCanvasPinching = true;
                canvasPinchDistance = getDistance(e.touches[0], e.touches[1]);
                e.preventDefault();
            }
        }, { passive: false });

        canvasWrapper.addEventListener('touchmove', (e) => {
            if (isCanvasPinching && e.touches.length === 2) {
                e.preventDefault();
                const distance = getDistance(e.touches[0], e.touches[1]);
                const delta = (distance - canvasPinchDistance) / 300;
                zoomCanvasBy(delta);
                canvasPinchDistance = distance;
            }
        }, { passive: false });

        canvasWrapper.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isCanvasPinching = false;
            }
        });

        function centerCanvas() {
            const wrapper = canvasWrapper;
            wrapper.scrollLeft = (wrapper.scrollWidth - wrapper.clientWidth) / 2;
            wrapper.scrollTop = (wrapper.scrollHeight - wrapper.clientHeight) / 2;
            showHint('Холст отцентрирован');
        }

        function zoomUI(delta) {
            uiScale = Math.max(0.5, Math.min(2, uiScale + delta));
            applyUIScale();
        }

        function applyUIScale() {
            document.documentElement.style.setProperty('--ui-scale', uiScale);
            document.getElementById('uiZoomDisplay').textContent = Math.round(uiScale * 100) + '%';
            
            const mainContainer = document.getElementById('mainContainer');
            mainContainer.style.width = (100 / uiScale) + 'vw';
            mainContainer.style.height = (100 / uiScale) + 'vh';
            
            const indicator = document.getElementById('scaleIndicator');
            indicator.textContent = `UI: ${Math.round(uiScale * 100)}%`;
            indicator.classList.add('visible');
            setTimeout(() => {
                indicator.classList.remove('visible');
            }, 1500);
        }

        let lastDistance = 0;
        let isPinching = false;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2 && !canvasWrapper.contains(e.target)) {
                isPinching = true;
                lastDistance = getDistance(e.touches[0], e.touches[1]);
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault();
                const distance = getDistance(e.touches[0], e.touches[1]);
                const delta = (distance - lastDistance) / 200;
                zoomUI(delta);
                lastDistance = distance;
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isPinching = false;
            }
        });

        function getDistance(touch1, touch2) {
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        const sidebar = document.getElementById('sidebar');
        const resizer = document.getElementById('sidebarResizer');
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(getComputedStyle(sidebar).width) * uiScale;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        resizer.addEventListener('touchstart', (e) => {
            isResizing = true;
            startX = e.touches[0].clientX;
            startWidth = parseInt(getComputedStyle(sidebar).width) * uiScale;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const delta = e.clientX - startX;
                const newWidth = Math.max(250, Math.min(500, startWidth + delta));
                document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (isResizing) {
                const delta = e.touches[0].clientX - startX;
                const newWidth = Math.max(250, Math.min(500, startWidth + delta));
                document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });

        document.addEventListener('touchend', () => {
            isResizing = false;
        });

        function initUpload(layerNum) {
            const card = document.getElementById(`layer${layerNum}Card`);
            const input = document.getElementById(`file${layerNum}`);
            const preview = document.getElementById(`preview${layerNum}`);

            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('layer-control-btn')) {
                    input.click();
                }
            });

            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            layers[layerNum].image = img;
                            originalImages[layerNum] = null; // Сбрасываем оригинал при новой загрузке
                            preview.src = e.target.result;
                            preview.style.display = 'block';
                            card.classList.add('has-image');
                            card.querySelector('.upload-placeholder').style.display = 'none';
                            
                            selectLayer(layerNum);
                            updateCanvasOverlay();
                            render();
                            showHint('Фото загружено');
                        };
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.style.borderColor = '#0078d4';
            });

            card.addEventListener('dragleave', () => {
                card.style.borderColor = '';
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.style.borderColor = '';
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        }

        initUpload(1);
        initUpload(2);
        initUpload(3);

        function selectLayer(num) {
            if (!layers[num].image) return;
            
            activeLayer = num;
            
            document.querySelectorAll('.upload-card').forEach(card => {
                card.classList.remove('active');
            });
            document.getElementById(`layer${num}Card`).classList.add('active');
            
            document.getElementById('activeLayerNum').textContent = num;
            document.getElementById('activeLayerNum2').textContent = num;
            document.getElementById('activeLayerNum3').textContent = num;
            document.getElementById('activeLayerNum4').textContent = num;
            document.getElementById('bottomLayerNum').textContent = num;
            
            updateControls();
            updateBlendModeDisplay();
        }

        function removeLayer(num) {
            layers[num].image = null;
            originalImages[num] = null;
            const card = document.getElementById(`layer${num}Card`);
            const preview = document.getElementById(`preview${num}`);
            const input = document.getElementById(`file${num}`);
            
            card.classList.remove('has-image', 'active');
            preview.style.display = 'none';
            card.querySelector('.upload-placeholder').style.display = 'block';
            input.value = '';
            
            const defaultPos = {1: {x:200, y:150}, 2: {x:400, y:250}, 3: {x:600, y:350}};
            layers[num] = { 
                image: null, 
                x: defaultPos[num].x,
                y: defaultPos[num].y,
                scale: 1, 
                rotation: 0, 
                opacity: 1, 
                blendMode: 'source-over', 
                flipX: false,
                flipY: false,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                temperature: 0,
                hue: 0,
                blur: 0,
                sharpness: 0,
                vignette: 0,
                hdr: 0,
                grain: 0
            };
            
            updateCanvasOverlay();
            render();
            showHint('Удалено');
        }

        function updateControls() {
            const layer = layers[activeLayer];
            
            document.getElementById('opacity').value = layer.opacity * 100;
            document.getElementById('scale').value = layer.scale * 100;
            document.getElementById('rotate').value = layer.rotation;
            document.getElementById('posX').value = layer.x;
            document.getElementById('posY').value = layer.y;
            
            document.getElementById('brightness').value = layer.brightness;
            document.getElementById('contrast').value = layer.contrast;
            document.getElementById('saturation').value = layer.saturation;
            document.getElementById('temperature').value = layer.temperature;
            document.getElementById('hue').value = layer.hue;
            
            document.getElementById('blur').value = layer.blur;
            document.getElementById('sharpness').value = layer.sharpness;
            document.getElementById('vignette').value = layer.vignette;
            document.getElementById('hdr').value = layer.hdr;
            document.getElementById('grain').value = layer.grain;
            
            updateValues();
            updateBlendModeButtons();
        }

        function updateBlendModeButtons() {
            const layer = layers[activeLayer];
            
            document.querySelectorAll('.blend-btn').forEach(btn => {
                if (btn.dataset.blend === layer.blendMode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            updateBlendModeDisplay();
        }

        function updateBlendModeDisplay() {
            const layer = layers[activeLayer];
            const modeName = blendModeNames[layer.blendMode] || 'Обычный';
            document.getElementById('currentBlendMode').textContent = modeName;
        }

        function updateValues() {
            const layer = layers[activeLayer];
            
            document.getElementById('opacityVal').textContent = Math.round(layer.opacity * 100) + '%';
            document.getElementById('scaleVal').textContent = Math.round(layer.scale * 100) + '%';
            document.getElementById('rotateVal').textContent = Math.round(layer.rotation) + '°';
            document.getElementById('xVal').textContent = Math.round(layer.x);
            document.getElementById('yVal').textContent = Math.round(layer.y);
            
            document.getElementById('brightnessVal').textContent = layer.brightness;
            document.getElementById('contrastVal').textContent = layer.contrast;
            document.getElementById('saturationVal').textContent = layer.saturation;
            document.getElementById('temperatureVal').textContent = layer.temperature;
            document.getElementById('hueVal').textContent = layer.hue + '°';
            
            document.getElementById('blurVal').textContent = layer.blur;
            document.getElementById('sharpnessVal').textContent = layer.sharpness;
            document.getElementById('vignetteVal').textContent = layer.vignette;
            document.getElementById('hdrVal').textContent = layer.hdr;
            document.getElementById('grainVal').textContent = layer.grain;
        }

        function updateCanvasOverlay() {
            const hasImages = layers[1].image || layers[2].image || layers[3].image;
            document.getElementById('canvasOverlay').classList.toggle('hidden', hasImages);
        }

        // Базовые
        initSlider('opacity', function() {
            layers[activeLayer].opacity = document.getElementById('opacity').value / 100;
            updateValues();
            render();
        });

        initSlider('scale', function() {
            layers[activeLayer].scale = document.getElementById('scale').value / 100;
            updateValues();
            render();
        });

        initSlider('rotate', function() {
            layers[activeLayer].rotation = parseFloat(document.getElementById('rotate').value);
            updateValues();
            render();
        });

        initSlider('posX', function() {
            layers[activeLayer].x = parseFloat(document.getElementById('posX').value);
            updateValues();
            render();
        });

        initSlider('posY', function() {
            layers[activeLayer].y = parseFloat(document.getElementById('posY').value);
            updateValues();
            render();
        });

        // Фильтры
        initSlider('brightness', function() {
            layers[activeLayer].brightness = parseFloat(document.getElementById('brightness').value);
            updateValues();
            render();
        });

        initSlider('contrast', function() {
            layers[activeLayer].contrast = parseFloat(document.getElementById('contrast').value);
            updateValues();
            render();
        });

        initSlider('saturation', function() {
            layers[activeLayer].saturation = parseFloat(document.getElementById('saturation').value);
            updateValues();
            render();
        });

        initSlider('temperature', function() {
            layers[activeLayer].temperature = parseFloat(document.getElementById('temperature').value);
            updateValues();
            render();
        });

        initSlider('hue', function() {
            layers[activeLayer].hue = parseFloat(document.getElementById('hue').value);
            updateValues();
            render();
        });

        // Эффекты
        initSlider('blur', function() {
            layers[activeLayer].blur = parseFloat(document.getElementById('blur').value);
            updateValues();
            render();
        });

        initSlider('sharpness', function() {
            layers[activeLayer].sharpness = parseFloat(document.getElementById('sharpness').value);
            updateValues();
            render();
        });

        initSlider('vignette', function() {
            layers[activeLayer].vignette = parseFloat(document.getElementById('vignette').value);
            updateValues();
            render();
        });

        initSlider('hdr', function() {
            layers[activeLayer].hdr = parseFloat(document.getElementById('hdr').value);
            updateValues();
            render();
        });

        initSlider('grain', function() {
            layers[activeLayer].grain = parseFloat(document.getElementById('grain').value);
            updateValues();
            render();
        });

        function setBlendMode(mode) {
            layers[activeLayer].blendMode = mode;
            updateBlendModeButtons();
            render();
            showHint(blendModeNames[mode]);
        }

        document.querySelectorAll('.blend-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const mode = this.dataset.blend;
                setBlendMode(mode);
            });
        });

        function getCoords(e) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            return {
                x: x * (canvas.width / rect.width),
                y: y * (canvas.height / rect.height)
            };
        }

        canvas.addEventListener('mousedown', startDrag);
        canvas.addEventListener('touchstart', startDrag);

        function startDrag(e) {
            if (!layers[activeLayer].image) return;
            if (e.touches && e.touches.length > 1) return;
            e.preventDefault();
            
            const coords = getCoords(e);
            isDragging = true;
            const layer = layers[activeLayer];
            dragStartX = coords.x - layer.x;
            dragStartY = coords.y - layer.y;
        }

        canvas.addEventListener('mousemove', drag);
        canvas.addEventListener('touchmove', drag);

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                const coords = getCoords(e);
                
                layers[activeLayer].x = coords.x - dragStartX;
                layers[activeLayer].y = coords.y - dragStartY;
                
                updateControls();
                render();
            }
        }

        canvas.addEventListener('mouseup', endDrag);
        canvas.addEventListener('touchend', endDrag);
        canvas.addEventListener('mouseleave', endDrag);

        function endDrag() {
            isDragging = false;
        }

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            [1, 2, 3].forEach(num => {
                const layer = layers[num];
                if (layer.image) {
                    drawLayer(layer);
                }
            });
        }

        function drawLayer(layer) {
            ctx.save();
            
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode;
            
            const width = layer.image.width * layer.scale;
            const height = layer.image.height * layer.scale;
            
            ctx.translate(layer.x + width / 2, layer.y + height / 2);
            ctx.rotate(layer.rotation * Math.PI / 180);
            if (layer.flipX) ctx.scale(-1, 1);
            if (layer.flipY) ctx.scale(1, -1);
            ctx.translate(-(layer.x + width / 2), -(layer.y + height / 2));
            
            const filteredImage = applyFiltersToImage(layer);
            
            if (layer.blur > 0) {
                ctx.filter = `blur(${layer.blur}px)`;
            }
            
            ctx.drawImage(filteredImage, layer.x, layer.y, width, height);
            ctx.filter = 'none';
            
            if (layer.vignette > 0) {
                const centerX = layer.x + width / 2;
                const centerY = layer.y + height / 2;
                const maxRadius = Math.sqrt(width * width + height * height) / 2;
                const vignetteStrength = layer.vignette / 100;
                
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, maxRadius * 0.3,
                    centerX, centerY, maxRadius
                );
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(0.6, 'rgba(0,0,0,0)');
                gradient.addColorStop(1, `rgba(0,0,0,${vignetteStrength * 0.8})`);
                
                ctx.fillStyle = gradient;
                ctx.fillRect(layer.x, layer.y, width, height);
            }
            
            ctx.restore();
        }

        function centerLayer() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const width = layer.image.width * layer.scale;
            const height = layer.image.height * layer.scale;
            layer.x = (canvas.width - width) / 2;
            layer.y = (canvas.height - height) / 2;
            
            updateControls();
            render();
            showHint('Слой отцентрирован');
        }

        function resetLayer() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const defaultPos = {1: {x:200, y:150}, 2: {x:400, y:250}, 3: {x:600, y:350}};
            const img = layer.image;
            layers[activeLayer] = {
                image: img,
                x: defaultPos[activeLayer].x,
                y: defaultPos[activeLayer].y,
                scale: 1,
                rotation: 0,
                opacity: 1,
                blendMode: 'source-over',
                flipX: false,
                flipY: false,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                temperature: 0,
                hue: 0,
                blur: 0,
                sharpness: 0,
                vignette: 0,
                hdr: 0,
                grain: 0
            };
            
            updateControls();
            render();
            showHint('Сброшено');
        }

        function flipH() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            layer.flipX = !layer.flipX;
            render();
            showHint('Отражено горизонтально');
        }

        function flipV() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            layer.flipY = !layer.flipY;
            render();
            showHint('Отражено вертикально');
        }

        function fitCanvas() {
            const layer = layers[activeLayer];
            if (!layer.image) return;
            
            const scaleX = canvas.width / layer.image.width;
            const scaleY = canvas.height / layer.image.height;
            layer.scale = Math.min(scaleX, scaleY) * 0.95;
            
            centerLayer();
        }

        function downloadImage() {
            if (!layers[1].image && !layers[2].image && !layers[3].image) {
                showHint('Загрузите фото!');
                return;
            }
            
            const link = document.createElement('a');
            link.download = `merged-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            
            showHint('✅ Сохранено!');
        }

        function resetAll() {
            if (confirm('Удалить всё?')) {
                [1, 2, 3].forEach(num => removeLayer(num));
                showHint('Удалено');
            }
        }

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const icon = document.getElementById('toggleIcon');
            sidebar.classList.toggle('collapsed');
            icon.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
        }

        let hintTimeout;
        function showHint(text) {
            const hint = document.getElementById('hint');
            hint.textContent = text;
            hint.classList.remove('hidden');
            
            clearTimeout(hintTimeout);
            hintTimeout = setTimeout(() => {
                hint.classList.add('hidden');
            }, 2000);
        }

        updateCanvasOverlay();
        selectLayer(1);
        
        setTimeout(() => {
            centerCanvas();
            applyCanvasZoom();
            document.getElementById('hint').classList.add('hidden');
        }, 100);
