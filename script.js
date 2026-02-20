document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     1) FULLPAGE (active + dark)
     ========================= */
  const container = document.querySelector(".fullpage");
  const sections = Array.from(document.querySelectorAll(".section"));
  const menuLinks = Array.from(document.querySelectorAll(".side-menu a"));
  const sideMenu = document.querySelector(".side-menu");

  function setActiveSectionByViewport() {
    if (!container || sections.length === 0 || menuLinks.length === 0) return;

    const cRect = container.getBoundingClientRect();

    // ✅ 판정 라인(스크롤 스냅/겹치기에서 안정적)
    // 0.5(중앙) ~ 0.7(조금 아래) 사이 추천
    const probeY = cRect.top + cRect.height * 0.6;

    let activeSec = sections[0];
    let best = Infinity;

    sections.forEach((sec) => {
      const r = sec.getBoundingClientRect();
      const secCenter = (r.top + r.bottom) / 2;
      const dist = Math.abs(secCenter - probeY);

      if (dist < best) {
        best = dist;
        activeSec = sec;
      }
    });

    // ✅ 메뉴 active 처리
    menuLinks.forEach(a => a.classList.remove("active"));
    const activeLink = menuLinks.find(a => a.getAttribute("href") === `#${activeSec.id}`);
    if (activeLink) activeLink.classList.add("active");

    // ✅ s3, s4에서는 side-menu 글씨/막대 검정
    if (sideMenu) {
      if (activeSec.id === "s3" || activeSec.id === "s4") {
        sideMenu.classList.add("dark");
      } else {
        sideMenu.classList.remove("dark");
      }
    }
  }

  if (container) {
    container.addEventListener("scroll", setActiveSectionByViewport, { passive: true });
    window.addEventListener("resize", setActiveSectionByViewport);
    setActiveSectionByViewport(); // 초기 1회
  }

  // ✅ side-menu 클릭 시 container 스크롤로 이동 (부드럽게)
  // (브라우저 기본 앵커가 body 스크롤로 가서 꼬일 수 있음)
  menuLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.getAttribute("href")?.replace("#", "");
      const target = document.getElementById(id);
      if (!container || !target) return;

      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();

      // container 스크롤 기준으로 목표 위치 계산
      const top = container.scrollTop + (tRect.top - cRect.top);

      container.scrollTo({ top, behavior: "smooth" });
    });
  });


  /* =========================
     2) SLIDER (auto + drag)
     ========================= */
  const slider = document.querySelector(".slider");
  const track = document.querySelector(".slider-track");
  if (!slider || !track) return;

  const originals = Array.from(track.querySelectorAll(".slide"));
  if (originals.length === 0) return;

  // ✅ 슬라이드 복제(끝없이 오른쪽으로)
  for (let i = 0; i < 10; i++) {
    originals.forEach(slide => track.appendChild(slide.cloneNode(true)));
  }

  let index = 0;
  let intervalId = null;

  function getGap() {
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.gap || styles.columnGap || "0");
    return Number.isFinite(gap) ? gap : 0;
  }

  function getStep() {
    const first = track.querySelector(".slide");
    if (!first) return 0;
    return first.getBoundingClientRect().width + getGap();
  }

  function getTranslateX() {
    const t = getComputedStyle(track).transform;
    if (!t || t === "none") return 0;

    const m = t.match(/matrix.*\((.+)\)/);
    if (!m) return 0;

    const parts = m[1].split(",").map(v => parseFloat(v.trim()));
    if (parts.length === 6) return parts[4];
    if (parts.length === 16) return parts[12];
    return 0;
  }

  // ✅ 왼쪽 끝(음수) 계산
  function getMinTranslateX() {
    const maxMove = track.scrollWidth - slider.clientWidth;
    return -Math.max(0, maxMove);
  }

  function move() {
    const step = getStep();
    if (!step) return;

    index++;
    track.style.transition = "transform 2.4s ease";
    track.style.transform = `translateX(-${step * index}px)`;
  }

  function startAuto() {
    stopAuto();
    intervalId = setInterval(move, 4000);
  }

  function stopAuto() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function syncPosition() {
    const step = getStep();
    if (!step) return;

    track.style.transition = "none";
    track.style.transform = `translateX(-${step * index}px)`;

    requestAnimationFrame(() => {
      track.style.transition = "transform 2.4s ease";
    });
  }

  startAuto();
  window.addEventListener("resize", syncPosition);

  /* ===== DRAG (감도 + 끝 탄성) ===== */
  let pointerDown = false;
  let dragging = false;
  let startX = 0;
  let startTranslate = 0;

  const THRESHOLD = 2;
  const SENSITIVITY = 2.0; // 1.2~2.0
  const RUBBER = 0.5;      // 0.25~0.5

  // rAF로 프레임당 1번 반영
  let targetX = 0;
  let rafPending = false;
  function applyTransform() {
    rafPending = false;
    track.style.transform = `translateX(${targetX}px)`;
  }

  slider.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    pointerDown = true;
    dragging = false;

    startX = e.clientX;
    startTranslate = getTranslateX();

    slider.setPointerCapture(e.pointerId);
    track.style.transition = "none";
    slider.classList.add("is-dragging");
  });

  slider.addEventListener("pointermove", (e) => {
    if (!pointerDown) return;

    const rawDx = e.clientX - startX;
    const dx = rawDx * SENSITIVITY;

    if (!dragging) {
      if (Math.abs(rawDx) < THRESHOLD) return;
      dragging = true;
      stopAuto();
    }

    const minX = getMinTranslateX();
    let next = startTranslate + dx;

    // ✅ 끝에서 고무줄
    if (next > 0) {
      next = next * RUBBER;
    } else if (next < minX) {
      next = minX + (next - minX) * RUBBER;
    }

    targetX = next;

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(applyTransform);
    }
  });

  function endDrag(e) {
    if (!pointerDown) return;
    pointerDown = false;

    slider.classList.remove("is-dragging");

    if (!dragging) return;
    dragging = false;

    const minX = getMinTranslateX();
    let current = getTranslateX();
    if (current > 0) current = 0;
    if (current < minX) current = minX;

    track.style.transition = "transform 0.6s ease";
    track.style.transform = `translateX(${current}px)`;

    // index 갱신(자동 이어지게)
    const step = getStep();
    if (step) index = Math.max(0, Math.round(Math.abs(current) / step));

    setTimeout(() => {
      track.style.transition = "transform 2.4s ease";
      startAuto();
    }, 650);
  }

  slider.addEventListener("pointerup", endDrag);
  slider.addEventListener("pointercancel", endDrag);
  slider.addEventListener("lostpointercapture", endDrag);

});
