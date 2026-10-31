(function () {
  'use strict';

 document.addEventListener("DOMContentLoaded", () => {
    // 取得畫面上所有的苗株圖片 DOM 節點
    const allImages = Array.from(document.querySelectorAll('.plant-img'));
    if (allImages.length === 0) return;

    const imageUrls = allImages.map(img => img.src);
    let currentIndex = 0;
    let overlay = null;
    let fullImg = null;
    let counter = null;
    let scale = 1;

    // 綁定所有圖片點擊事件
    allImages.forEach((img, idx) => {
      img.addEventListener('click', () => {
        currentIndex = idx;
        openGallery();
      });
    });

    function openGallery() {
      // 建立全螢幕遮罩
      overlay = document.createElement("div");
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; touch-action: none; user-select: none;
      `;

      // 大圖節點
      fullImg = document.createElement("img");
      fullImg.src = imageUrls[currentIndex];
      fullImg.style.cssText = `
        width: 100%; max-width: 600px; max-height: 95vh; object-fit: contain;
        transition: transform 0.2s ease; cursor: grab; transform-origin: center center;
      `;
      fullImg.addEventListener("click", e => e.stopPropagation()); // 防止點圖關閉
      overlay.appendChild(fullImg);

      // 頁數計數器
      counter = document.createElement("div");
      counter.style.cssText = `
        position: absolute; top: 20px; color: white; background: rgba(0,0,0,0.6);
        padding: 6px 16px; border-radius: 20px; font-size: 16px; font-weight: bold; z-index: 1000001;
      `;
      updateCounter();
      overlay.appendChild(counter);

      // 關閉按鈕 (右上角 ✕)
      const closeBtn = document.createElement("div");
      closeBtn.innerText = "✕";
      closeBtn.style.cssText = `
        position: absolute; top: 15px; right: 20px; color: white;
        font-size: 28px; font-weight: bold; cursor: pointer; z-index: 1000002;
        width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, 0.5); border-radius: 50%; user-select: none;
        transition: background 0.2s;
      `;
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeGallery();
      });
      overlay.appendChild(closeBtn);

      // 左右切換按鈕 (電腦版點擊)
      const createBtn = (symbol, isLeft) => {
        const btn = document.createElement("div");
        btn.innerText = symbol;
        btn.style.cssText = `
          position: absolute; top: 0; bottom: 0; ${isLeft ? 'left: 0;' : 'right: 0;'}
          width: 15%; max-width: 80px; display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.7); font-size: 48px; cursor: pointer; z-index: 1000000;
          font-family: monospace; user-select: none;
        `;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          navigate(isLeft ? -1 : 1);
        });
        return btn;
      };

      overlay.appendChild(createBtn("‹", true));
      overlay.appendChild(createBtn("›", false));

      // 點擊空白處關閉
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeGallery();
      });

      // ESC 鍵關閉
      const escHandler = (ev) => {
        if (ev.key === "Escape") closeGallery();
      };
      document.addEventListener("keydown", escHandler);

      function closeGallery() {
        if (overlay) overlay.remove();
        document.removeEventListener("keydown", escHandler);
        document.body.style.overflow = ""; // 解除背景滾動鎖定

        // 🔥 核心新增：關閉後，讓網頁自動平滑捲動到剛剛觀看的那張圖片
        setTimeout(() => {
          if (allImages[currentIndex]) {
            allImages[currentIndex].scrollIntoView({
              behavior: 'smooth', // 平滑捲動
              block: 'center'     // 將圖片置於畫面正中央
            });
          }
        }, 10); // 給瀏覽器 10ms 恢復頁面 overflow 的渲染時間
      }

      document.body.style.overflow = "hidden"; // 鎖定背景滾動
      document.body.appendChild(overlay);

      // 啟動完整的縮放與手勢監聽模組
      setupImageZoom(fullImg);
    }

    // 切換上一張/下一張
    function navigate(direction) {
      currentIndex = (currentIndex + direction + imageUrls.length) % imageUrls.length;
      fullImg.src = imageUrls[currentIndex];
      
      // 換圖時重置縮放比例
      scale = 1;
      fullImg.style.transition = "transform 0.2s ease";
      fullImg.style.transform = `translate3d(0px, 0px, 0px) scale(1)`;
      updateCounter();
      
      // 觸發自訂事件通知 setupImageZoom 內部變數歸零
      fullImg.dispatchEvent(new CustomEvent('resetZoom'));
    }

    function updateCounter() {
      if (counter) {
        counter.innerText = `${currentIndex + 1} / ${imageUrls.length}`;
      }
    }

    // ==========================================
    // 圖片縮放與手勢核心模組
    // ==========================================
    function setupImageZoom(img) {
      let pointX = 0, pointY = 0;
      let startX = 0, startY = 0;
      let initialDist = 0;
      let dragging = false, touchMode = false;
      let lastTap = 0, touches = 1;
      let swipeStartX = 0, swipeStartY = 0;

      // 綁定重置事件 (換圖時觸發)
      img.addEventListener('resetZoom', () => {
        pointX = 0; pointY = 0; scale = 1;
      });

      // 邊界限制：避免圖片放大後被拖曳出視窗外
      function clampPosition() {
        const scaledWidth = img.offsetWidth * scale;
        const scaledHeight = img.offsetHeight * scale;
        const maxScrollX = Math.max(0, (scaledWidth - window.innerWidth) / 2);
        const maxScrollY = Math.max(0, (scaledHeight - window.innerHeight) / 2);

        pointX = Math.max(-maxScrollX, Math.min(maxScrollX, pointX));
        pointY = Math.max(-maxScrollY, Math.min(maxScrollY, pointY));
      }

      function updateTransform() {
        clampPosition();
        img.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
      }

      // 手機觸控開始
      img.addEventListener("touchstart", e => {
        touchMode = true;
        img.style.transition = "none";
        if (e.touches.length === 1) {
          touches = 1;
          startX = e.touches[0].pageX - pointX;
          startY = e.touches[0].pageY - pointY;
          
          if (scale <= 1) {
            swipeStartX = e.touches[0].pageX;
            swipeStartY = e.touches[0].pageY;
          }
        } else if (e.touches.length === 2) {
          touches = 2;
          initialDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
      }, { passive: true });

      // 手機觸控拖曳 / 雙指縮放
      img.addEventListener("touchmove", e => {
        e.stopPropagation();
        if (e.touches.length === 1 && scale > 1) {
          touches = 1;
          e.preventDefault(); 
          pointX = e.touches[0].pageX - startX;
          pointY = e.touches[0].pageY - startY;
          updateTransform();
        } else if (e.touches.length === 2) {
          touches = 2;
          e.preventDefault();
          const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
          scale *= dist / initialDist;
          scale = Math.max(1, Math.min(5, scale)); 
          initialDist = dist;
          updateTransform();
        }
      }, { passive: false });

      // 手機觸控結束
      img.addEventListener("touchend", e => {
        const now = Date.now();
        
        if ((now - lastTap < 300) && touches === 1 && e.changedTouches.length === 1) {
          if (scale > 1) {
            scale = 1; pointX = 0; pointY = 0; 
          } else {
            scale = 2; pointX = 0; pointY = 0; 
          }
          img.style.transition = "transform 0.3s ease";
          updateTransform();
          lastTap = now;
          return;
        }

        if (touches === 1 && scale <= 1 && swipeStartX > 0) {
          const diffX = e.changedTouches[0].pageX - swipeStartX;
          const diffY = e.changedTouches[0].pageY - swipeStartY;
          if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            navigate(diffX > 0 ? -1 : 1); 
          }
          swipeStartX = 0; swipeStartY = 0;
        }

        lastTap = now - (touches === 2 ? 500 : 0);
        touches = 1;
        setTimeout(() => { touchMode = false; }, 50);
      });

      // 電腦版：滑鼠滾輪縮放
      img.addEventListener("wheel", e => {
        e.preventDefault();
        const rect = img.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldScale = scale;
        scale += e.deltaY > 0 ? -0.2 : 0.2;
        scale = Math.max(1, Math.min(5, scale));

        const ratio = scale / oldScale;
        pointX -= (mouseX - rect.width / 2) * (ratio - 1);
        pointY -= (mouseY - rect.height / 2) * (ratio - 1);
        
        img.style.transition = "none";
        updateTransform();
      }, { passive: false });

      // 電腦版：滑鼠拖曳
      img.addEventListener("pointerdown", e => {
        if (touchMode || scale <= 1) return;
        dragging = true;
        startX = e.clientX - pointX;
        startY = e.clientY - pointY;
        img.style.cursor = "grabbing";
        e.preventDefault();
      });

      img.addEventListener("pointermove", e => {
        if (touchMode || !dragging || scale <= 1) return;
        e.preventDefault();
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        updateTransform();
      }, { passive: false });

      const stopDrag = () => {
        dragging = false;
        img.style.cursor = "grab";
      };

      img.addEventListener("pointerup", stopDrag);
      img.addEventListener("pointercancel", stopDrag);
      img.addEventListener("lostpointercapture", stopDrag);
    }
  });
})();