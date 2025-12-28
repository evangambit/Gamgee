
export const gMouse = {
  down: false,
  downTarget: null as EventTarget | null,
  downPos: {
    'x': 0,
    'y': 0,
  }
};
window.addEventListener('mousedown', (e) => {
  gMouse.down = true;
  gMouse.downPos.x = e.clientX;
  gMouse.downPos.y = e.clientY;
  gMouse.downTarget = e.target;
});
window.addEventListener('mouseup', (e) => {
  gMouse.down = false;
  gMouse.downTarget = null;
});

export const keysDown: Set<string> = new Set();
window.addEventListener('keydown', (e) => {
  keysDown.add(e.key);
});
window.addEventListener('keyup', (e) => {
  keysDown.delete(e.key);
});
