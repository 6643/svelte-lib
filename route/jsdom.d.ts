declare module 'jsdom' {
  export type JSDOMOptions = {
    url?: string;
  };

  export class JSDOM {
    window: Window & typeof globalThis;

    constructor(html?: string, options?: JSDOMOptions);
  }
}
