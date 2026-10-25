// Runs the homeland layout (see layout.js) off the page's own thread, since a large homeland
// takes a few seconds: posts back what `layOutHomeland` returns for the pieces and open cells
// it's sent. Loaded with the page's own load tag (see `WORKER_URL` in app.js), passed on to
// layout.js so a cached older copy is never used with newer page code.
const ready = import('./layout.js' + new URL(import.meta.url).search);

self.onmessage = async (event) => {
    const { layOutHomeland } = await ready;
    self.postMessage(layOutHomeland(event.data.pieces, event.data.cells, {
        storage: { w: 2, h: 2 },
        storageCount: event.data.storageCount || 1
    }));
};
