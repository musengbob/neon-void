// NEON VOID — keyboard + mouse input, polled once per frame.
// The game reads this, never raw DOM events, so the autopilot can drive it too.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 640, y: 360, down: false, clicked: false, clickX: 0, clickY: 0 };

  function keyName(event) {
    // Normalise to the names the game uses: 'w','a','s','d','shift','space', digits, 'r','p','m','enter','escape'.
    if (event.key === ' ') return 'space';
    return event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  }

  window.addEventListener('keydown', (event) => {
    const k = keyName(event);
    keys.add(k);
    if (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
  }
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (event) => {
    updateMouse(event);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    mouse,
    down(...names) {
      return names.some((n) => keys.has(n));
    },
    pressed(name) {
      // One-shot read: true once per physical press.
      if (keys.has(name)) {
        keys.delete(name);
        return true;
      }
      return false;
    },
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    endFrame() {
      mouse.clicked = false;
    },
  };
}

// A scripted stand-in for the real input, used by the autopilot and the soak test.
export function createScriptedInput() {
  const keys = new Set();
  const mouse = { x: 640, y: 360, down: true, clicked: false, clickX: 0, clickY: 0 };
  return {
    keys,
    mouse,
    down(...names) {
      return names.some((n) => keys.has(n));
    },
    pressed() {
      return false;
    },
    takeClick() {
      return null;
    },
    endFrame() {},
  };
}
