/* ══ Typing the name ═══════════════════════════════════════
   The name types itself in once on load: one letter every 38ms
   (about 0.6s for the whole name), an accent caret at the end of
   what is typed, which blinks twice when it is done and goes.

   The letters that are not typed yet are there all along, only
   invisible, so the line has its full width from the first frame
   and nothing next to it (the cube with eyes) moves. The caret
   has no width of its own for the same reason. Screen readers get
   the whole name at once from aria-label.

   Without the script, or with reduced motion asked for, the name
   is simply there. */

(() => {
  const h1 = document.querySelector(".hero__name");
  if (!h1) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const KEY_MS = 38;
  const START_MS = 120;
  const text = h1.textContent.trim();

  h1.setAttribute("aria-label", text);
  h1.textContent = "";
  /* ── each word in its own unbreakable box ──────────────────
     The caret is an inline-block, and the browser may break a
     line on either side of one, even in the middle of a word. On
     a phone, where the name already takes two lines, the surname
     was broken wherever the caret happened to be, a different
     place on every key. Inside a nowrap word the caret offers no
     break; the only one left is the space between the words. */
  const letters = [];
  text.split(/\s+/).forEach((word, w) => {
    if (w) h1.appendChild(document.createTextNode(" "));
    const box = document.createElement("span");
    box.className = "type-word";
    for (const ch of word) {
      const s = document.createElement("span");
      s.className = "type-off";
      s.setAttribute("aria-hidden", "true");
      s.textContent = ch;
      box.appendChild(s);
      letters.push(s);
    }
    h1.appendChild(box);
  });
  const caret = document.createElement("span");
  caret.className = "type-caret";
  caret.setAttribute("aria-hidden", "true");
  letters[0].before(caret);
  h1.classList.add("typing");

  /* the caret always sits right after the last letter typed, so it
     stays inside that letter's word */
  let i = 0;
  const key = () => {
    letters[i].classList.remove("type-off");
    letters[i].after(caret);
    i++;
    if (i < letters.length) setTimeout(key, KEY_MS);
    else {
      caret.classList.add("type-done");
      caret.addEventListener("animationend", () => {
        caret.remove();
        /* the caret is gone: tell whoever is waiting for the name
           to finish (the eyes greet after this) */
        h1.dataset.typed = "";
        h1.dispatchEvent(new Event("name-typed"));
      }, { once: true });
    }
  };
  setTimeout(key, START_MS);
})();
