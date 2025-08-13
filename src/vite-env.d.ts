/// <reference types="vite/client" />

declare module 'pdfjs-dist/build/pdf.worker.min.js?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}

declare module '*?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
